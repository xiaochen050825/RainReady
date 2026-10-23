import { upstreamSets, validateNetwork } from "./graph.ts";
import type { Network, Priority } from "./types.ts";

export const NETWORK_POLICY = { rainScaleMm: 64, upstreamWeight: 0.12, catchmentWeight: 0.25, runoffWeight: 0.15, homeWeight: 0.02, schoolWeight: 1.5, accessWeight: 0.8, clearanceFraction: 0.85 };
export function rankNetwork(network: Network, rainfall: number | null, policy = NETWORK_POLICY): Priority[] {
  validateNetwork(network);
  if (rainfall !== null && (!Number.isFinite(rainfall) || rainfall < 0)) throw new Error("Rainfall must be nonnegative or null.");
  const sets = upstreamSets(network);
  return network.nodes.map(a => {
    const upstream = sets.get(a.id)!;
    const catchment = network.nodes.filter(n => n.id === a.id || upstream.has(n.id)).reduce((sum, n) => sum + n.catchment, 0);
    const exposure = a.homes * policy.homeWeight + a.schools * policy.schoolWeight + a.accessRoutes * policy.accessWeight;
    // Unknown obstruction uses an explicit inspection prior, never a fabricated observation.
    const p = (a.blockage ?? 50) / 100;
    const rain = rainfall === null ? 1 : 0.2 + Math.min(rainfall / policy.rainScaleMm, 3) * (0.35 + Math.sqrt(catchment) * policy.runoffWeight);
    const c = (1 + upstream.size * policy.upstreamWeight + Math.sqrt(catchment) * policy.catchmentWeight) * (1 + exposure) * rain;
    const e = policy.clearanceFraction * (0.5 + 0.5 * a.confidence);
    return { id: a.id, value: p * c * e, p, c, e, upstream: upstream.size, catchment, exposure, confidence: a.confidence * (rainfall === null ? 0.7 : 1) * (a.blockage === null ? 0.5 : 1), limitations: [...(rainfall === null ? ["Rainfall unavailable: neutral scenario multiplier; reduced confidence, not a forecast."] : []), ...(a.blockage === null ? ["Blockage unknown: 50% inspection prior."] : []), ...(a.confidence < 0.6 ? ["Low-quality condition evidence: inspect before clearance."] : [])] };
  }).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
}
