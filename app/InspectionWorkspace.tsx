"use client";
import {demoInspections} from '../lib/demoScenario';
import {cloudStorage} from "../lib/cloudStore";


import { PILOT_STORAGE_KEY, readPilot } from "../lib/storage.ts";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import { DrainMap, type MapSite } from "./DrainMap";
import {
  ActionPlanner,
  DemoMode,
  EnvironmentalDashboard,
  PriorityExplanation,
  PriorityShockPanel,
  RainfallScenarioExplorer,
  TrustPanel,
  ValidationPanel,
  WorkflowComparison,
  VerificationChecklist,
  type DemoScenario,
  type VerificationCheck,
} from "./EnvironmentalPanels";
import { inspectionDecision, passesCleanupVerification, priorityAction, SAME_DRAIN_THRESHOLD, DRAIN_CONFIDENCE_THRESHOLD } from "../lib/decisions.js";
import type { EnvironmentalContextResponse } from "../lib/environment.ts";
import { calculateEnvironmentalRisk, type WaterwayContext } from "../lib/scoring/environmentalRisk.ts";
import { calculatePriorityScore, recommendedAction, scoreLevel } from "../lib/scoring/priority.ts";
import { calculateRainfallScenarios } from "../lib/scoring/rainfallScenarios.ts";
import blockageModelMetadata from "../public/models/drain-blockage-resnet50-v1.json";
import {
  calculateBaseVisionScores,
  calculateDrainConfidence,
  clamp,
  compareSceneFingerprints,
  extractVisualSignalsFromRgba,
} from "../lib/vision.js";

type Detection = {
  class: string;
  score: number;
  bbox: [number, number, number, number];
};

type Analysis = {
  blockage: number;
  litter: number;
  confidence: number;
  drainConfidence?: number;
  fingerprint?: number[];
  objects: Detection[];
  signal: string;
};

type VerificationResult = Analysis & {
  reduction: number;
  sceneMatch: number;
  sameDrain: boolean;
  verified: boolean;
};

const modelEvaluation = { test: blockageModelMetadata.evaluation };

type EvidenceRecord = {
  beforeImage: string;
  beforeName: string;
  beforeAnalysis: Analysis;
  afterImage?: string;
  afterName?: string;
  verification?: VerificationResult;
  updatedAt: string;
};

type PersistedPilot = {
  version: 3;
  sites: MapSite[];
  evidence: Record<string, EvidenceRecord>;
  reviewDecisions?: Record<string, "open" | "approved" | "request-photo">;
};

type Detector = {
  detect: (image: HTMLImageElement) => Promise<Array<{ class: string; score: number; bbox: number[] }>>;
};

type BlockageModelMetadata = {
  model: string;
  threshold: number;
};

type BlockageClassifier = {
  session: {
    run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: ArrayLike<number> }>>;
  };
  metadata: BlockageModelMetadata;
};

declare global {
  interface Window {
    cocoSsd?: { load: (options?: { base?: string }) => Promise<Detector> };
    ort?: {
      env: { wasm: { wasmPaths: string; numThreads: number } };
      Tensor: new (type: "float32", data: Float32Array, dimensions: number[]) => unknown;
      InferenceSession: { create: (model: string, options: { executionProviders: string[] }) => Promise<BlockageClassifier["session"]> };
    };
  }
}

const SAMPLE_ANALYSIS: Analysis = {
  blockage: 82,
  litter: 62,
  confidence: 91,
  drainConfidence: 94,
  signal: "Drain-domain gate + litter detector",
  objects: [
    { class: "mixed litter", score: 0.91, bbox: [4, 8, 32, 32] },
    { class: "organic debris", score: 0.86, bbox: [20, 2, 29, 34] },
  ],
};

const INITIAL_SITES: MapSite[] = demoInspections();


const DEMO_SCENARIOS: DemoScenario[] = [
  { id: "clear", title: "Low-risk clear drain", description: "Low blockage and little visible litter.", blockage: 22, litter: 16, rainfallMm: 2, status: "Monitor", environmentalDistanceMeters: 1200 },
  { id: "moderate", title: "Moderate blockage", description: "Visible obstruction needs routine inspection.", blockage: 52, litter: 38, rainfallMm: 8, status: "Monitor", environmentalDistanceMeters: 680 },
  { id: "litter", title: "Heavy blockage + litter", description: "Strong visible evidence raises cleanup urgency.", blockage: 88, litter: 84, rainfallMm: 6, status: "Dispatch now", environmentalDistanceMeters: 880 },
  { id: "rainfall", title: "Heavy blockage + rainfall", description: "The same evidence under a heavy-rain scenario.", blockage: 84, litter: 58, rainfallMm: 64, status: "Dispatch now", environmentalDistanceMeters: 820 },
  { id: "waterway", title: "Near mapped waterway", description: "High concern with mapped environmental context.", blockage: 78, litter: 72, rainfallMm: 28, status: "Dispatch now", environmentalDistanceMeters: 140 },
  { id: "verified", title: "Verified cleanup", description: "A successful same-scene before/after decision.", blockage: 28, litter: 24, rainfallMm: 12, status: "Verified clear", environmentalDistanceMeters: 420 },
  { id: "review", title: "Human review required", description: "Uncertain evidence remains open for a person.", blockage: 67, litter: 51, rainfallMm: 18, status: "Needs review", environmentalDistanceMeters: null },
];

const UNAVAILABLE_WATERWAY: WaterwayContext = {
  status: "unavailable",
  distanceMeters: null,
  source: "OpenStreetMap / Overpass",
  message: "Environmental context unavailable. No proximity value was fabricated.",
};

let detectorPromise: Promise<Detector> | null = null;
let blockageClassifierPromise: Promise<BlockageClassifier> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") return resolve();
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    const timeout = window.setTimeout(() => { script.remove(); reject(new Error("Model resource timed out")); }, 15000);
    script.onload = () => {
      window.clearTimeout(timeout);
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("Model resource unavailable"));
    };
    if (!existing) document.head.appendChild(script);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Vision model timed out")), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js");
      if (!window.cocoSsd) throw new Error("Vision model did not initialize");
      return withTimeout(window.cocoSsd.load({ base: "lite_mobilenet_v2" }), 25000);
    })();
  }
  try {
    return await detectorPromise;
  } catch (error) {
    detectorPromise = null;
    throw error;
  }
}

async function getBlockageClassifier() {
  if (!blockageClassifierPromise) {
    blockageClassifierPromise = (async () => {
      await loadScript("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js");
      if (!window.ort) throw new Error("Blockage model runtime did not initialize");
      window.ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
      window.ort.env.wasm.numThreads = 1;
      const response = await fetch("/models/drain-blockage-resnet50-v1.json", { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Blockage model metadata unavailable");
      const metadata = await response.json() as BlockageModelMetadata;
      const session = await withTimeout(window.ort.InferenceSession.create(metadata.model, { executionProviders: ["wasm"] }), 25000);
      return { session, metadata };
    })();
  }
  try {
    return await blockageClassifierPromise;
  } catch (error) {
    blockageClassifierPromise = null;
    throw error;
  }
}

async function loadImage(src: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  await image.decode();
  return image;
}

async function fileToStoredImage(file: File) {
  const temporaryUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(temporaryUrl);
    const maxDimension = 960;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.74);
  } finally {
    URL.revokeObjectURL(temporaryUrl);
  }
}

function extractVisualSignals(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const size = 96;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return extractVisualSignalsFromRgba([], 0, 0);
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  return extractVisualSignalsFromRgba(pixels, size, size);
}

