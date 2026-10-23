type SaveState={status:'loading'|'saved'|'saving'|'error'|'conflict';message:string};
type StorageAccess=Pick<Storage,'getItem'|'setItem'>;
const KEY='rainready-public-workspace:v1';
let values:Record<string,string>={},revision=0,expectedRaw:string|null=null,storage:StorageAccess|undefined,dirty=false,timer:ReturnType<typeof setTimeout>|undefined;
let state:SaveState={status:'loading',message:'Loading this device…'};const listeners=new Set<()=>void>();
function announce(status:SaveState['status'],message:string){state={status,message};listeners.forEach(f=>f());}
function validateValues(input:unknown):Record<string,string>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.values(input).some(v=>typeof v!=='string'))throw new Error('This backup could not be read.');return input as Record<string,string>;}
export const deviceStorage={getItem(key:string){return Object.hasOwn(values,key)?values[key]:null;},setItem(key:string,value:string){if(values[key]===value)return;values={...values,[key]:value};changed();},removeItem(key:string){const next={...values};delete next[key];values=next;changed();}};
export function subscribeDevice(f:()=>void){listeners.add(f);return()=>{listeners.delete(f)}}
export function deviceState(){return state;}
export function loadDevice(target:StorageAccess){storage=target;expectedRaw=target.getItem(KEY);if(expectedRaw){const saved=JSON.parse(expectedRaw);if(saved.version!==1||!Number.isSafeInteger(saved.revision))throw new Error('Saved data could not be loaded. Your original data is unchanged.');values=validateValues(saved.values);revision=saved.revision;}else{values={};revision=0;}dirty=false;announce('saved','Saved on this device');}
function changed(){if(!storage)return;dirty=true;if(state.status==='conflict')return;announce('saving','Saving on this device…');clearTimeout(timer);timer=setTimeout(saveDevice,400);}
export function saveDevice(){if(!storage||!dirty||state.status==='conflict')return;try{if(storage.getItem(KEY)!==expectedRaw){announce('conflict','Another tab saved changes. Download a backup, then reload.');return;}const raw=JSON.stringify({version:1,revision:revision+1,values});storage.setItem(KEY,raw);expectedRaw=raw;revision++;dirty=false;announce('saved','Saved on this device');}catch{announce('error','Changes are not saved. Download a backup or try again.');}}
export function hasUnsavedChanges(){return dirty;}
export function workspaceBackup(){return {format:'rainready-workspace-backup',version:1,revision,exportedAt:new Date().toISOString(),values};}
export function restoreDevice(input:unknown){const backup=input as {format?:string;version?:number;values?:Record<string,string>};if(!['rainready-workspace-backup','rainready-cloud-backup'].includes(backup?.format??'')||backup.version!==1)throw new Error('Choose a RainReady workspace backup.');const next=validateValues(backup.values);if(!storage)throw new Error('Device storage is unavailable.');const raw=JSON.stringify({version:1,revision:revision+1,values:next});storage.setItem(KEY,raw);clearTimeout(timer);values={...next};expectedRaw=raw;revision++;dirty=false;announce('saved','Backup restored on this device');}
