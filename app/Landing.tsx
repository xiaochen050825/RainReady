"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {demoPlanning} from "../lib/demoScenario";
import {rankNetwork} from "../lib/network/criticality";
import {planCrews} from "../lib/optimization/planner";
import WorkspaceMap from "./WorkspaceMap";
import {Brand,Icon} from "./Ui";

function Speaker({muted}:{muted:boolean}){
 return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>{muted?<path d="m17 9 5 6m0-6-5 6"/>:<><path d="M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/></>}</svg>
}

export default function Landing({onOpen,onEvidence,onCredits,onExample,active=true}:{active?:boolean;onOpen:()=>void;onEvidence:()=>void;onCredits:()=>void;onExample?:(crews:number)=>void}){
 const video=useRef<HTMLVideoElement>(null);
 const filmFrame=useRef<HTMLDivElement>(null);
 const [muted,setMuted]=useState(true),[playing,setPlaying]=useState(false),[time,setTime]=useState(0),[duration,setDuration]=useState(45),[captions,setCaptions]=useState(false);
 const [buffering,setBuffering]=useState(false),[filmError,setFilmError]=useState(false);
 const [crews,setCrews]=useState(2),[selected,setSelected]=useState("RR-027"),[mapMode,setMapMode]=useState("routes");
 const scenario=useMemo(()=>demoPlanning(),[]);
 const network=scenario.network;
 const priorities=useMemo(()=>rankNetwork(network,scenario.rain),[network,scenario.rain]);
 const depot=useMemo(()=>({lat:network.nodes[0].lat-0.001,lon:network.nodes[0].lon}),[network]);
 const plan=useMemo(()=>planCrews(network,priorities,{deadline:120,depot,crews:Array.from({length:crews},(_,i)=>({id:`Crew ${String.fromCharCode(65+i)}`,availableFrom:0,minutes:240,equipment:[]})),method:"rainready"}),[crews,depot,network,priorities]);
 const count=plan.crews.reduce((n,c)=>n+c.tasks.length,0);
 useEffect(()=>{
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const v=video.current;if(!v)return;if(!active||reduced.matches)v.pause();else void v.play().catch(()=>{});
  return()=>{};
 },[active]);
 function watchFilm(){const v=video.current;if(!v)return;filmFrame.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});v.currentTime=0;v.muted=false;setMuted(false);void v.play().catch(()=>{v.controls=true});}
 function togglePlayback(){const v=video.current;if(!v)return;if(v.paused)void v.play().catch(()=>{v.controls=true});else v.pause();}
 function toggleSound(){if(!video.current)return;video.current.muted=!muted;setMuted(!muted);}
 function toggleCaptions(){const v=video.current;if(!v)return;const show=!captions;for(let i=0;i<v.textTracks.length;i++)v.textTracks[i].mode=show?'showing':'hidden';setCaptions(show);}

 return <div className="product-home">
  <header className="product-header">
   <a href="#home" aria-label="RainReady home"><Brand/></a>
   <nav aria-label="Product navigation"><a href="#product">Product</a><a href="#workflow">How it works</a><a href="#method">Our approach</a></nav>
   <button className="primary" onClick={onOpen}>Open workspace <Icon name="arrow"/></button>
  </header>
  <main>
   <section className="product-hero">
    <div className="hero-message"><h1>A clearer plan.<br/><span>Before the rain.</span></h1><div><p>Know which drains matter.<br/>Give every crew a workable plan.</p><p className="hero-support">One connected workspace for drainage maintenance,<br className="desktop-only"/> from the first inspection to the final review.</p><div className="product-hero-actions"><button className="primary" onClick={onOpen}>Open workspace <Icon name="arrow"/></button><button className="film-link" onClick={watchFilm}><span className="play-circle">▶</span>Watch the film <span>45 sec</span></button></div></div></div>
    <div className="product-film" id="product" ref={filmFrame}>
     <video ref={video} loop muted playsInline preload="auto" poster="/design-media/launch-poster.jpg" onPlay={()=>setPlaying(true)} onWaiting={()=>setBuffering(true)} onPlaying={()=>{setBuffering(false);setFilmError(false)}} onCanPlay={()=>setBuffering(false)} onError={()=>{setFilmError(true);setBuffering(false)}} onPause={()=>setPlaying(false)} onTimeUpdate={()=>setTime(video.current?.currentTime??0)} onLoadedMetadata={()=>setDuration(video.current?.duration||45)} aria-label="RainReady product film: Before the Rain">
      <source src="/design-media/rainready-web-v1.mp4" type="video/mp4"/>
      <track kind="captions" src="/design-media/rainready-en.vtt" srcLang="en" label="English"/>
     </video>
     {buffering&&<span className="film-loading" role="status">Loading video…</span>}{filmError&&<span className="film-loading" role="alert">Video unavailable. <button onClick={()=>{const v=video.current;if(v){setFilmError(false);v.load();void v.play().catch(()=>{})}}}>Try again</button></span>}
     <div className="product-film-controls">
      <button onClick={togglePlayback} aria-label={playing?'Pause product film':'Play product film'}>{playing?<span className="pause-symbol">Ⅱ</span>:<Icon name="play"/>}</button>
      <span className="film-name">Before the Rain <small>A RainReady film</small></span>
      <input aria-label="Product film position" type="range" min="0" max={duration} step=".1" value={time} onChange={e=>{if(video.current)video.current.currentTime=Number(e.target.value);setTime(Number(e.target.value))}}/>
      <span className="film-time">{Math.floor(time).toString().padStart(2,'0')} / {Math.round(duration)}s</span>
      <button onClick={toggleSound} aria-label={muted?'Turn film sound on':'Mute film sound'}><Speaker muted={muted}/></button>
      <button onClick={toggleCaptions} aria-label="Toggle English captions" aria-pressed={captions} className="caption-toggle">CC</button>
      <button aria-label="Expand product film" onClick={()=>{void filmFrame.current?.requestFullscreen().catch(()=>{if(video.current)video.current.controls=true})}}><svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m6 0h4v-4"/></svg></button>
     </div>
    </div>
    <div className="hero-caption"><span>Built around the network. Designed for the people who maintain it.</span><a href="#planning">Try a planning decision ↓</a></div>
   </section>

   <section className="planning-story home-section" id="planning">
    <div className="section-heading"><h2>Limited time.<br/>A plan that fits.</h2><div><p>Not every blocked drain can be cleared at once. See what changes when one crew becomes two.</p><span className="example-tag">Starter example · Taman Rintis · 64 mm rainfall</span></div></div>
    <div className="planning-example">
     <div className="example-toolbar"><div><span>Available crews</span><div className="example-switch" aria-label="Example crew capacity">{[1,2].map(n=><button key={n} aria-pressed={crews===n} onClick={()=>setCrews(n)}>{n} {n===1?'crew':'crews'}</button>)}</div></div><span className="example-deadline">120 min deadline</span><span className="example-result"><strong>{count}</strong> scheduled <i/> {plan.deferred.length} deferred</span></div>
     <div className="example-main"><div className="example-map"><WorkspaceMap network={network} plan={plan} depot={depot} selected={selected} onSelect={setSelected} mode={mapMode}/><div className="example-map-toggle"><button aria-pressed={mapMode==='network'} onClick={()=>setMapMode('network')}>Network</button><button aria-pressed={mapMode==='routes'} onClick={()=>setMapMode('routes')}>Crew routes</button></div></div><aside className="example-schedule"><div className="schedule-intro"><Icon name="plan"/><h3>Crew schedule</h3></div>{plan.crews.map((c,i)=><div className="example-crew" key={c.id}><header><b>{c.id}</b><span>{c.tasks.length} tasks</span></header>{c.tasks.map(t=><button key={t.id} aria-pressed={selected===t.id} onClick={()=>setSelected(t.id)}><span><i style={{background:i?'#36434f':'#087ba9'}}/>{t.id}</span><span>{t.start}–{t.finish}<small>min</small></span></button>)}<p>Back at depot by {c.finish} min</p></div>)}<div className="example-finish">Travel, work and return.<br/>Accounted for in the same plan.</div></aside></div>
     <footer className="example-footer"><span>28 illustrative assets · 27 supplied links · distance-based travel</span><button className="text-link" onClick={()=>onExample?onExample(crews):onOpen()}>Try this plan <Icon name="arrow"/></button></footer>
    </div>
   </section>

   <section className="workflow-story home-section" id="workflow">
    <div className="field-photograph"><img src="/design-media/field-team.png" alt="Illustrative maintenance supervisor holding a tablet beside a residential drain" loading="lazy"/><span>Illustrative maintenance scene</span></div>
    <div className="workflow-copy"><h2>Made for the work<br/>between the storms.</h2><p>Less time piecing information together.<br/>More clarity about what happens next.</p><ol><li><span>01</span><div><h3>See the connections.</h3><p>Understand the network around a drain, alongside its condition and supporting evidence.</p></div></li><li><span>02</span><div><h3>Work with your capacity.</h3><p>Set available crews and a deadline. Review tasks, estimated travel and what has to wait.</p></div></li><li><span>03</span><div><h3>Keep the decision with your team.</h3><p>Approve a specific plan, record site evidence and review the next change with confidence.</p></div></li></ol><button className="text-link" onClick={onOpen}>Explore the workspace <Icon name="arrow"/></button></div>
   </section>

   <section className="method-story home-section" id="method"><div className="section-heading"><h2>Clarity you can<br/>look into.</h2><div><p>A useful recommendation should explain itself. Inspect the inputs, assumptions and evidence behind the plan.</p><button className="text-link" onClick={onEvidence}>Explore the evidence <Icon name="arrow"/></button></div></div><div className="method-details"><details open><summary><span>01</span> Connected priorities <b>＋</b></summary><p>A drain is part of a wider network. RainReady considers supplied upstream connections, contributing catchment and exposure alongside the observed condition. The inputs remain inspectable.</p></details><details><summary><span>02</span> Feasible schedules <b>＋</b></summary><p>Each schedule accounts for travel, service, access constraints and return to the depot within the available time. Routes use a distance model; they are estimates, not turn-by-turn road navigation.</p></details><details><summary><span>03</span> Evidence that stays attached <b>＋</b></summary><p>Keep before and after photos, notes and a confirmed asset association together. The image analysis supports human review. Reusing the same photo cannot demonstrate a completed cleanup.</p></details><details><summary><span>04</span> Comparisons you can reproduce <b>＋</b></summary><p>Run seeded scenarios under the same resource constraints. The evaluation retains negative outcomes and exposes assumptions. It is a simplified model, not a verified forecast of flooding.</p></details></div></section>

   <section className="home-final"><div><h2>Make the next<br/>move clear.</h2><p>A connected view. A workable plan.<br/>A decision your team can stand behind.</p></div><button onClick={onOpen}>Open workspace <Icon name="arrow"/></button></section>
  </main>
  <footer className="product-footer"><a href="#home"><Brand/></a><span>Plan. Inspect. Verify.</span><nav aria-label="Footer navigation"><button onClick={onCredits}>About the data & film</button><a href="#method">Our approach</a><button onClick={onOpen}>Open workspace ↗</button></nav></footer>
 </div>
}
