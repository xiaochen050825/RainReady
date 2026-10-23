import test from "node:test";
import assert from "node:assert/strict";
import { createTownship } from "../lib/network/demo.ts";
import { upstreamSets } from "../lib/network/graph.ts";
import { rankNetwork } from "../lib/network/criticality.ts";
import { consequenceTrace, consequence, measure, generateScenarios, compare } from "../lib/simulation/evaluation.ts";
import { planCrews } from "../lib/optimization/planner.ts";
import { readPlanning, savePlanning, PLANNING_KEY } from "../lib/planningStorage.ts";
const options={crews:[{id:"A",availableFrom:0,minutes:120,equipment:[]}],deadline:120,depot:{lat:3.079,lon:101.49},method:"rainready"};
const empty={crews:[],deferred:[]};
function small(){const n=createTownship();return {...n,nodes:n.nodes.slice(0,2).map((a,i)=>({...a,id:i?"D":"U",catchment:i?0:4,blockage:i?80:90,homes:i?100:0,schools:0,accessRoutes:0})),edges:[{from:"U",to:"D"}]};}
test("hand-computed downstream transfer example produces an authentic negative outcome",()=>{
 const n=small();const b=consequenceTrace(n,40,new Set()),a=consequenceTrace(n,40,new Set(["U"]));
 // U capacity .25 -> 2.375; D capacity .5; upstream flow transferred to higher exposure.
 assert.ok(Math.abs(b.loss-3.75)<1e-10);assert.ok(Math.abs(a.loss-12.875)<1e-10);
 assert.ok(a.loss>b.loss);assert.ok(consequence(n,40,new Set(["U","D"]))<a.loss);
 const localB=consequenceTrace(n,40,new Set(),"local");const localA=consequenceTrace(n,40,new Set(["U"]),"local");assert.ok(localA.loss<localB.loss);
});
test("zero denominators are undefined, tiny/clear obstruction is never increased, unknown truth rejects",()=>{
 const n=small();assert.equal(measure(n,0,empty).addressedPercent,null);
 n.nodes[0].blockage=0;assert.ok(consequence(n,40,new Set(["U"]))<=consequence(n,40,new Set()));
 n.nodes[0].blockage=2;assert.ok(consequence(n,40,new Set(["U"]))<=consequence(n,40,new Set()));
 n.nodes[0].blockage=null;assert.throws(()=>consequence(n,40,new Set()),/ground-truth/);
 assert.throws(()=>consequence(small(),-1,new Set()));
});
test("direction and reconvergent paths do not turn downstream nodes into ancestors",()=>{
 const n=createTownship();const s=upstreamSets(n);assert.equal(s.get("RR-001").size,0);assert.ok(s.get("RR-006").has("RR-001"));assert.ok(!s.get("RR-001").has("RR-006"));assert.ok(!s.get("RR-006").has("RR-012"));
 n.edges.push({from:"RR-001",to:"RR-025"});assert.equal(upstreamSets(n).get("RR-028").size,27);
});
test("minor inlet can outrank a moderately blocked collector when exposure justifies it",()=>{
 const n=createTownship();const a=n.nodes.find(a=>a.id==="RR-001"),c=n.nodes.find(a=>a.id==="RR-027");a.homes=500;a.schools=3;a.accessRoutes=3;c.homes=0;c.schools=0;c.accessRoutes=0;
 const scores=rankNetwork(n,24);assert.ok(scores.find(p=>p.id===a.id).value>scores.find(p=>p.id===c.id).value);assert.equal(c.blockage,62);
});
test("no crews and crews arriving after deadline produce accurate deferrals without phantom completion",()=>{
 const n=createTownship(),p=rankNetwork(n,64);const none=planCrews(n,p,{...options,crews:[]});assert.equal(none.deferred.length,28);assert.ok(none.deferred.every(d=>d.reason==="No crews available"));
 const late=planCrews(n,p,{...options,crews:[{...options.crews[0],availableFrom:150}]});assert.equal(late.crews[0].finish,0);assert.ok(late.deferred.every(d=>d.reason.includes("No crew working time")));
 assert.throws(()=>planCrews(n,p.slice(1),options),/Every asset/);
});
test("missing observed condition is a labelled prior and missing rain is not zero risk",()=>{
 const n=createTownship();n.nodes[0].blockage=null;const p=rankNetwork(n,null).find(p=>p.id===n.nodes[0].id);assert.equal(p.p,.5);assert.ok(p.value>0);assert.equal(p.limitations.length,2);assert.ok(p.confidence<.5);
});
test("baseline metrics share denominators and cannot mutate scenario observations",()=>{
 const s=generateScenarios(1,2026)[0],copy=JSON.stringify(s);const rows=compare(s.observed,s.rain,s.options,s.truth,s.truthRain);assert.equal(new Set(rows.map(r=>r.before)).size,1);assert.equal(JSON.stringify(s),copy);
});
function snapshot(){return {version:1,network:createTownship(),selectedId:"RR-027",rain:64,crewCount:2,hours:2,shiftHours:4,delay:0,weather:"Simulated scenario",approval:""};}
test("planning saves independently from reports, checks conflicts and never overwrites corrupt storage",()=>{
 const values=new Map([["rainready-pilot:v3","inspection data"]]);const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const s=snapshot();s.network.nodes[0].blockage=17;s.crewCount=0;s.rain=null;
 const raw=savePlanning(storage,s,null);assert.deepEqual(readPlanning(storage).snapshot,s);assert.equal(values.get("rainready-pilot:v3"),"inspection data");
 assert.throws(()=>savePlanning(storage,s,"stale"),/Another tab/);assert.equal(values.get(PLANNING_KEY),raw);
 values.set(PLANNING_KEY,"bad json");assert.throws(()=>readPlanning(storage));assert.equal(values.get(PLANNING_KEY),"bad json");
 assert.throws(()=>savePlanning({getItem:()=>null,setItem:()=>{throw Error("Quota");}},snapshot(),null),/Quota/);
});
test("planning validation rejects unsupported versions, invalid graph and out-of-range settings",()=>{
 for(const alter of [s=>s.version=2,s=>s.rain=-1,s=>s.crewCount=1.5,s=>s.hours=NaN,s=>s.delay=-1,s=>s.selectedId="missing",s=>s.network.edges.push({from:"RR-028",to:"RR-001"})]){const s=snapshot();alter(s);assert.throws(()=>readPlanning({getItem:()=>JSON.stringify(s)}));}
});
