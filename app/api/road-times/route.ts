import {env} from 'cloudflare:workers';
import {coordinateKey} from '../../../lib/roadTimes';
const answer=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return answer({error:'Request not allowed.'},403);
 if(!env.DB)return answer({error:'Road service is unavailable.'},503);
 try{
  const text=await request.text();if(text.length>12000)return answer({error:'Route request is too large.'},413);
  const {points}=JSON.parse(text) as {points:{lat:number;lon:number}[]};
  if(!Array.isArray(points)||points.length<2||points.length>50||points.some(p=>!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180))return answer({error:'Road times support up to 49 facilities and one base.'},400);
  const coordinates=points.map(coordinateKey);const key='table:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(coordinates.join(';'))))).map(v=>v.toString(16).padStart(2,'0')).join('');const now=Date.now();
  const cached=await env.DB.prepare('SELECT data FROM route_cache WHERE id=? AND expires_at>?').bind(key,now).first<{data:string}>();if(cached)return answer(JSON.parse(cached.data));
  await env.DB.prepare('INSERT OR IGNORE INTO service_limits(id,next_at) VALUES(?,0)').bind('routing').run();
  const lock=await env.DB.prepare('UPDATE service_limits SET next_at=? WHERE id=? AND next_at<=?').bind(now+1100,'routing',now).run();if(lock.meta.changes!==1)return answer({error:'Road service is busy. Try again in a moment.'},429);
  const result=await fetch(`https://routing.openstreetmap.de/routed-car/table/v1/driving/${coordinates.join(';')}?annotations=duration&generate_hints=false`,{headers:{'User-Agent':'RainReady/1.0 (https://rainready-maintenance.spunkymint11.chatgpt.site)'},signal:AbortSignal.timeout(15000)});
  if(!result.ok)throw new Error('Routing unavailable');const data=await result.json() as {code:string;durations:(number|null)[][]};
  if(data.code!=='Ok'||!Array.isArray(data.durations)||data.durations.length!==points.length)throw new Error('No road times');
  const output={points:coordinates,minutes:data.durations.map(r=>r.map(v=>v===null?null:Math.ceil(v/60))),checkedAt:new Date().toISOString()};
  await env.DB.prepare('DELETE FROM route_cache WHERE expires_at<?').bind(now).run();
  await env.DB.prepare('INSERT INTO route_cache(id,data,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at').bind(key,JSON.stringify(output),now+900000).run();return answer(output);
 }catch{return answer({error:'Road times could not be loaded. Your current plan is unchanged.'},503);}
}
