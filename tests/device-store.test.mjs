import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceStorage,loadDevice,saveDevice,deviceState,workspaceBackup,restoreDevice,hasUnsavedChanges} from '../lib/deviceStore.ts';
test('device saves are atomic, survive reload, reject conflicting tabs and recover quota failures without losing backups',()=>{
 const disk=new Map();let fail=false;const storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>{if(fail)throw new Error('Quota');disk.set(k,v)}};
 loadDevice(storage);deviceStorage.setItem('notes','{"a":"First note"}');saveDevice();assert.equal(deviceState().message,'Saved on this device');assert.equal(hasUnsavedChanges(),false);const backup=workspaceBackup();
 deviceStorage.setItem('notes','{"a":"Changed"}');saveDevice();loadDevice(storage);assert.equal(deviceStorage.getItem('notes'),' {"a":"Changed"}'.trim());
 restoreDevice(backup);assert.equal(deviceStorage.getItem('notes'),'{"a":"First note"}');
 fail=true;deviceStorage.setItem('notes','{"a":"Keep this draft"}');saveDevice();assert.equal(deviceState().status,'error');assert.equal(hasUnsavedChanges(),true);assert.equal(workspaceBackup().values.notes,'{"a":"Keep this draft"}');fail=false;saveDevice();assert.equal(deviceState().status,'saved');
 const key=[...disk.keys()][0];disk.set(key,JSON.stringify({version:1,revision:99,values:{notes:'"Another tab"'}}));deviceStorage.setItem('notes','"Current tab draft"');saveDevice();assert.equal(deviceState().status,'conflict');assert.equal(JSON.parse(disk.get(key)).revision,99);assert.equal(workspaceBackup().values.notes,'"Current tab draft"');loadDevice(storage);assert.equal(deviceStorage.getItem('notes'),'"Another tab"');
 const before=disk.get(key);assert.throws(()=>restoreDevice({format:'wrong',values:{}}));assert.equal(disk.get(key),before);
});
