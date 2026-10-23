export type RoadTimes={points:string[];minutes:(number|null)[][];checkedAt:string};
export function coordinateKey(p:{lat:number;lon:number}){return `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`;}
export function validateRoadTimes(input:unknown):RoadTimes{
 const x=input as RoadTimes;
 if(!x||!Array.isArray(x.points)||x.points.length<2||x.points.length>50||!x.points.every(p=>typeof p==='string'&&/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(p))||!Array.isArray(x.minutes)||x.minutes.length!==x.points.length||x.minutes.some(r=>!Array.isArray(r)||r.length!==x.points.length||r.some(v=>v!==null&&(!Number.isFinite(v)||v<0)))||typeof x.checkedAt!=='string')throw new Error('Invalid road travel times.');
 return x;
}
export function roadTravelMinutes(times:RoadTimes,a:{lat:number;lon:number},b:{lat:number;lon:number}){
 const from=times.points.indexOf(coordinateKey(a)),to=times.points.indexOf(coordinateKey(b));
 if(from<0||to<0)throw new Error('Road times do not cover every facility. Refresh road times.');
 return times.minutes[from][to]??Infinity;
}
