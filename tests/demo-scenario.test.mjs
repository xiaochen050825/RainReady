import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoValues,demoPlanning,validateDemoValues,LINKS_KEY,NOTES_KEY} from '../lib/demoScenario.ts';
import {PLANNING_KEY} from '../lib/planningStorage.ts';
import {PILOT_STORAGE_KEY} from '../lib/storage.ts';
test('the homepage and cloud baseline share one scenario; reports link to real assets at the same coordinates',()=>{
 const values=createDemoValues(),plan=JSON.parse(values[PLANNING_KEY]),pilot=JSON.parse(values[PILOT_STORAGE_KEY]),links=JSON.parse(values[LINKS_KEY]);
 assert.deepEqual(plan,demoPlanning());assert.equal(plan.network.nodes.length,28);
 for(const report of pilot.sites){assert.match(report.id,/^INS-/);const asset=plan.network.nodes.find(a=>a.id===links[report.id]);assert.ok(asset);assert.equal(report.lat,asset.lat);assert.equal(report.lon,asset.lon);assert.equal(report.blockage,asset.blockage);assert.notEqual(report.status,'Verified clear');}
 assert.deepEqual(validateDemoValues(values),values);
});
test('legacy backup migration preserves notes, evidence associations and review decisions without ID collisions',()=>{
 const values=createDemoValues();const pilot=JSON.parse(values[PILOT_STORAGE_KEY]);pilot.sites[0].id='RR-104';pilot.reviewDecisions={'RR-104':'open'};
 values[PILOT_STORAGE_KEY]=JSON.stringify(pilot);values[NOTES_KEY]=JSON.stringify({'RR-104':'Keep this note'});values[LINKS_KEY]=JSON.stringify({'RR-104':'RR-001'});
 const migrated=validateDemoValues(values),report=JSON.parse(migrated[PILOT_STORAGE_KEY]);const id=report.sites[0].id;
 assert.equal(new Set(report.sites.map(s=>s.id)).size,4);assert.match(id,/^INS-/);assert.equal(JSON.parse(migrated[NOTES_KEY])[id],'Keep this note');assert.equal(JSON.parse(migrated[LINKS_KEY])[id],'RR-001');assert.equal(report.reviewDecisions[id],'open');
 assert.throws(()=>validateDemoValues({...values,[LINKS_KEY]:'{"RR-104":"RR-999"}'}));
});