async function classifyBlockage(image: HTMLImageElement) {
  const classifier = await getBlockageClassifier();
  if (!window.ort) throw new Error("Blockage model runtime unavailable");
  const size = 224;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Blockage model canvas unavailable");
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const tensorData = new Float32Array(3 * size * size);
  const means = [0.485, 0.456, 0.406];
  const deviations = [0.229, 0.224, 0.225];
  for (let pixelIndex = 0; pixelIndex < size * size; pixelIndex += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      tensorData[channel * size * size + pixelIndex] = (pixels[pixelIndex * 4 + channel] / 255 - means[channel]) / deviations[channel];
    }
  }
  const tensor = new window.ort.Tensor("float32", tensorData, [1, 3, size, size]);
  const result = await withTimeout(classifier.session.run({ image: tensor }), 25000);
  const probability = Number(result.blocked_probability.data[0]);
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error("Invalid classifier probability");
  return { probability, threshold: classifier.metadata.threshold };
}

function combineDrainConfidence(baseConfidence: number, classification: { probability: number } | null) {
  if (!classification || baseConfidence < 38) return baseConfidence;
  const certainty = Math.abs(classification.probability - 0.5) * 2;
  if (certainty < 0.6) return baseConfidence;
  return Math.max(baseConfidence, clamp(Math.round(55 + certainty * 35), 0, 94));
}

function scoreRisk(blockage: number, litter: number, rain: number | null | undefined) {
  return calculatePriorityScore({ blockage, litter, rainfallMm: rain ?? null }).score;
}

function riskBand(risk: number) {
  const level = scoreLevel(risk);
  if (level === "critical") return { label: "Critical", tone: "critical" };
  if (level === "high") return { label: "High", tone: "high" };
  if (level === "moderate") return { label: "Watch", tone: "watch" };
  return { label: "Low", tone: "low" };
}

function confidenceLabel(value: number) {
  if (value >= 80) return "Strong visual evidence";
  if (value >= 60) return "Usable with review";
  return "Uncertain · human review";
}

function modelLabel(signal: string) {
  if (signal.includes("Research ResNet-50")) return "Research ResNet-50 blockage classifier";
  if (signal.includes("Visual fallback")) return "Visual texture fallback";
  if (signal.includes("Demo scenario")) return "Controlled demo evidence";
  return "Drain-domain evidence gate";
}

function waterwayContextForSite(site: MapSite): WaterwayContext {
  if (typeof site.environmentalDistanceMeters === "number") {
    return {
      status: "available",
      distanceMeters: site.environmentalDistanceMeters,
      source: "OpenStreetMap / Overpass",
      message: site.environmentalContext ?? `Mapped water feature approximately ${site.environmentalDistanceMeters} m away.`,
    };
  }
  return UNAVAILABLE_WATERWAY;
}

function queueReason(site: MapSite) {
  if (site.status === "Verified clear") return "Cleanup verified · routine monitoring";
  if (site.status === "Needs review") return "Uncertain evidence · human review";
  if ((site.blockage ?? 0) >= 75 && (site.rainfall ?? 0) >= 25) return "Heavy obstruction + rainfall exposure";
  if ((site.blockage ?? 0) >= 60 || (site.litter ?? 0) >= 60) return "Visible obstruction + litter evidence";
  return "Lower-risk report · monitor conditions";
}

