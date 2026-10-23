import {env} from 'cloudflare:workers';
import {workspaceObjects} from '../../../lib/workspaceObjects';
export const dynamic='force-dynamic';
import {BASELINE_OWNER,createDemoValues,validateDemoValues} from '../../../lib/demoScenario';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const validateValues=validateDemoValues;
export async function GET(request:Request){
 const user={userId:BASELINE_OWNER};
 if(!env.DB)return response({error:'Workspace storage is unavailable. Please try again later.'},503);
 try{
  if(!env.BUCKET&&new URL(request.url).searchParams.get('revisionOnly')!=='1'){
   const rows=await env.DB.prepare('SELECT w.revision,c.content FROM workspaces w JOIN workspace_chunks c ON c.object_key=w.object_key WHERE w.owner_id=? ORDER BY c.part').bind(user.userId).all<{revision:number;content:string}>();
   if(!rows.results.length){const head=await env.DB.prepare('SELECT revision FROM workspaces WHERE owner_id=?').bind(user.userId).first();if(head)throw new Error('Incomplete cloud snapshot.');return response({revision:0,values:createDemoValues()});}
   return response({revision:rows.results[0].revision,values:validateValues(JSON.parse(rows.results.map(r=>r.content).join('')))});
  }
  const record=await env.DB.prepare('SELECT revision,object_key FROM workspaces WHERE owner_id=?').bind(user.userId).first<{revision:number;object_key:string}>();
  if(!record)return response({revision:0,values:createDemoValues()});
  if(new URL(request.url).searchParams.get('revisionOnly')==='1')return response({revision:record.revision});
  const file=await workspaceObjects().get(record.object_key);if(!file)throw new Error('Saved workspace could not be read.');
  return response({revision:record.revision,values:validateValues(await file.json())});
 }catch{return response({error:'Saved workspace could not be loaded. Your existing data has not been changed.'},503);}
}
// Public visitors can only read the curated baseline. Drafts never leave their browser.
export async function PUT(){return response({error:'The shared example is read-only. Changes belong in your personal demo.'},403);}
export async function POST(){return PUT();}
export async function PATCH(){return PUT();}
export async function DELETE(){return PUT();}
