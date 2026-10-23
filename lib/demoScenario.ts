import {createTownship} from './network/demo.ts';
import {PLANNING_KEY,validatePlanning} from './planningStorage.ts';
import {PILOT_STORAGE_KEY,validatePilot} from './storage.ts';
import type {MapSite} from '../app/DrainMap';
export const BASELINE_OWNER='public-demo-baseline-v2';
export const NOTES_KEY='rainready-inspection-notes:v1';
export const LINKS_KEY='rainready-inspection-links:v1';
export function demoPlanning(crewCount=2){return validatePlanning({version:1,network:createTownship(),selectedId:'RR-027',rain:64,crewCount,hours:2,shiftHours:4,delay:0,weather:'Simulated rainfall scenario · not a forecast',approval:''});}
export const DEMO_LINKS:Record<string,string>={'INS-001':'RR-001','INS-002':'RR-007','INS-003':'RR-013','INS-004':'RR-019'};
export function demoInspections():MapSite[]{
 const network=createTownship();
 return Object.entries(DEMO_LINKS).map(([id,assetId])=>{
  const asset=network.nodes.find(a=>a.id===assetId)!;
  return {id,place:asset.name,lat:asset.lat,lon:asset.lon,risk:0,status:'Needs review',blockage:asset.blockage??0,litter:0,rainfall:64,isDemo:true,photo:'/demo-drain.jpg',recommendedAction:'Illustrative report. Upload site evidence and review before taking action.'};
 });
}
export function createDemoValues():Record<string,string>{return {
 [PLANNING_KEY]:JSON.stringify(demoPlanning()),
 [PILOT_STORAGE_KEY]:JSON.stringify({version:3,sites:demoInspections(),evidence:{},reviewDecisions:{}}),
 [LINKS_KEY]:JSON.stringify(DEMO_LINKS),[NOTES_KEY]:'{}',
};}
// Preserve legacy report evidence and notes while separating report and asset IDs.
export function validateDemoValues(input:unknown):Record<string,string>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid workspace backup.');
 const values={...input} as Record<string,string>;
 const allowed=new Set([PLANNING_KEY,PILOT_STORAGE_KEY,NOTES_KEY,LINKS_KEY]);
 for(const [k,v] of Object.entries(values))if(!allowed.has(k)||typeof v!=='string')throw new Error('Unsupported workspace data.');
 const planning=values[PLANNING_KEY]?validatePlanning(JSON.parse(values[PLANNING_KEY])):demoPlanning();
 const ids=new Map<string,string>();
 if(values[PILOT_STORAGE_KEY]){
  const pilot=validatePilot(JSON.parse(values[PILOT_STORAGE_KEY])) as Record<string,unknown> & {version:number;sites:MapSite[]};
  const sites=pilot.sites as MapSite[];
  const used=new Set(sites.filter(s=>s.id.startsWith('INS-')).map(s=>s.id));let n=1;
  for(const s of sites){let id=s.id;if(!id.startsWith('INS-')){while(used.has(`INS-${String(n).padStart(3,'0')}`))n++;id=`INS-${String(n++).padStart(3,'0')}`;used.add(id);}ids.set(s.id,id);}
  const remap=(map:Record<string,unknown>)=>Object.fromEntries(Object.entries(map).map(([k,v])=>[ids.get(k)??k,v]));
  values[PILOT_STORAGE_KEY]=JSON.stringify({...pilot,sites:sites.map(s=>({...s,id:ids.get(s.id)})),evidence:remap((pilot.evidence??{}) as Record<string,unknown>),reviewDecisions:remap((pilot.reviewDecisions??{}) as Record<string,unknown>)});
 }
 for(const key of [NOTES_KEY,LINKS_KEY])if(values[key]){
  const map=JSON.parse(values[key]);
  if(!map||typeof map!=='object'||Array.isArray(map)||Object.values(map).some(v=>typeof v!=='string'))throw new Error('Invalid inspection notes or asset links.');
  if(key===LINKS_KEY&&Object.values(map).some(id=>id&&!planning.network.nodes.some(a=>a.id===id)))throw new Error('An inspection refers to an asset outside this network.');
  values[key]=JSON.stringify(Object.fromEntries(Object.entries(map).map(([k,v])=>[ids.get(k)??k,v])));
 }
 return values;
}
