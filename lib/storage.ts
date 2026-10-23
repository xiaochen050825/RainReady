export const PILOT_STORAGE_KEY = "rainready-pilot:v3";
// Compatibility only: retain original source keys as a recoverable backup.
export const LEGACY_STORAGE_KEYS = ["drainguard-pilot:v2", "drainguard-pilot-v1"];
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function score(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100; }
function analysis(value: unknown): boolean { return object(value) && score(value.blockage) && score(value.litter) && score(value.confidence) && typeof value.signal === "string" && Array.isArray(value.objects) && value.objects.every(x => object(x) && typeof x.class === "string" && typeof x.score === "number" && Array.isArray(x.bbox) && x.bbox.length === 4 && x.bbox.every(Number.isFinite)); }
export function validatePilot(value: unknown) {
  if (!object(value) || ![1,2,3].includes(value.version as number) || !Array.isArray(value.sites) || !value.sites.length) throw new Error("Unsupported saved report format. Original storage retained.");
  const ids = new Set();
  for (const site of value.sites) {
    if (!object(site) || typeof site.id !== "string" || ids.has(site.id) || typeof site.place !== "string" || typeof site.status !== "string" || !score(site.risk) || typeof site.lat !== "number" || !Number.isFinite(site.lat) || Math.abs(site.lat) > 90 || typeof site.lon !== "number" || !Number.isFinite(site.lon) || Math.abs(site.lon) > 180) throw new Error("Invalid saved asset. Original storage retained.");
    ids.add(site.id);
  }
  if (value.evidence !== undefined) {
    if (!object(value.evidence)) throw new Error("Invalid evidence map.");
    for (const entry of Object.values(value.evidence)) {
      if (!object(entry) || typeof entry.beforeImage !== "string" || typeof entry.beforeName !== "string" || !analysis(entry.beforeAnalysis)) throw new Error("Invalid saved inspection evidence. Original storage retained.");
      if (entry.verification !== undefined && (!analysis(entry.verification) || !object(entry.verification) || typeof entry.verification.verified !== "boolean" || typeof entry.verification.sameDrain !== "boolean" || !score(entry.verification.sceneMatch))) throw new Error("Invalid saved verification. Original storage retained.");
    }
  }
  if (value.reviewDecisions !== undefined && (!object(value.reviewDecisions) || Object.values(value.reviewDecisions).some(v => !["open", "approved", "request-photo"].includes(v as string)))) throw new Error("Invalid saved review decisions.");
  return { ...value, version: 3 };
}
export function readPilot(storage: StorageAccess) {
  const current = storage.getItem(PILOT_STORAGE_KEY);
  if (current !== null) return JSON.stringify(validatePilot(JSON.parse(current)));
  for (const key of LEGACY_STORAGE_KEYS) {
    const old = storage.getItem(key);
    if (old !== null) {
      const migrated = JSON.stringify(validatePilot(JSON.parse(old)));
      storage.setItem(PILOT_STORAGE_KEY, migrated); // Failure leaves legacy data untouched.
      return migrated;
    }
  }
  return null;
}
