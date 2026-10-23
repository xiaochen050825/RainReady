import test from 'node:test';
import assert from 'node:assert/strict';
import { createTownship } from '../lib/network/demo.ts';
import { rankNetwork } from '../lib/network/criticality.ts';
import { planCrews } from '../lib/optimization/planner.ts';
import { ablationPlans, observedLoss } from '../lib/optimization/ablation.ts';
const options={deadline:120,depot:{lat:3.079,lon:101.49},crews:[{id:'A',availableFrom:0,minutes:120,equipment:[]}]};
test('experimental marginal gains telescope to observed mixed-model improvement without mutation',()=>{
 const n=createTownship(),copy=structuredClone(n),r=ablationPlans(n,64,options)[5],tasks=r.plan.crews.flatMap(c=>c.tasks),ids=new Set(tasks.map(t=>t.id));
 assert.ok(tasks.every(t=>t.benefit>0));assert.ok(Math.abs(tasks.reduce((s,t)=>s+t.benefit,0)-(observedLoss(n,64,new Set())-observedLoss(n,64,ids)))<1e-8);assert.deepEqual(n,copy);
});
test('ablation retains historical efficiency plan and uses identical priorities for common/efficiency',()=>{
 const n=createTownship(),rows=ablationPlans(n,64,options),p=rankNetwork(n,64);
 assert.deepEqual(rows[3].plan,planCrews(n,p,{...options,method:'rainready'}));assert.deepEqual(rows[2].plan,planCrews(n,p,{...options,method:'rainready',rawPriority:true}));
});
test('network-blind and network controls coincide on a graph without edges',()=>{
 const n={...createTownship(),edges:[]},r=ablationPlans(n,64,options);assert.deepEqual(r[2].plan,r[6].plan);assert.deepEqual(r[3].plan,r[4].plan);
});
test('experimental optimiser skips harmful singleton and dry marginal work',()=>{
 const n=createTownship();n.nodes=n.nodes.slice(0,2).map((a,i)=>({...a,id:i?'D':'U',catchment:i?0:4,blockage:i?80:90,homes:i?100:0,schools:0,accessRoutes:0,accessible:!i}));n.edges=[{from:'U',to:'D'}];
 const r=ablationPlans(n,40,options)[5];assert.equal(r.plan.crews[0].tasks.length,0);assert.match(r.plan.deferred.find(x=>x.id==='U').reason,/No positive observed mixed-model marginal gain/);
 assert.equal(ablationPlans(createTownship(),0,options)[5].plan.crews[0].tasks.length,0);
});
test('experimental bounds and no-crew constraints are explicit',()=>{
 const n=createTownship();for(const r of ablationPlans(n,64,{...options,crews:[]}))assert.equal(r.plan.deferred.length,28);
 const big={...n,nodes:Array.from({length:81},(_,i)=>({...n.nodes[0],id:`A${i}`})),edges:[]};assert.throws(()=>ablationPlans(big,64,options),/80 assets/);
});
