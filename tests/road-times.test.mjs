import test from 'node:test';
import assert from 'node:assert/strict';
import {createTownship} from '../lib/network/demo.ts';
import {rankNetwork} from '../lib/network/criticality.ts';
import {planCrews} from '../lib/optimization/planner.ts';
import {coordinateKey,roadTravelMinutes,validateRoadTimes} from '../lib/roadTimes.ts';
const network=createTownship(),depot={lat:3.079,lon:101.49};const points=[...network.nodes,depot].map(coordinateKey);
const options={deadline:120,depot,crews:[{id:'A',availableFrom:0,minutes:240,equipment:[]}],method:'rainready'};
test('road-based planning respects road return times and cannot use an unreachable stop',()=>{
 const roadTimes={points,minutes:points.map((_,i)=>points.map((_,j)=>i===j?0:100)),checkedAt:'2026-10-22T10:00:00Z'};
 const plan=planCrews(network,rankNetwork(network,64),{...options,roadTimes});assert.equal(plan.crews[0].tasks.length,0);assert.equal(plan.crews[0].returnTravel,0);
 const fast={...roadTimes,minutes:points.map((_,i)=>points.map((_,j)=>i===j?0:j===points.length-1?30:5))};
 fast.minutes[points.length-1][0]=null;
 const feasible=planCrews(network,rankNetwork(network,64),{...options,roadTimes:fast});const c=feasible.crews[0];assert.ok(c.tasks.length>0);assert.equal(c.returnTravel,30);assert.ok(c.finish<=120);assert.ok(c.tasks.every(t=>t.id!==network.nodes[0].id||t.travel!==Infinity));
 assert.equal(roadTravelMinutes(fast,depot,network.nodes[0]),Infinity);
});
test('invalid or incomplete road times cannot silently fall back to distance estimates',()=>{
 assert.throws(()=>validateRoadTimes({points,minutes:[],checkedAt:''}));
 assert.throws(()=>roadTravelMinutes({points:['0,0','1,1'],minutes:[[0,1],[1,0]],checkedAt:''},depot,network.nodes[0]),/cover/);
});
