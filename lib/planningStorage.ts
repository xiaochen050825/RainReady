import {validateRoadTimes,coordinateKey,type RoadTimes} from "./roadTimes.ts";
import type { Network } from "./network/types.ts";
import { validateNetwork } from "./network/graph.ts";
export const PLANNING_KEY = "rainready-planning:v1";
export type PlanningSnapshot = { version: 1; network: Network; selectedId: string; rain: number | null; crewCount: number; hours: number; shiftHours: number; delay: number; weather: string; approval: string;roadTimes?:RoadTimes };
export function validatePlanning(value: unknown): PlanningSnapshot {
  if (!value || typeof value !== "object") throw new Error("Saved planning data is not an object.");
  const x=value as PlanningSnapshot;
  if(x.version!==1)throw new Error("Unsupported planning storage version.");
  validateNetwork(x.network);
  if(!x.network.nodes.some(a=>a.id===x.selectedId)||typeof x.weather!=="string"||x.weather.length>2000||typeof x.approval!=="string"||x.approval.length>2000000)throw new Error("Invalid saved selection, weather or approval.");
  if(x.rain!==null && (typeof x.rain!=="number"||!Number.isFinite(x.rain)||x.rain<0||x.rain>10000))throw new Error("Invalid saved rainfall.");
  if(!Number.isInteger(x.crewCount)||x.crewCount<0||x.crewCount>6||!Number.isFinite(x.hours)||x.hours<0.5||x.hours>8||!Number.isInteger(x.hours*2)||![1,2,4,8].includes(x.shiftHours)||![0,30,60,120].includes(x.delay))throw new Error("Invalid saved crew configuration.");
  if(x.roadTimes){validateRoadTimes(x.roadTimes);const base={lat:Math.max(-90,x.network.nodes[0].lat-0.001),lon:x.network.nodes[0].lon};if([...x.network.nodes,base].some(p=>!x.roadTimes!.points.includes(coordinateKey(p))))throw new Error("Saved road times do not cover this network.");}
  return x;
}
export function readPlanning(storage: Pick<Storage,"getItem">) {
  const raw=storage.getItem(PLANNING_KEY);
  if(raw===null)return {raw,snapshot:null};
  if(raw.length>3000000)throw new Error("Saved planning payload too large; retained without modification.");
  return {raw,snapshot:validatePlanning(JSON.parse(raw))};
}
export function savePlanning(storage: Pick<Storage,"getItem"|"setItem">, snapshot: PlanningSnapshot, expectedRaw: string|null) {
  validatePlanning(snapshot);
  if(storage.getItem(PLANNING_KEY)!==expectedRaw)throw new Error("Another tab changed the saved plan. Reload before editing; this tab has not overwritten it.");
  const raw=JSON.stringify(snapshot);
  if(raw.length>3000000)throw new Error("Plan too large to save locally. Export the JSON instead.");
  storage.setItem(PLANNING_KEY,raw);
  return raw;
}
