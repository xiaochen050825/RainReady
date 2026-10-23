import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoValues,NOTES_KEY} from '../lib/demoScenario.ts';
import {cloudStorage,loadCloud,flushCloud,cloudState,hasUnsavedChanges,workspaceBackup,restoreCloud,resetDemo,PERSONAL_KEY} from '../lib/cloudStore.ts';
test('personal demos isolate visitors, survive reload and reset, reject conflicts and recover storage failures without any cloud writes',async()=>{
 const oldFetch=globalThis.fetch,seed=createDemoValues();let writes=0,fail=false;
 const diskA=new Map(),diskB=new Map();
 const target=disk=>({getItem:k=>disk.get(k)??null,setItem:(k,v)=>{if(fail)throw new Error('Quota');disk.set(k,v)}});
 globalThis.fetch=async(_url,options)=>{if(options?.method&&options.method!=='GET')writes++;return Response.json({revision:1,values:seed});};
 try{
  await loadCloud(target(diskA));cloudStorage.setItem(NOTES_KEY,'{"INS-001":"Visitor A"}');await flushCloud();assert.equal(hasUnsavedChanges(),false);const backup=workspaceBackup();
  await loadCloud(target(diskB));assert.equal(cloudStorage.getItem(NOTES_KEY),'{}');cloudStorage.setItem(NOTES_KEY,'{"INS-001":"Visitor B"}');await flushCloud();
  await loadCloud(target(diskA));assert.equal(cloudStorage.getItem(NOTES_KEY),'{"INS-001":"Visitor A"}');
  fail=true;cloudStorage.setItem(NOTES_KEY,'{"INS-001":"Unsaved draft"}');await flushCloud();assert.equal(cloudState().status,'error');assert.equal(hasUnsavedChanges(),true);
  const draft=workspaceBackup();await assert.rejects(()=>restoreCloud(backup));assert.deepEqual(workspaceBackup().values,draft.values);fail=false;await flushCloud();assert.equal(cloudState().status,'saved');
  await restoreCloud(backup);assert.equal(cloudStorage.getItem(NOTES_KEY),'{"INS-001":"Visitor A"}');await resetDemo();assert.deepEqual(workspaceBackup().values,seed);
  await loadCloud(target(diskB));assert.equal(cloudStorage.getItem(NOTES_KEY),'{"INS-001":"Visitor B"}');
  diskB.set(PERSONAL_KEY,JSON.stringify({version:2,values:seed}));cloudStorage.setItem(NOTES_KEY,'{"INS-001":"Conflicting draft"}');await flushCloud();assert.equal(cloudState().status,'conflict');await assert.rejects(()=>restoreCloud(backup));assert.equal(hasUnsavedChanges(),true);
  await loadCloud(target(diskB));assert.equal(cloudStorage.getItem(NOTES_KEY),'{}');
  await assert.rejects(()=>restoreCloud({format:'bad',version:1,values:seed}));
  assert.equal(writes,0);assert.equal(seed[NOTES_KEY],'{}');
 }finally{globalThis.fetch=oldFetch;}
});
