import {env} from 'cloudflare:workers';
// Standalone demo keeps resized evidence in bounded D1 chunks. No R2 enrollment is needed.
export function workspaceObjects(){
 if(env.BUCKET)return env.BUCKET;
 const db=env.DB;if(!db)throw new Error('Cloud storage is unavailable.');
 return {
  async put(key:string,value:string,_options?:unknown){const parts=[];for(let start=0,i=0;start<value.length;start+=250000,i++)parts.push(db.prepare('INSERT INTO workspace_chunks(object_key,part,content) VALUES(?,?,?)').bind(key,i,value.slice(start,start+250000)));if(parts.length)await db.batch(parts);},
  async get(key:string){const data=await db.prepare('SELECT content FROM workspace_chunks WHERE object_key=? ORDER BY part').bind(key).all<{content:string}>();if(!data.results.length)return null;return {async json(){return JSON.parse(data.results.map(p=>p.content).join(''))}};},
  async delete(key:string){await db.prepare('DELETE FROM workspace_chunks WHERE object_key=?').bind(key).run();}
 };
}
