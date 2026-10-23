import test from 'node:test';import assert from 'node:assert/strict';
const origin=process.env.RAINREADY_TEST_ORIGIN||'http://127.0.0.1:5174';
test('cloud baseline is readable but all public mutation attempts leave it unchanged',async()=>{
 const initial=await (await fetch(origin+'/api/workspace')).json();assert.ok(initial.values);assert.equal(JSON.parse(initial.values['rainready-planning:v1']).crewCount,2);
 for(const method of ['PUT','POST','PATCH','DELETE'])for(const caller of [origin,'https://elsewhere.example']){
  const r=await fetch(origin+'/api/workspace',{method,headers:{'Content-Type':'application/json',Origin:caller},body:JSON.stringify({revision:initial.revision,values:{}})});assert.ok([403,405].includes(r.status),`${method} unexpectedly returned ${r.status}`);
 }
 const after=await (await fetch(origin+'/api/workspace')).json();assert.deepEqual(after,initial);
 const revision=await (await fetch(origin+'/api/workspace?revisionOnly=1')).json();assert.equal(revision.revision,initial.revision);assert.equal(revision.values,undefined);
});
