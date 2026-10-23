import test from "node:test";
import assert from "node:assert/strict";
import { createTownship } from "../lib/network/demo.ts";
import { validateNetwork, upstreamSets } from "../lib/network/graph.ts";
import { rankNetwork } from "../lib/network/criticality.ts";
import { planCrews } from "../lib/optimization/planner.ts";
import { runBatch, compare, consequence } from "../lib/simulation/evaluation.ts";
import { readPilot, PILOT_STORAGE_KEY, LEGACY_STORAGE_KEYS } from "../lib/storage.ts";
const options = { crews: [{ id:"A", availableFrom:0, minutes:120, equipment:[] }, { id:"B", availableFrom:20, minutes:80, equipment:[] }], deadline:100, depot:{lat:3.079,lon:101.49}, method:"rainready" };
test("28-node graph validates and unique traversal reaches all ancestors", () => {
  const n=createTownship(); assert.equal(validateNetwork(n).nodes.length,28); assert.equal(upstreamSets(n).get("RR-028").size,27);
  n.edges.push({from:"RR-001",to:"RR-027"}); assert.equal(upstreamSets(n).get("RR-028").size,27);
});
test("rejects duplicates, malformed numbers, missing references and cycles", () => {
  for(const mutate of [n=>n.nodes.push(n.nodes[0]), n=>n.nodes[0].lat=NaN,n=>n.nodes[0].blockage=101,n=>n.edges.push({from:"missing",to:"RR-001"}),n=>n.edges.push({from:"RR-028",to:"RR-001"}),n=>n.nodes[0].dependsOn=["RR-001"],n=>n.nodes[0].dependsOn=["missing"]]) { const n=createTownship(); mutate(n); assert.throws(()=>validateNetwork(n)); }
});
test("network-critical moderate collector outranks severely blocked minor inlet",()=>{
 const p=rankNetwork(createTownship(),64); assert.ok(p.find(x=>x.id==="RR-027").value>p.find(x=>x.id==="RR-001").value);
});
test("rainfall changes priority order and scheduled work, not just display numbers",()=>{
 const n=createTownship();const dry=rankNetwork(n,0),wet=rankNetwork(n,100);
 assert.notDeepEqual(dry.map(p=>p.id),wet.map(p=>p.id));
 const opts={...options,deadline:120,crews:[{id:"A",availableFrom:0,minutes:120,equipment:[]}]};
 assert.notDeepEqual(planCrews(n,dry,opts).crews.flatMap(c=>c.tasks.map(t=>t.id)),planCrews(n,wet,opts).crews.flatMap(c=>c.tasks.map(t=>t.id)));
});
test("condition and connectivity changes alter priorities; missing rain lowers confidence",()=>{
 const n=createTownship(); const before=rankNetwork(n,64).find(x=>x.id==="RR-027");
 n.nodes.find(a=>a.id==="RR-027").blockage=0; assert.equal(rankNetwork(n,64).find(x=>x.id==="RR-027").value,0);
 n.nodes.find(a=>a.id==="RR-027").blockage=62; n.edges=[]; assert.ok(rankNetwork(n,64).find(x=>x.id==="RR-027").value<before.value);
 const unknown=rankNetwork(n,null)[0]; assert.ok(unknown.limitations.some(x=>x.includes("unavailable"))); assert.ok(unknown.confidence<0.8);
});
test("planner respects deadlines, availability, shift length, return travel and uniqueness",()=>{
 const n=createTownship(); const plan=planCrews(n,rankNetwork(n,64),options); const ids=plan.crews.flatMap(c=>c.tasks.map(t=>t.id));
 assert.equal(new Set(ids).size,ids.length); assert.equal(ids.length+plan.deferred.length,28);
 for(const c of plan.crews){const source=options.crews.find(x=>x.id===c.id); assert.ok(c.finish<=Math.min(options.deadline,source.availableFrom+source.minutes)); let previous=source.availableFrom; for(const t of c.tasks){assert.ok(t.start>=previous+t.travel);assert.equal(t.finish-t.start,n.nodes.find(a=>a.id===t.id).duration);previous=t.finish;}}
 assert.equal(planCrews(n,rankNetwork(n,64),{...options,deadline:0}).crews.flatMap(c=>c.tasks).length,0);
});
test("access, equipment and temporal dependencies constrain scheduling",()=>{
 const n=createTownship();n.nodes[0].accessible=false;n.nodes[1].equipment="jetter";n.nodes[2].dependsOn=[n.nodes[0].id];
 const plan=planCrews(n,rankNetwork(n,64),options);for(const id of ["RR-001","RR-002","RR-003"])assert.ok(plan.deferred.some(x=>x.id===id));
 const small={...n,nodes:n.nodes.slice(3,5),edges:[]};small.nodes[1].dependsOn=[small.nodes[0].id];
 const p=planCrews(small,rankNetwork(small,64),{...options,deadline:240,crews:options.crews.map(c=>({...c,minutes:240}))});const tasks=p.crews.flatMap(c=>c.tasks);assert.equal(tasks.length,2);assert.ok(tasks.find(t=>t.id===small.nodes[1].id).start>=tasks.find(t=>t.id===small.nodes[0].id).finish);
});
test("simulation is seeded and comparisons use identical budgets without mutating inputs",()=>{
 assert.deepEqual(runBatch(8,42),runBatch(8,42));assert.notDeepEqual(runBatch(8,42),runBatch(8,43));
 const n=createTownship(), snapshot=JSON.stringify(n);const rows=compare(n,64,{...options,deadline:0});assert.equal(rows.length,3);assert.ok(rows.every(r=>r.tasks===0&&r.addressed===0));assert.equal(JSON.stringify(n),snapshot);
 assert.equal(consequence(n,0,new Set()),0);
});
test("legacy migration preserves original data, rejects invalid input and survives quota failure",()=>{
 const payload={version:2,sites:[{id:"DG-1",place:"Original location",status:"Needs review",risk:80,lat:12,lon:77}],evidence:{}};
 const map=new Map([[LEGACY_STORAGE_KEYS[0],JSON.stringify(payload)]]);const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 const saved=JSON.parse(readPilot(storage));assert.equal(saved.version,3);assert.equal(saved.sites[0].lat,12);assert.ok(map.has(PILOT_STORAGE_KEY));assert.ok(map.has(LEGACY_STORAGE_KEYS[0]));
 map.delete(PILOT_STORAGE_KEY);assert.throws(()=>readPilot({...storage,setItem:()=>{throw Error("Quota");}}));assert.ok(map.has(LEGACY_STORAGE_KEYS[0]));
 map.set(LEGACY_STORAGE_KEYS[0],'{"version":3,"sites":[{}]}');assert.throws(()=>readPilot(storage));assert.ok(!map.has(PILOT_STORAGE_KEY));
});
