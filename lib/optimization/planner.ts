import type { Asset, Network, Priority } from "../network/types.ts";
import { validateNetwork } from "../network/graph.ts";
import {roadTravelMinutes,validateRoadTimes,type RoadTimes} from '../roadTimes.ts';
export type Crew = { id: string; availableFrom: number; minutes: number; equipment: string[] };
export type PlanOptions = { crews: Crew[]; deadline: number; depot: { lat: number; lon: number }; method: "fixed" | "severity" | "rainready"; rawPriority?: boolean; marginalGain?: (selected: Set<string>, candidate: string) => number;roadTimes?:RoadTimes };
export type Task = { id: string; travel: number; start: number; finish: number; benefit: number };
export type Plan = { crews: { id: string; tasks: Task[]; returnTravel: number; finish: number }[]; deferred: { id: string; reason: string }[] };
export function travelMinutes(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const d = Math.sin((a.lat - b.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((a.lon - b.lon) * rad / 2) ** 2;
  const km = 12742 * Math.asin(Math.min(1, Math.sqrt(d)));
  return Math.ceil(km * 1.4 / 20 * 60); // Great-circle × 1.4 detour / 20 km/h, not a road route.
}
export function planCrews(network: Network, priorities: Priority[], options: PlanOptions): Plan {
  validateNetwork(network);
  if(options.roadTimes)validateRoadTimes(options.roadTimes);
  const travel=(a:{lat:number;lon:number},b:{lat:number;lon:number})=>options.roadTimes?roadTravelMinutes(options.roadTimes,a,b):travelMinutes(a,b);
  if (!["fixed", "severity", "rainready"].includes(options.method) || !Number.isFinite(options.depot.lat) || Math.abs(options.depot.lat) > 90 || !Number.isFinite(options.depot.lon) || Math.abs(options.depot.lon) > 180 || priorities.some(p => !Number.isFinite(p.value) || p.value < 0)) throw new Error("Invalid planning method, depot or intervention value.");
  if (!Number.isFinite(options.deadline) || options.deadline < 0 || !Array.isArray(options.crews) || new Set(options.crews.map(c => c.id)).size !== options.crews.length || options.crews.some(c => !c.id || !Array.isArray(c.equipment) || c.equipment.some(e => typeof e !== "string") || !Number.isFinite(c.minutes) || c.minutes < 0 || !Number.isFinite(c.availableFrom) || c.availableFrom < 0)) throw new Error("Invalid crew availability or deadline.");
  if (priorities.length !== network.nodes.length || new Set(priorities.map(p => p.id)).size !== network.nodes.length || network.nodes.some(a => !priorities.some(p => p.id === a.id))) throw new Error("Every asset requires exactly one priority; missing data cannot become zero value.");
  const values = new Map(priorities.map(p => [p.id, p.value]));
  const index = new Map(network.nodes.map((a, i) => [a.id, i]));
  const remaining = new Map(network.nodes.map(a => [a.id, a]));
  const completed = new Map<string, number>();
  const crews = options.crews.map(c => ({ id: c.id, tasks: [] as Task[], returnTravel: 0, finish: c.availableFrom, position: options.depot, limit: Math.min(options.deadline, c.availableFrom + c.minutes), equipment: c.equipment }));
  for (;;) {
    const gains = new Map([...remaining.keys()].map(id => [id, options.marginalGain ? options.marginalGain(new Set(completed.keys()), id) : values.get(id)!]));
    const candidates: { asset: Asset; crew: typeof crews[number]; travel: number; start: number; finish: number; score: number }[] = [];
    for (const a of remaining.values()) for (const crew of crews) {
      if (options.marginalGain && (!Number.isFinite(gains.get(a.id)) || gains.get(a.id)! <= 1e-9)) continue;
      if (!a.accessible || (a.equipment && !crew.equipment.includes(a.equipment)) || (a.dependsOn ?? []).some(id => !completed.has(id))) continue;
      const travelTime = travel(crew.position, a);
      const start = Math.max(crew.finish + travelTime, ...(a.dependsOn ?? []).map(id => completed.get(id)!));
      const finish = start + a.duration;
      if (finish + travel(a, options.depot) > crew.limit) continue;
      const score = options.method === "fixed" ? network.nodes.length - index.get(a.id)! : options.method === "severity" ? a.blockage ?? 50 : gains.get(a.id)! / (options.rawPriority ? 1 : finish - crew.finish + travel(a, options.depot));
      candidates.push({ asset: a, crew, travel:travelTime, start, finish, score });
    }
    candidates.sort((a, b) => b.score - a.score || a.finish - b.finish || a.asset.id.localeCompare(b.asset.id) || a.crew.id.localeCompare(b.crew.id));
    const best = candidates[0]; if (!best) break;
    best.crew.tasks.push({ id: best.asset.id, travel: best.travel, start: best.start, finish: best.finish, benefit: gains.get(best.asset.id)! });
    best.crew.finish = best.finish; best.crew.position = best.asset;
    completed.set(best.asset.id, best.finish); remaining.delete(best.asset.id);
  }
  return { crews: crews.map(c => ({ id: c.id, tasks: c.tasks, returnTravel: travel(c.position, options.depot), finish: c.tasks.length ? c.finish + travel(c.position, options.depot) : 0 })), deferred: [...remaining.values()].map(a => ({ id: a.id, reason: !a.accessible ? "Access restricted" : !crews.length ? "No crews available" : a.equipment && !crews.some(c => c.equipment.includes(a.equipment!)) ? `Requires ${a.equipment}` : (a.dependsOn ?? []).some(id => !completed.has(id)) ? "Dependency not scheduled" : crews.every(c => c.limit <= options.crews.find(x => x.id === c.id)!.availableFrom) ? "No crew working time before deadline" : "Cannot fit travel, service, dependency waiting and return before crew limit / storm deadline" })) };
}
