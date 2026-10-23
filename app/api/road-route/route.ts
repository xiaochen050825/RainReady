import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
const answer=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return answer({error:'Request not allowed.'},403);
 if(!env.DB)return answer({error:'Road route storage is unavailable.'},503);
 try{
  const text=await request.text();if(text.length>12000)return answer({error:'Route request is too large.'},413);
  const {points}=JSON.parse(text) as {points:{lat:number;lon:number}[]};
  if(!Array.isArray(points)||points.length<2||points.length>50||points.some(p=>!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180))return answer({error:'Choose between 2 and 50 valid route points.'},400);
  const coordinates=points.map(p=>`${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(coordinates)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const now=Date.now();const cached=await env.DB.prepare('SELECT data FROM route_cache WHERE id=? AND expires_at>?').bind(hash,now).first<{data:string}>();
  if(cached)return answer(JSON.parse(cached.data));
  await env.DB.prepare('INSERT OR IGNORE INTO service_limits(id,next_at) VALUES(?,0)').bind('routing').run();
  const lock=await env.DB.prepare('UPDATE service_limits SET next_at=? WHERE id=? AND next_at<=?').bind(now+1100,'routing',now).run();
  if(lock.meta.changes!==1)return answer({error:'The route service is busy. Try again in a moment.'},429);
  const upstream=await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&generate_hints=false`,{headers:{'User-Agent':'RainReady/1.0 (https://rainready-maintenance.spunkymint11.chatgpt.site)'},signal:AbortSignal.timeout(12000)});
  if(!upstream.ok)throw new Error('Route provider unavailable');
  const data=await upstream.json() as {code:string;routes?:{duration:number;distance:number;geometry:{coordinates:[number,number][]};legs:{duration:number;distance:number}[]}[];waypoints?:{distance:number}[]};const route=data.routes?.[0];
  if(data.code!=='Ok'||!route||route.legs.length!==points.length-1||!Number.isFinite(route.duration)||!Array.isArray(route.geometry.coordinates))return answer({error:'No connected driving route was found for these stops.'},422);
  const result={duration:route.duration,distance:route.distance,coordinates:route.geometry.coordinates,legs:route.legs.map(l=>({minutes:Math.ceil(l.duration/60),meters:Math.round(l.distance)})),snapDistance:Math.round(Math.max(...(data.waypoints??[]).map(w=>w.distance))),provider:'OSRM / FOSSGIS',checkedAt:new Date().toISOString()};
  await env.DB.prepare('DELETE FROM route_cache WHERE expires_at<?').bind(now).run();
  await env.DB.prepare('INSERT INTO route_cache(id,data,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at').bind(hash,JSON.stringify(result),now+900000).run();
  return answer(result);
 }catch{return answer({error:'Road routes are unavailable. Your plan has not been changed. You can still open navigation.'},503);}
}
