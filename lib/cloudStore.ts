import {validateDemoValues} from './demoScenario.ts';
type SaveState={status:'loading'|'saved'|'saving'|'error'|'conflict';message:string};
type StorageAccess=Pick<Storage,'getItem'|'setItem'>;
export const PERSONAL_KEY='rainready-personal-demo:v2';
let values:Record<string,string>={},baseline:Record<string,string>={},revision=0,expected:string|null=null,storage:StorageAccess|undefined,dirty=false,timer:ReturnType<typeof setTimeout>|undefined;
let state:SaveState={status:'loading',message:'Loading demo…'};
const listeners=new Set<()=>void>();
function announce(status:SaveState['status'],message:string){state={status,message};listeners.forEach(f=>f());}
export const cloudStorage={
 getItem(key:string){return Object.hasOwn(values,key)?values[key]:null;},
 setItem(key:string,value:string){if(values[key]===value)return;values={...values,[key]:value};changed();},
 removeItem(key:string){if(!Object.hasOwn(values,key))return;const next={...values};delete next[key];values=next;changed();},
};
function changed(){dirty=true;if(state.status==='conflict')return;announce('saving','Saving in this browser…');clearTimeout(timer);timer=setTimeout(()=>void flushCloud(),400);}
export function subscribeCloud(callback:()=>void){listeners.add(callback);return()=>{listeners.delete(callback)};}
export function cloudState(){return state;}
export async function loadCloud(target?:StorageAccess){
 clearTimeout(timer);storage=undefined;dirty=false;
 try{storage=target??window.localStorage;expected=storage.getItem(PERSONAL_KEY);}catch{storage=undefined;expected=null;}
 const response=await fetch('/api/workspace',{cache:'no-store'});
 const body=await response.json() as {error?:string;revision:number;values:Record<string,string>};
 if(!response.ok)throw new Error(body.error||'The demo could not be loaded.');
 if(!Number.isSafeInteger(body.revision))throw new Error('The demo returned invalid data.');
 baseline=validateDemoValues(body.values);revision=body.revision;
 if(expected){const saved=JSON.parse(expected);if(saved.version!==2)throw new Error('Saved demo could not be read. Your original browser data is unchanged.');values=validateDemoValues(saved.values);}else values={...baseline};
 announce(storage?'saved':'error',storage?'Saved in this browser only':'Browser storage is unavailable. Download a backup to keep your work.');
 if(storage&&!expected){dirty=true;await flushCloud();}
}
export async function flushCloud(){
 clearTimeout(timer);if(!dirty||state.status==='conflict')return;
 try{
  if(!storage)throw new Error('Storage unavailable');
  if(storage.getItem(PERSONAL_KEY)!==expected){announce('conflict','Another tab changed your demo. Download your draft, then reload.');return;}
  const raw=JSON.stringify({version:2,baselineRevision:revision,values});storage.setItem(PERSONAL_KEY,raw);expected=raw;dirty=false;announce('saved','Saved in this browser only');
 }catch{announce('error','Changes are not saved. Download a backup or retry.');}
}
export function hasUnsavedChanges(){return dirty;}
export function workspaceBackup(){return {format:'rainready-workspace-backup',version:1,revision,exportedAt:new Date().toISOString(),values};}
export async function restoreCloud(backup:unknown){
 const data=backup as {format?:string;version?:number;values?:unknown};
 if(!['rainready-workspace-backup','rainready-cloud-backup'].includes(data?.format??'')||data.version!==1)throw new Error('Choose a valid RainReady workspace backup.');
 const next=validateDemoValues(data.values);
 // Persist before replacing the draft so quota failures leave the current work intact.
 if(!storage)throw new Error('Browser storage is unavailable.');
 if(storage.getItem(PERSONAL_KEY)!==expected)throw new Error('Another tab changed your demo. Download your draft, then reload.');
 const raw=JSON.stringify({version:2,baselineRevision:revision,values:next});storage.setItem(PERSONAL_KEY,raw);clearTimeout(timer);values=next;expected=raw;dirty=false;announce('saved','Saved in this browser only');
}
export async function resetDemo(){await restoreCloud({format:'rainready-workspace-backup',version:1,values:baseline});}