export default function InspectionWorkspace({onReportsChange,assetIds,networkAssets}:{onReportsChange:(reports:MapSite[])=>void;assetIds:string[];networkAssets:{id:string;name:string;lat:number;lon:number}[]}) {
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const [imageUrl, setImageUrl] = useState("/demo-drain.jpg");
  const [fileName, setFileName] = useState("EGLE stormwater sample");
  const [imageError, setImageError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis>(SAMPLE_ANALYSIS);
  const [mode, setMode] = useState<"surge" | "live">("live");
  const [scenarioRainfall, setScenarioRainfall] = useState(64);
  const [weatherStatus, setWeatherStatus] = useState("Sample rainfall scenario");
  const [waterwayContext, setWaterwayContext] = useState<WaterwayContext>(() => waterwayContextForSite(INITIAL_SITES[0]));
  const [stage, setStage] = useState<"idle" | "loading" | "detecting" | "done">("idle");
  const [sites, setSites] = useState<MapSite[]>(INITIAL_SITES);
  const [selectedSite, setSelectedSite] = useState<MapSite>(INITIAL_SITES[0]);
  const [locationInput, setLocationInput] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cleaned, setCleaned] = useState(false);
  const [verificationImageUrl, setVerificationImageUrl] = useState<string | null>(null);
  const [verificationFileName, setVerificationFileName] = useState("");
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verificationStage, setVerificationStage] = useState<"idle" | "loading" | "detecting" | "done">("idle");
  const [verificationReveal, setVerificationReveal] = useState<"idle" | "checking" | "measuring" | "verified" | "review">("idle");
  const [evidenceBySite, setEvidenceBySite] = useState<Record<string, EvidenceRecord>>({});
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, "open" | "approved" | "request-photo">>({});
  const [pitchMode, setPitchMode] = useState(false);
  const [crewCount, setCrewCount] = useState(1);
  const [inspectionCapacity, setInspectionCapacity] = useState(2);
  const [rippleVersion, setRippleVersion] = useState(0);
  const [comparisonMode, setComparisonMode] = useState<"side-by-side" | "slider">("side-by-side");
  const [comparisonSplit, setComparisonSplit] = useState(50);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const verificationInput = useRef<HTMLInputElement>(null);
  const nextLocationId = useRef(5);

  const rainfall = mode === "surge" ? scenarioRainfall : (selectedSite.rainfall ?? null);
  const effectiveAnalysis = cleaned && verificationResult ? verificationResult : analysis;
  const priorityResult = useMemo(() => calculatePriorityScore({
    blockage: effectiveAnalysis.blockage,
    litter: effectiveAnalysis.litter,
    rainfallMm: rainfall,
    evidenceConfidence: effectiveAnalysis.confidence,
  }), [effectiveAnalysis.blockage, effectiveAnalysis.confidence, effectiveAnalysis.litter, rainfall]);
  const environmentalResult = useMemo(() => calculateEnvironmentalRisk({
    blockage: effectiveAnalysis.blockage,
    litter: effectiveAnalysis.litter,
    rainfallMm: rainfall,
    waterway: waterwayContext,
    evidenceConfidence: effectiveAnalysis.confidence,
  }), [effectiveAnalysis.blockage, effectiveAnalysis.confidence, effectiveAnalysis.litter, rainfall, waterwayContext]);
  const scenarios = useMemo(() => calculateRainfallScenarios({
    blockage: effectiveAnalysis.blockage,
    litter: effectiveAnalysis.litter,
    waterway: waterwayContext,
    evidenceConfidence: effectiveAnalysis.confidence,
  }), [effectiveAnalysis.blockage, effectiveAnalysis.confidence, effectiveAnalysis.litter, waterwayContext]);
  const queueSites = useMemo(() => sites.map((site) => {
    const rainfallForSite = mode === "surge" ? scenarioRainfall : (site.rainfall ?? null);
    const priority = calculatePriorityScore({
      blockage: site.blockage ?? site.risk,
      litter: site.litter ?? 0,
      rainfallMm: rainfallForSite,
      evidenceConfidence: 70,
    });
    const environmental = calculateEnvironmentalRisk({
      blockage: site.blockage ?? site.risk,
      litter: site.litter ?? 0,
      rainfallMm: rainfallForSite,
      waterway: waterwayContextForSite(site),
      evidenceConfidence: 70,
    });
    const preservedStatus = ["Needs review", "Verified clear"].includes(site.status);
    return {
      ...site,
      risk: priority.score,
      environmentalRisk: environmental.score,
      environmentalLevel: environmental.level,
      rainfall: rainfallForSite ?? undefined,
      status: preservedStatus ? site.status : priorityAction(priority.score),
      recommendedAction: recommendedAction(priority.score, site.status === "Verified clear"),
    };
  }), [mode, scenarioRainfall, sites]);
  const risk = priorityResult.score;
  const band = riskBand(risk);
  const action = !cleaned && stage === "done" && (effectiveAnalysis.drainConfidence ?? effectiveAnalysis.confidence) < 60
    ? "Human review required before dispatch."
    : recommendedAction(risk, cleaned);
  const sortedSites = useMemo(() => [...queueSites].sort((a, b) => b.risk - a.risk), [queueSites]);
  const reviewSites = useMemo(() => queueSites.filter((site) => site.status === "Needs review"), [queueSites]);
  const selectedRank = Math.max(1, sortedSites.findIndex((site) => site.id === selectedSite.id) + 1);
  const verifiedRiskReduction = verificationResult?.verified
    ? Math.max(0, scoreRisk(analysis.blockage, analysis.litter, rainfall) - risk)
    : null;
  const verificationBeforeRisk = scoreRisk(analysis.blockage, analysis.litter, rainfall);
  const verificationAfterRisk = verificationResult
    ? scoreRisk(verificationResult.blockage, verificationResult.litter, rainfall)
    : null;
  const dashboardRecords = useMemo(() => queueSites.map((site) => ({
    ...site,
    verifiedReduction: evidenceBySite[site.id]?.verification?.verified
      ? evidenceBySite[site.id].verification?.reduction
      : undefined,
  })), [evidenceBySite, queueSites]);
  const verificationChecks = useMemo<VerificationCheck[]>(() => {
    if (!verificationResult) {
      return [
        { label: "Same scene confidence", detail: "Waiting for an after photo.", state: "waiting" },
        { label: "Drain evidence", detail: "Waiting for an after photo.", state: "waiting" },
        { label: "Obstruction improved", detail: "Requires at least a 15-point reduction.", state: "waiting" },
        { label: "Litter threshold", detail: "Residual litter must be 48 or lower.", state: "waiting" },
      ];
    }
    return [
      { label: "Same scene confidence", detail: `${verificationResult.sceneMatch ?? 0}% match; ${SAME_DRAIN_THRESHOLD}% required.`, state: verificationResult.sameDrain ? "pass" : "fail" },
      { label: "Drain evidence", detail: `${verificationResult.drainConfidence ?? 0}% confidence; 60% required.`, state: (verificationResult.drainConfidence ?? 0) >= 60 ? "pass" : "fail" },
      { label: "Obstruction improved", detail: `${verificationResult.reduction}-point reduction; 15 required.`, state: verificationResult.reduction >= 15 ? "pass" : "fail" },
      { label: "Litter threshold", detail: `${verificationResult.litter}/100 residual litter; maximum 48.`, state: verificationResult.litter <= 48 ? "pass" : "fail" },
    ];
  }, [verificationResult]);
  const verificationFailureReason = verificationChecks
    .filter((check) => check.state === "fail")
    .map((check) => `${check.label}: ${check.detail}`)
    .join(" ");

  /* eslint-disable react-hooks/set-state-in-effect -- The staged reveal is a deliberate presentation of one completed verification result. */
  useEffect(() => {
    if (!verificationResult) {
      setVerificationReveal("idle");
      return;
    }
    if (!verificationResult.verified) {
      setVerificationReveal("review");
      return;
    }
    setVerificationReveal("checking");
    const measuringTimer = window.setTimeout(() => setVerificationReveal("measuring"), 700);
    const verifiedTimer = window.setTimeout(() => setVerificationReveal("verified"), 1500);
    return () => {
      window.clearTimeout(measuringTimer);
      window.clearTimeout(verifiedTimer);
    };
  }, [verificationResult]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const controller = new AbortController();
    const targetSiteId = selectedSite.id;

    async function loadEnvironmentalContext() {
      if (selectedSite.isDemo) {
        const context = typeof selectedSite.environmentalDistanceMeters === "number" ? {
          status: "available" as const,
          distanceMeters: selectedSite.environmentalDistanceMeters,
          source: "OpenStreetMap / Overpass" as const,
          message: selectedSite.environmentalContext ?? `Demo scenario: mapped water feature approximately ${selectedSite.environmentalDistanceMeters} m away.`,
        } : UNAVAILABLE_WATERWAY;
        setWeatherStatus(`Sample data · ${selectedSite.place}`);
        setWaterwayContext(context);
        return;
      }

      setWeatherStatus(`Loading live rainfall · ${selectedSite.place}`);
      setWaterwayContext({
        status: "loading",
        distanceMeters: null,
        source: "OpenStreetMap / Overpass",
        message: "Checking mapped waterways near this report…",
      });
      let data: Pick<EnvironmentalContextResponse, "weather" | "waterway">;
      try {
        const response = await fetch(
          `/api/environmental-context?latitude=${selectedSite.lat}&longitude=${selectedSite.lon}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Environmental context returned ${response.status}`);
        data = await response.json() as Pick<EnvironmentalContextResponse, "weather" | "waterway">;
      } catch {
        if (controller.signal.aborted) return;
        data = {
          weather: {
            status: "unavailable",
            precipitationMm: null,
            probabilityPercent: null,
            source: "Open-Meteo",
            message: "Live rainfall unavailable. Priority uses visible evidence with lower coverage; no fallback was invented.",
          },
          waterway: UNAVAILABLE_WATERWAY,
        };
      }
      if (controller.signal.aborted) return;
      const context = data.waterway;
      const localRain = data.weather.status === "available" ? data.weather.precipitationMm : null;
      const localStatus = `${data.weather.message} · ${selectedSite.place}`;
      setWeatherStatus(localStatus);
      setWaterwayContext(context);
      const locationRisk = scoreRisk(effectiveAnalysis.blockage, effectiveAnalysis.litter, localRain);
      const environmental = calculateEnvironmentalRisk({
        blockage: effectiveAnalysis.blockage,
        litter: effectiveAnalysis.litter,
        rainfallMm: localRain,
        waterway: context,
        evidenceConfidence: effectiveAnalysis.confidence,
      });
      const action = recommendedAction(locationRisk, cleaned);
      setSites((current) => current.map((site) => site.id === targetSiteId ? {
        ...site,
        risk: locationRisk,
        status: ["Needs review", "Verified clear"].includes(site.status) ? site.status : priorityAction(locationRisk),
        rainfall: localRain ?? undefined,
        weatherStatus: localStatus,
        blockage: effectiveAnalysis.blockage,
        litter: effectiveAnalysis.litter,
        environmentalRisk: environmental.score,
        environmentalLevel: environmental.level,
        environmentalContext: context.message,
        environmentalDistanceMeters: context.distanceMeters,
        recommendedAction: action,
      } : site));
      setSelectedSite((current) => current.id === targetSiteId ? {
        ...current,
        risk: locationRisk,
        status: ["Needs review", "Verified clear"].includes(current.status) ? current.status : priorityAction(locationRisk),
        rainfall: localRain ?? undefined,
        weatherStatus: localStatus,
        blockage: effectiveAnalysis.blockage,
        litter: effectiveAnalysis.litter,
        environmentalRisk: environmental.score,
        environmentalLevel: environmental.level,
        environmentalContext: context.message,
        environmentalDistanceMeters: context.distanceMeters,
        recommendedAction: action,
      } : current);
    }

    void loadEnvironmentalContext();
    return () => controller.abort();
  }, [cleaned, effectiveAnalysis.blockage, effectiveAnalysis.confidence, effectiveAnalysis.litter, selectedSite.environmentalContext, selectedSite.environmentalDistanceMeters, selectedSite.id, selectedSite.isDemo, selectedSite.lat, selectedSite.lon, selectedSite.place]);

  /* eslint-disable react-hooks/set-state-in-effect -- Hydrate the device-persistent pilot after the client mounts. */
  useEffect(() => {
    try {
      const raw = readPilot(cloudStorage);
      if (raw) {
        const saved = JSON.parse(raw) as { version: number; sites: MapSite[]; evidence?: Record<string, EvidenceRecord>; reviewDecisions?: Record<string, "open" | "approved" | "request-photo"> };
        if ([1, 2, 3].includes(saved.version) && saved.sites.length > 0) {
          setSites(saved.sites);
          setEvidenceBySite(saved.evidence ?? {});
          setReviewDecisions(saved.reviewDecisions ?? {});
          const first = saved.sites[0];
          setSelectedSite(first);
          const record = saved.evidence?.[first.id];
          if (record) {
            setImageUrl(record.beforeImage);
            setFileName(record.beforeName);
            setAnalysis(record.beforeAnalysis);
            setVerificationImageUrl(record.afterImage ?? null);
            setVerificationFileName(record.afterName ?? "");
            setVerificationResult(record.verification ?? null);
            setCleaned(Boolean(record.verification?.verified));
          }
          const ids = saved.sites.map((site) => Number(site.id.replace(/\D/g, ""))).filter(Number.isFinite);
          nextLocationId.current = Math.max(4, ...ids) + 1;
        }
      }
    } catch {
      setStorageWarning("Saved data could not be safely loaded. Original data retained; saving is paused for this session.");
      setStorageBlocked(true);
    } finally {
      setPersistenceReady(true);
    }
  }, []);

  useEffect(() => {
    if (!persistenceReady || storageBlocked) return;
    const payload: PersistedPilot = { version: 3, sites, evidence: evidenceBySite, reviewDecisions };
    try {
      cloudStorage.setItem(PILOT_STORAGE_KEY, JSON.stringify(payload));

    } catch {
      // Storage can be full or disabled; the live session remains usable.
    }
  }, [evidenceBySite, persistenceReady, reviewDecisions, sites, storageBlocked]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    return () => {
      if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (verificationImageUrl?.startsWith("blob:")) URL.revokeObjectURL(verificationImageUrl);
    };
  }, [verificationImageUrl]);

  function selectSite(site: MapSite, suppliedRecord?: EvidenceRecord) {
    const record = suppliedRecord ?? evidenceBySite[site.id];
    setImageError("");
    if (!site.isDemo) setMode("live");
    setSelectedSite(site);
    setWeatherStatus(site.weatherStatus ?? `Loading forecast · ${site.place}`);
    setWaterwayContext(site.isDemo ? waterwayContextForSite(site) : {
      status: "loading",
      distanceMeters: null,
      source: "OpenStreetMap / Overpass",
      message: "Checking mapped waterways near this report…",
    });
    if (record) {
      setImageUrl(record.beforeImage);
      setFileName(record.beforeName);
      setAnalysis(record.beforeAnalysis);
      setVerificationImageUrl(record.afterImage ?? null);
      setVerificationFileName(record.afterName ?? "");
      setVerificationResult(record.verification ?? null);
      setVerificationStage(record.verification ? "done" : "idle");
      setCleaned(Boolean(record.verification?.verified));
    } else {
      setImageUrl("/demo-drain.jpg");
      setFileName("EGLE stormwater sample");
      setAnalysis(SAMPLE_ANALYSIS);
      setVerificationImageUrl(null);
      setVerificationFileName("");
      setVerificationResult(null);
      setVerificationStage("idle");
      setCleaned(false);
    }
  }

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose a JPG, PNG, WEBP, or HEIC image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setImageError("That image is larger than 12 MB. Choose a smaller photo so the on-device model can process it.");
      return;
    }
    setImageError("");
    setStage("loading");
    try {
      const nextUrl = await fileToStoredImage(file);
      setImageUrl(nextUrl);
      setFileName(file.name);
      setAnalysis({ blockage: 0, litter: 0, confidence: 0, drainConfidence: 0, objects: [], signal: "Starting drain-domain scan" });
      setVerificationImageUrl(null);
      setVerificationFileName("");
      setVerificationResult(null);
      setVerificationStage("idle");
      setCleaned(false);
      await runAnalysis(nextUrl, file.name);
    } catch {
      setAnalysis((current) => ({ ...current, signal: "Could not prepare this image" }));
      setImageError("This image could not be decoded. Try exporting it as JPG or PNG and upload again.");
      setStage("idle");
    }
  }

  function selectQueueSite(site: MapSite) {
    const persistedSite = sites.find((item) => item.id === site.id);
    selectSite(persistedSite ?? site);
  }

  async function chooseVerificationImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image for the after-cleanup evidence.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setImageError("That after photo is larger than 12 MB. Choose a smaller image and try again.");
      return;
    }
    setImageError("");
    setVerificationStage("loading");
    try {
      const nextUrl = await fileToStoredImage(file);
      setVerificationImageUrl(nextUrl);
      setVerificationFileName(file.name);
      setVerificationResult(null);
      setCleaned(false);
      await verifyCleanup(nextUrl, file.name);
    } catch {
      setImageError("This after photo could not be decoded. Try a JPG or PNG export.");
      setVerificationStage("idle");
    }
  }

  async function verifyCleanup(source: string, sourceName = verificationFileName) {
    const targetSiteId = selectedSite.id;
    const beforeBlockage = analysis.blockage;
    setVerificationStage("loading");
    try {
      const image = await loadImage(source);
      const visual = extractVisualSignals(image);
      const beforeImage = await loadImage(imageUrl);
      const beforeFingerprint = analysis.fingerprint ?? extractVisualSignals(beforeImage).fingerprint;
      // Reject identical / near-identical pixels before loading optional remote models.
      const pixels=(im:HTMLImageElement)=>{const normalized=document.createElement("canvas");const scale=Math.min(1,960/Math.max(im.naturalWidth,im.naturalHeight));normalized.width=Math.round(im.naturalWidth*scale);normalized.height=Math.round(im.naturalHeight*scale);normalized.getContext("2d")!.drawImage(im,0,0,normalized.width,normalized.height);const c=document.createElement("canvas");c.width=64;c.height=64;const ctx=c.getContext("2d")!;ctx.imageSmoothingQuality="high";ctx.drawImage(normalized,0,0,64,64);return ctx.getImageData(0,0,64,64).data;};
      const aPixels=pixels(beforeImage),bPixels=pixels(image);
      const difference=aPixels.reduce((sum,v,i)=>sum+(i%4===3?0:Math.abs(v-bPixels[i])),0)/(64*64*3);
      if(source===imageUrl||difference<5){
        const result:VerificationResult={...analysis,objects:[],reduction:0,sceneMatch:1,sameDrain:true,verified:false,signal:"Same or near-identical photo detected · replace the after photo"};
        setVerificationResult(result);setCleaned(false);setVerificationStage("done");
        setEvidenceBySite(current=>({...current,[targetSiteId]:{beforeImage:current[targetSiteId]?.beforeImage??imageUrl,beforeName:current[targetSiteId]?.beforeName??fileName,beforeAnalysis:current[targetSiteId]?.beforeAnalysis??analysis,afterImage:source,afterName:sourceName,verification:result,updatedAt:new Date().toISOString()}}));
        setSites(current=>current.map(s=>s.id===targetSiteId?{...s,status:"Needs review"}:s));
        setSelectedSite(s=>s.id===targetSiteId?{...s,status:"Needs review"}:s);
        return;
      }
      const { blockage: baseBlockage, litter: baseLitter } = calculateBaseVisionScores(visual);
      const blockageClassificationPromise = withTimeout(classifyBlockage(image), 30000).catch(() => null);
      setVerificationStage("detecting");

      let predictions: Detection[] = [];
      let modelUsed = false;
      try {
        const detector = await withTimeout(getDetector(), 30000);
        const raw = await withTimeout(detector.detect(image), 25000);
        predictions = raw
          .filter((item) => item.score >= 0.34)
          .slice(0, 5)
          .map((item) => ({
            class: item.class,
            score: item.score,
            bbox: [
              (item.bbox[0] / image.naturalWidth) * 100,
              (item.bbox[1] / image.naturalHeight) * 100,
              (item.bbox[2] / image.naturalWidth) * 100,
              (item.bbox[3] / image.naturalHeight) * 100,
            ],
          }));
        modelUsed = true;
      } catch {
        modelUsed = false;
      }

      const litterObjects = predictions.filter((item) =>
        ["bottle", "cup", "book", "handbag", "backpack", "umbrella"].includes(item.class),
      ).length;
      const blockageClassification = await blockageClassificationPromise;
      const blockage = blockageClassification
        ? clamp(Math.round(blockageClassification.probability * 100), 14, 94)
        : clamp(baseBlockage + litterObjects * 5, 14, 94);
      const litter = clamp(baseLitter + litterObjects * 18, 8, 96);
      const reduction = Math.max(0, beforeBlockage - blockage);
      const drainConfidence = combineDrainConfidence(calculateDrainConfidence(visual, predictions), blockageClassification);
      const sceneMatch = compareSceneFingerprints(beforeFingerprint, visual.fingerprint);
      const sameDrain = sceneMatch >= SAME_DRAIN_THRESHOLD;
      const verified = passesCleanupVerification({ sameDrain, drainConfidence, blockage, litter, reduction });
      const confidence = Math.min(
        drainConfidence,
        clamp(Math.round((modelUsed ? 78 : 59) + Math.min(predictions.length, 4) * 3), 0, 94),
      );
      const result: VerificationResult = {
        blockage,
        litter,
        confidence,
        drainConfidence,
        fingerprint: visual.fingerprint,
        objects: predictions,
        reduction,
        sceneMatch,
        sameDrain,
        verified,
        signal: sameDrain ? "Same-drain evidence comparison" : "Scene mismatch · human review",
      };
      setVerificationResult(result);
      setCleaned(verified);
      setEvidenceBySite((current) => ({
        ...current,
        [targetSiteId]: {
          beforeImage: current[targetSiteId]?.beforeImage ?? imageUrl,
          beforeName: current[targetSiteId]?.beforeName ?? fileName,
          beforeAnalysis: current[targetSiteId]?.beforeAnalysis ?? analysis,
          afterImage: source,
          afterName: sourceName,
          verification: result,
          updatedAt: new Date().toISOString(),
        },
      }));

      if (verified) {
        const residualRisk = scoreRisk(blockage, litter, rainfall);
        setSites((current) => current.map((site) => (
          site.id === targetSiteId ? { ...site, risk: residualRisk, status: "Verified clear", blockage, litter, photo: source, recommendedAction: recommendedAction(residualRisk, true) } : site
        )));
        setSelectedSite((current) => (
          current.id === targetSiteId ? { ...current, risk: residualRisk, status: "Verified clear", blockage, litter, photo: source, recommendedAction: recommendedAction(residualRisk, true) } : current
        ));
      } else {
        const originalRisk = scoreRisk(analysis.blockage, analysis.litter, rainfall);
        const originalStatus = "Needs review";
        setSites((current) => current.map((site) => (
          site.id === targetSiteId ? { ...site, risk: originalRisk, status: originalStatus } : site
        )));
        setSelectedSite((current) => (
          current.id === targetSiteId ? { ...current, risk: originalRisk, status: originalStatus } : current
        ));
      }
      setVerificationStage("done");
    } catch {
      const failedResult: VerificationResult = {
        blockage: analysis.blockage,
        litter: analysis.litter,
        confidence: 0,
        drainConfidence: 0,
        objects: [],
        reduction: 0,
        sceneMatch: 0,
        sameDrain: false,
        verified: false,
        signal: "Could not read the after photo",
      };
      setVerificationResult(failedResult);
      setEvidenceBySite((current) => ({
        ...current,
        [targetSiteId]: {
          beforeImage: current[targetSiteId]?.beforeImage ?? imageUrl,
          beforeName: current[targetSiteId]?.beforeName ?? fileName,
          beforeAnalysis: current[targetSiteId]?.beforeAnalysis ?? analysis,
          afterImage: source,
          afterName: sourceName,
          verification: failedResult,
          updatedAt: new Date().toISOString(),
        },
      }));
      const originalRisk = scoreRisk(analysis.blockage, analysis.litter, rainfall);
      const originalStatus = "Needs review";
      setSites((current) => current.map((site) => (
        site.id === targetSiteId ? { ...site, risk: originalRisk, status: originalStatus } : site
      )));
      setSelectedSite((current) => (
        current.id === targetSiteId ? { ...current, risk: originalRisk, status: originalStatus } : current
      ));
      setVerificationStage("done");
    }
  }

  async function runAnalysis(source = imageUrl, sourceName = fileName) {
    const targetSiteId = selectedSite.id;
    setStage("loading");
    setCleaned(false);
    try {
      const image = await loadImage(source);
      const visual = extractVisualSignals(image);
      const { blockage: baseBlockage, litter: baseLitter } = calculateBaseVisionScores(visual);
      const blockageClassificationPromise = withTimeout(classifyBlockage(image), 30000).catch(() => null);

      setAnalysis({
        blockage: baseBlockage,
        litter: baseLitter,
        confidence: 59,
        objects: [],
        signal: "Visual scan complete · refining objects",
      });
      setStage("detecting");

      let predictions: Detection[] = [];
      let modelUsed = false;
      try {
        const detector = await withTimeout(getDetector(), 30000);
        const raw = await withTimeout(detector.detect(image), 25000);
        predictions = raw
          .filter((item) => item.score >= 0.34)
          .slice(0, 5)
          .map((item) => ({
            class: item.class,
            score: item.score,
            bbox: [
              (item.bbox[0] / image.naturalWidth) * 100,
              (item.bbox[1] / image.naturalHeight) * 100,
              (item.bbox[2] / image.naturalWidth) * 100,
              (item.bbox[3] / image.naturalHeight) * 100,
            ],
          }));
        modelUsed = true;
      } catch {
        modelUsed = false;
      }

      const litterObjects = predictions.filter((item) =>
        ["bottle", "cup", "book", "handbag", "backpack", "umbrella"].includes(item.class),
      ).length;
      const blockageClassification = await blockageClassificationPromise;
      const blockage = blockageClassification
        ? clamp(Math.round(blockageClassification.probability * 100), 14, 94)
        : clamp(baseBlockage + litterObjects * 5, 14, 94);
      const litter = clamp(baseLitter + litterObjects * 18, 8, 96);
      const drainConfidence = combineDrainConfidence(calculateDrainConfidence(visual, predictions), blockageClassification);
      const confidence = Math.min(
        drainConfidence,
        clamp(Math.round((modelUsed ? 78 : 59) + Math.min(predictions.length, 4) * 3), 0, 94),
      );
      const nextStatus = inspectionDecision({ drainConfidence, risk: scoreRisk(blockage, litter, rainfall) });
      const drainConfirmed = nextStatus !== "Needs review";

      const finalAnalysis: Analysis = {
        blockage,
        litter,
        confidence,
        drainConfidence,
        fingerprint: visual.fingerprint,
        objects: predictions,
        signal: drainConfirmed
          ? (blockageClassification
            ? (modelUsed ? "Research ResNet-50 + COCO litter" : "Research ResNet-50 · litter fallback")
            : (modelUsed ? "Visual fallback + COCO litter detector" : "Offline visual fallback"))
          : "Drain not confirmed · human review",
      };
      setAnalysis(finalAnalysis);
      setEvidenceBySite((current) => ({
        ...current,
        [targetSiteId]: {
          beforeImage: source,
          beforeName: sourceName,
          beforeAnalysis: finalAnalysis,
          updatedAt: new Date().toISOString(),
        },
      }));
      const resultRisk = scoreRisk(blockage, litter, rainfall);
      setSites((current) => current.map((site) => (
        site.id === targetSiteId ? { ...site, risk: resultRisk, status: nextStatus, blockage, litter, photo: source, recommendedAction: recommendedAction(resultRisk) } : site
      )));
      setSelectedSite((current) => (
        current.id === targetSiteId ? { ...current, risk: resultRisk, status: nextStatus, blockage, litter, photo: source, recommendedAction: recommendedAction(resultRisk) } : current
      ));
      setStage("done");
    } catch {
      setAnalysis((current) => ({ ...current, signal: "Could not read this image" }));
      setImageError("The image could not be analyzed in this browser. Try another clear drain photo.");
      setStage("idle");
    }
  }

  async function locateGarbage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = locationInput.trim();
    if (!query) return;

    setLocating(true);
    setLocationStatus("Finding that location…");
    try {
      let result: { lat: number; lon: number; place: string } | null = null;
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "en" }, signal: AbortSignal.timeout(10000) },
      ).catch(() => null);
      if (nominatimResponse?.ok) {
        const matches = await nominatimResponse.json() as Array<{ lat: string; lon: string; display_name: string }>;
        const match = matches[0];
        if (match) {
          result = {
            lat: Number(match.lat),
            lon: Number(match.lon),
            place: match.display_name.split(",").slice(0, 3).join(" · "),
          };
        }
      }

      if (!result) {
        const fallbackResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`, { signal: AbortSignal.timeout(10000) },
        );
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json() as {
            results?: Array<{ latitude: number; longitude: number; name: string; admin1?: string; country?: string }>;
          };
          const match = data.results?.[0];
          if (match) {
            result = {
              lat: match.latitude,
              lon: match.longitude,
              place: [match.name, match.admin1, match.country].filter(Boolean).join(" · "),
            };
          }
        }
      }

      if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lon) || Math.abs(result.lat)>90 || Math.abs(result.lon)>180) {
        setLocationStatus("Location not found. Try a neighborhood plus city.");
        return;
      }

      const locationRisk = scoreRisk(analysis.blockage, analysis.litter, null);
      const site: MapSite = {
        id: `INS-${String(nextLocationId.current++).padStart(3,'0')}`,
        place: result.place,
        risk: locationRisk,
        status: "Needs review",
        lat: result.lat,
        lon: result.lon,
        weatherStatus: `Loading live rainfall · ${result.place}`,
        blockage: analysis.blockage,
        litter: analysis.litter,
        environmentalContext: "Checking mapped waterways near this report…",
        environmentalDistanceMeters: null,
        recommendedAction: "Upload a photo for this location before linking evidence.",
        photo: "/demo-drain.jpg",
        isDemo: false,
      };
      const evidence: EvidenceRecord = {
        beforeImage: "/demo-drain.jpg",
        beforeName: "Illustration only - upload required",
        beforeAnalysis: { ...SAMPLE_ANALYSIS, drainConfidence: 0, signal: "No uploaded evidence for this location" },
        updatedAt: new Date().toISOString(),
      };
      setSites((current) => [site, ...current]);
      setEvidenceBySite((current) => ({ ...current, [site.id]: evidence }));
      selectSite(site, evidence);
      setLocationStatus(`Garbage marker added at ${site.place} (${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}). Live rainfall and nearby-waterway context are loading for this coordinate.`);
    } catch {
      setLocationStatus("Could not reach the location service. Please try again.");
    } finally {
      setLocating(false);
    }
  }

  function openReview(site: MapSite) {
    selectSite(site);
    window.requestAnimationFrame(() => document.getElementById("verify")?.scrollIntoView({ behavior: "smooth" }));
  }

  function keepReportOpen(site: MapSite) {
    const status = priorityAction(site.risk);
    setSites((current) => current.map((item) => item.id === site.id ? { ...item, status } : item));
    setSelectedSite((current) => current.id === site.id ? { ...current, status } : current);
  }

  function restoreSample() {
    setImageError("");
    setImageUrl("/demo-drain.jpg");
    setFileName("EGLE stormwater sample");
    setAnalysis(SAMPLE_ANALYSIS);
    setMode("surge");
    setScenarioRainfall(64);
    setWaterwayContext(waterwayContextForSite(INITIAL_SITES[0]));
    setVerificationImageUrl(null);
    setVerificationFileName("");
    setVerificationResult(null);
    setVerificationStage("idle");
    setCleaned(false);
    setStage("idle");
    setRippleVersion((current) => current + 1);
  }

  function applyRainfallScenario(rainfallMm: number) {
    setScenarioRainfall(rainfallMm);
    setMode("surge");
    setRippleVersion((current) => current + 1);
  }

  function loadDemoScenario(scenario: DemoScenario, shouldScroll = true) {
    const demoWaterway: WaterwayContext = scenario.environmentalDistanceMeters === null
      ? UNAVAILABLE_WATERWAY
      : {
        status: "available",
        distanceMeters: scenario.environmentalDistanceMeters,
        source: "OpenStreetMap / Overpass",
        message: `Demo scenario: mapped water feature approximately ${scenario.environmentalDistanceMeters} m away.`,
      };
    const demoAnalysis: Analysis = {
      ...SAMPLE_ANALYSIS,
      blockage: scenario.blockage,
      litter: scenario.litter,
      confidence: scenario.id === "review" ? 55 : 88,
      drainConfidence: scenario.id === "review" ? 55 : 86,
      signal: "Demo scenario · controlled evidence",
    };
    const demoPriority = calculatePriorityScore({
      blockage: scenario.blockage,
      litter: scenario.litter,
      rainfallMm: scenario.rainfallMm,
      evidenceConfidence: demoAnalysis.confidence,
    });
    const demoEnvironmental = calculateEnvironmentalRisk({
      blockage: scenario.blockage,
      litter: scenario.litter,
      rainfallMm: scenario.rainfallMm,
      waterway: demoWaterway,
      evidenceConfidence: demoAnalysis.confidence,
    });
    const demoSite: MapSite = {
      ...INITIAL_SITES[0],
      id: `DEMO-${scenario.id.toUpperCase()}`,
      place: `${scenario.title} · Demo scenario`,
      risk: demoPriority.score,
      status: scenario.status,
      rainfall: scenario.rainfallMm,
      blockage: scenario.blockage,
      litter: scenario.litter,
      environmentalRisk: demoEnvironmental.score,
      environmentalLevel: demoEnvironmental.level,
      environmentalContext: demoWaterway.message,
      environmentalDistanceMeters: demoWaterway.distanceMeters,
      recommendedAction: recommendedAction(demoPriority.score, scenario.status === "Verified clear"),
      isDemo: true,
    };
    setAnalysis(demoAnalysis);
    setImageError("");
    setSelectedSite(demoSite);
    setSites((current) => [demoSite, ...current.filter((site) => !site.id.startsWith("DEMO-"))]);
    setWaterwayContext(demoWaterway);
    setScenarioRainfall(scenario.rainfallMm);
    setMode("surge");
    setImageUrl("/demo-drain.jpg");
    setFileName(`${scenario.title} · sample data`);
    setVerificationImageUrl(null);
    setVerificationResult(null);
    setVerificationStage("idle");
    setCleaned(scenario.status === "Verified clear");
    setRippleVersion((current) => current + 1);
    if (shouldScroll) window.requestAnimationFrame(() => document.getElementById("inspect")?.scrollIntoView({ behavior: "smooth" }));
  }

  function setReviewDecision(site: MapSite, decision: "open" | "approved" | "request-photo") {
    setReviewDecisions((current) => ({ ...current, [site.id]: decision }));
    if (decision === "approved") {
      setSites((current) => current.map((item) => item.id === site.id ? {
        ...item,
        status: "Verified clear",
        recommendedAction: "Human-approved closure. Continue routine monitoring.",
      } : item));
      setSelectedSite((current) => current.id === site.id ? {
        ...current,
        status: "Verified clear",
        recommendedAction: "Human-approved closure. Continue routine monitoring.",
      } : current);
    } else if (decision === "request-photo") {
      setSites((current) => current.map((item) => item.id === site.id ? { ...item, status: "Needs review", recommendedAction: "Request a clearer same-drain after photo." } : item));
      setSelectedSite((current) => current.id === site.id ? { ...current, status: "Needs review", recommendedAction: "Request a clearer same-drain after photo." } : current);
    } else {
      keepReportOpen(site);
    }
  }

  const report = `RAINREADY FIELD BRIEF · ${selectedSite.id}\nCleanup priority: ${band.label.toUpperCase()} (${risk}/100) · queue position #${selectedRank}\nEnvironmental impact risk: ${environmentalResult.score}/100 (${environmentalResult.confidence} confidence · ${environmentalResult.coverage}% coverage)\nLocation: ${selectedSite.place} · ${selectedSite.lat.toFixed(4)}, ${selectedSite.lon.toFixed(4)}\nObserved blockage: ${effectiveAnalysis.blockage}%\nLitter signal: ${effectiveAnalysis.litter}%\nEnvironmental context: ${waterwayContext.message}\nVerification: ${cleaned ? `Passed · ${verificationResult?.reduction ?? 0} point obstruction reduction` : "Pending field evidence"}\nRainfall input: ${rainfall === null ? "Unavailable (not estimated)" : `${rainfall.toFixed(1)} mm / 24h`}\n\nRecommended action: ${action}\n\nDecision-support estimate only. This is not a flood prediction, hydrological model, pollution-volume estimate, or emergency alert.`;

  async function copyReport() {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const [newReportOpen,setNewReportOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [saveStatus,setSaveStatus]=useState("");
  const [linkedAsset,setLinkedAsset]=useState<Record<string,string>>({});
  useEffect(()=>{onReportsChange(sites.filter(site=>{const e=evidenceBySite[site.id];return !site.isDemo&&e?.beforeImage.startsWith("data:image/")&&(e.beforeAnalysis.drainConfidence??0)>=DRAIN_CONFIDENCE_THRESHOLD;}))},[sites,evidenceBySite,onReportsChange]);
  useEffect(()=>{try{const n=JSON.parse(cloudStorage.getItem("rainready-inspection-notes:v1")??"{}");if(n&&typeof n==='object'&&!Array.isArray(n))setNotes(n);const l=JSON.parse(cloudStorage.getItem("rainready-inspection-links:v1")??"{}");if(l&&typeof l==='object'&&!Array.isArray(l))setLinkedAsset(l)}catch{setSaveStatus("Notes could not be restored. Existing records were retained.")}},[]);
  const assetSignature=assetIds.join('|');
  useEffect(()=>{setLinkedAsset(current=>{const next=Object.fromEntries(Object.entries(current).map(([id,asset])=>[id,assetIds.includes(asset)?asset:'']));return JSON.stringify(current)===JSON.stringify(next)?current:next;});},[assetSignature]);
  useEffect(()=>{if(persistenceReady&&!storageBlocked)cloudStorage.setItem('rainready-inspection-links:v1',JSON.stringify(linkedAsset));},[linkedAsset,persistenceReady,storageBlocked]);
  const [newAsset,setNewAsset]=useState("RR-027");
  const newAssetValue=networkAssets.some(a=>a.id===newAsset)?newAsset:(networkAssets[0]?.id??"");
  function createAssetReport(){
    const a=networkAssets.find(a=>a.id===newAssetValue);if(!a)return;
    const site:MapSite={id:`INS-${String(nextLocationId.current++).padStart(3,'0')}`,place:`${a.id} · ${a.name}`,lat:a.lat,lon:a.lon,risk:0,status:"Needs review",isDemo:false,recommendedAction:"Upload a before photo for this asset."};
    const entry:EvidenceRecord={beforeImage:"/demo-drain.jpg",beforeName:"No photo yet",beforeAnalysis:{...SAMPLE_ANALYSIS,blockage:0,litter:0,confidence:0,drainConfidence:0,objects:[],signal:"No uploaded evidence for this location"},updatedAt:new Date().toISOString()};
    setSites(current=>[site,...current]);setEvidenceBySite(current=>({...current,[site.id]:entry}));setLinkedAsset(current=>({...current,[site.id]:a.id}));selectSite(site,entry);setNewReportOpen(false);setSaveStatus("Report created. Add a before photo to begin the inspection.");
  }
  const hasBeforePhoto=Boolean(selectedSite.isDemo||evidenceBySite[selectedSite.id]?.beforeImage.startsWith("data:image/"));
  const beforeBusy=stage==='loading'||stage==='detecting';
  const filtered=sites.filter(s=>(s.id+" "+s.place).toLowerCase().includes(search.toLowerCase())&&(filter==='all'||(filter==='verified'?s.status==='Verified clear':s.status==='Needs review')));
  return <section className="inspection-page">
    <header className="workspace-title"><div><h1>Inspections</h1><p>Keep every photo connected to the right drain.</p></div><button className="primary" onClick={()=>{setNewReportOpen(true);setLocationInput('');setTimeout(()=>document.getElementById('new-inspection-location')?.focus(),0)}}>New inspection ＋</button></header>
    {storageWarning&&<p className="warning" role="alert">{storageWarning}</p>}
    {newReportOpen&&<form className="inspection-location" onSubmit={locateGarbage}><div className="new-report-options"><label htmlFor="new-report-asset">From your network</label><select id="new-report-asset" aria-label="New inspection asset" value={newAssetValue} onChange={e=>setNewAsset(e.target.value)}>{networkAssets.map(a=><option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}</select><button type="button" onClick={createAssetReport}>Create for this asset</button></div><label htmlFor="new-inspection-location">Or find a location</label><input id="new-inspection-location" placeholder="Place name or latitude, longitude" value={locationInput} onChange={e=>setLocationInput(e.target.value)} required/><button disabled={locating}>{locating?'Finding…':'Create at location'}</button><span role="status">{locationStatus}</span><button type="button" onClick={()=>setNewReportOpen(false)}>Close</button></form>}
    <section className="inspection-sheet"><header className="inspection-filters"><input aria-label="Search reports" placeholder="Search reports or location" value={search} onChange={e=>setSearch(e.target.value)}/>{[['all','All'],['review','Needs review'],['verified','Verified']].map(([k,v])=><button key={k} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{v} ({sites.filter(s=>k==='all'||(k==='verified'?s.status==='Verified clear':s.status==='Needs review')).length})</button>)}</header>
    <div className="inspection-columns"><aside className="report-list">{filtered.map(s=><button key={s.id} aria-current={s.id===selectedSite.id?'true':undefined} onClick={()=>{selectSite(s);setSaveStatus('')}}><strong>Report {s.id}<span>›</span></strong><small>{s.place}</small><small>Asset {assetIds.includes(linkedAsset[s.id])?linkedAsset[s.id]:'Not linked'}</small><span className={`status ${s.status==='Verified clear'?'approved':'review'}`}>{s.status}</span>{s.isDemo&&<small>Demonstration report</small>}</button>)}{!filtered.length&&<p className="muted">No matching reports.</p>}<small>{sites.length} reports in your demo</small></aside>
    <div className="inspection-detail"><p className="report-crumb">Report {selectedSite.id} · Asset {assetIds.includes(linkedAsset[selectedSite.id])?linkedAsset[selectedSite.id]:'Not linked'}</p><h2>Review the evidence</h2><div className="photo-pair"><section><h3>Before inspection</h3>{hasBeforePhoto?<div className="inspection-photo"><NextImage src={imageUrl} alt="Before inspection evidence" loading="eager" fill sizes="(max-width:800px) 90vw,35vw" unoptimized/></div>:<button className="before-empty" onClick={()=>fileInput.current?.click()} disabled={beforeBusy}><span>↥</span><strong>Add the before photo</strong><small>JPG, PNG or WEBP · up to 12 MB</small></button>}<small>{selectedSite.isDemo?'Attributed US sample · illustrative':fileName}</small>{hasBeforePhoto?<div className="photo-analysis"><span>Drain evidence confidence <b>{analysis.drainConfidence??0}%</b></span><span>Blockage proxy <b>{analysis.blockage}%</b></span><small>{analysis.signal} · confirm on site</small></div>:<p className="empty-photo-caption">Waiting for evidence. No condition estimate has been applied to this report.</p>}<button onClick={()=>fileInput.current?.click()} disabled={stage==='loading'||stage==='detecting'}>{stage==='loading'||stage==='detecting'?'Analysing photo…':'Upload before photo'}</button></section>
    <section><h3>After maintenance</h3>{verificationImageUrl?<div className="inspection-photo"><NextImage src={verificationImageUrl} alt="After maintenance evidence" fill sizes="(max-width:800px) 90vw,35vw" unoptimized/></div>:<button className="after-upload" disabled={!hasBeforePhoto||beforeBusy} onClick={()=>verificationInput.current?.click()}><span>↥</span><strong>Add the after photo</strong><span className="upload-cta">Upload from device</span></button>}<div className={`verification-status ${verificationResult&&!verificationResult.verified?'failed':''}`} role="status"><b>{verificationStage==='loading'||verificationStage==='detecting'?'Checking evidence…':verificationResult?.verified?'Improvement verified':verificationResult?'Verification needs review':'Verification pending'}</b><p>{verificationResult?verificationResult.signal:'Add a photo after maintenance to check for improvement.'}</p></div>{verificationImageUrl&&<button onClick={()=>verificationInput.current?.click()}>Replace after photo</button>}{verificationResult&&!verificationResult.verified&&<p className="fine-print">Asset condition unchanged. A duplicate image or an unconfirmed scene cannot prove improvement.</p>}</section></div>
    <input hidden ref={fileInput} aria-label="Before photo file" type="file" accept="image/*" onChange={chooseImage}/><input hidden ref={verificationInput} aria-label="After photo file" type="file" accept="image/*" onChange={chooseVerificationImage}/>{imageError&&<p role="alert" className="warning">{imageError}</p>}
    <div className="inspection-fields"><label>Linked asset<select aria-label="Linked asset ID" value={assetIds.includes(linkedAsset[selectedSite.id])?linkedAsset[selectedSite.id]:''} onChange={e=>setLinkedAsset({...linkedAsset,[selectedSite.id]:e.target.value})}><option value="">Choose asset</option>{assetIds.map(id=><option key={id} value={id}>{id}</option>)}</select></label><span className="fine-print">Location association only. Apply eligible evidence explicitly in Storm plan.</span><label className="notes-label">Inspector notes<textarea aria-label="Inspector notes" placeholder="Add notes about the inspection, condition or maintenance work…" value={notes[selectedSite.id]??''} onChange={e=>setNotes({...notes,[selectedSite.id]:e.target.value})}/></label></div>
    <div className="inspection-actions"><button onClick={()=>{setReviewDecision(selectedSite,'open');setSaveStatus('Report kept open for review.')}}>Keep as draft</button><span role="status">{saveStatus}</span><button className="primary" onClick={()=>{if(linkedAsset[selectedSite.id]&&!assetIds.includes(linkedAsset[selectedSite.id])){setSaveStatus('Choose an asset ID from the current network.');return;}try{cloudStorage.setItem('rainready-inspection-notes:v1',JSON.stringify(notes));cloudStorage.setItem('rainready-inspection-links:v1',JSON.stringify(linkedAsset));setSaveStatus('Notes and asset link saved in your browser.')}catch{setSaveStatus('Could not save notes. Download your backup.')}}}>Save inspection</button><button disabled={!verificationResult?.verified||selectedSite.isDemo} onClick={()=>{setReviewDecision(selectedSite,'approved');setSaveStatus('Verified report closed after human review.')}}>Approve & close</button></div><p className="fine-print">Image estimates require human review. Photo verification does not automatically change the drainage network.</p><details><summary>Model, limitations and field brief</summary><p>Visual obstruction is an estimate, not hydraulic capacity. Research ResNet-50 blockage classifier and optional COCO-SSD detection are research aids; their held-out research evaluation is not claimed Malaysian township street-drain accuracy. Model downloads may be unavailable; the signal above identifies the path actually used. After photos require the same scene and meaningful improvement. This system does not predict floods.</p><p>Sample source: <a href="https://www.michigan.gov/egle/about/organization/water-resources/stormwater" target="_blank" rel="noreferrer">Michigan EGLE stormwater illustration ↗</a></p><pre className="field-brief">{report}</pre><button onClick={copyReport}>{copied?'Copied ✓':'Copy field brief'}</button></details>
    </div></div></section>
  </section>;
}



