export type Asset = {
  id: string; name: string; lat: number; lon: number;
  type: "inlet" | "channel" | "culvert" | "collector" | "outlet";
  blockage: number | null; confidence: number; catchment: number;
  homes: number; schools: number; accessRoutes: number;
  duration: number; accessible: boolean; history: string;
  equipment?: string; dependsOn?: string[];
};
export type Network = { name: string; synthetic: boolean; nodes: Asset[]; edges: { from: string; to: string }[] };
export type Priority = { id: string; value: number; p: number; c: number; e: number; upstream: number; catchment: number; exposure: number; confidence: number; limitations: string[] };
