import {lazy, Suspense, useEffect, useRef, useState} from "react";
import {ArrowUpRight, Box, Loader2, MapPinned, Rotate3D, RefreshCw} from "lucide-react";
import {Link} from "react-router-dom";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {supabase} from "@/integrations/supabase/client";

// The landing experience loads REAL Google 3D tiles by default, not a looping
// illustration, CSS transform or 2D carousel. It is deferred until visible.
const Fallback2D = lazy(() => import("./LandingResMap2DPreview"));
const PRETORIA = {lat:-25.7479,lng:28.2293,altitude:250};
const GOOGLE_SCRIPT_ID = "resmap-google-maps-js"; // shared with full ResMap
type Point = {id:string;name:string;latitude:number|string|null;longitude:number|string|null};
type MapConfig = {google_maps_enabled:boolean;google_maps_browser_key:string|null;google_maps_map_id:string|null};
type Engine = "photorealistic"|"vector"|"fallback";
let loader:Promise<any>|null=null;

function loadGoogleMaps(key:string):Promise<any>{
 if(typeof window==="undefined")return Promise.reject(new Error("3D requires a browser"));
 const w=window as any;
 if(w.google?.maps?.importLibrary)return Promise.resolve(w.google);
 if(loader)return loader;
 loader=new Promise((resolve,reject)=>{
  const existing=document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement|null;
  const script=existing||document.createElement("script");
  let settled=false;
  const clean=()=>{window.clearTimeout(timer);script.removeEventListener("load",complete);script.removeEventListener("error",fail);};
  const complete=()=>{if(settled)return;settled=true;clean();w.google?.maps?.importLibrary?resolve(w.google):reject(new Error("Google Maps JavaScript did not initialize"));};
  const fail=()=>{if(settled)return;settled=true;clean();reject(new Error("The 3D map provider did not load"));};
  const timer=window.setTimeout(fail,12000);
  script.addEventListener("load",complete,{once:true});
  script.addEventListener("error",fail,{once:true});
  if(!existing){
   script.id=GOOGLE_SCRIPT_ID;
   script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
   script.async=true;
   document.head.appendChild(script);
  }
 }).catch(err=>{loader=null;throw err;});
 return loader;
}

function isValidPoint(row:Point){
 const lat=Number(row.latitude),lng=Number(row.longitude);
 return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-35.5&&lat<=-21&&lng>=15&&lng<=34;
}
function chooseCenter(points:Point[]){
 const nearPretoria=points.find(p=>{
  const lat=Number(p.latitude),lng=Number(p.longitude);
  return lat>-26.05&&lat<-25.48&&lng>27.75&&lng<28.7;
 });
 const point=nearPretoria||points[0];
 return point?{lat:Number(point.latitude),lng:Number(point.longitude),altitude:250}:PRETORIA;
}
function waitForPhotorealistic(map3d:any){
 return new Promise<void>((resolve,reject)=>{
  let finished=false;
  const cleanup=()=>{clearTimeout(timer);map3d.removeEventListener("gmp-steadychange",steady);map3d.removeEventListener("gmp-error",error);map3d.removeEventListener("gmp-map-id-error",error);};
  const done=(failure?:Error)=>{if(finished)return;finished=true;cleanup();failure?reject(failure):resolve();};
  const steady=(event:any)=>{if(event?.isSteady!==false)done();};
  const error=()=>done(new Error("Photorealistic 3D map was not available"));
  map3d.addEventListener("gmp-steadychange",steady);
  map3d.addEventListener("gmp-error",error);
  map3d.addEventListener("gmp-map-id-error",error);
  const timer=window.setTimeout(()=>done(new Error("Photorealistic 3D rendering did not finish")),15000);
 });
}

export default function LandingResMap3DPreview(){
 const hostRef=useRef<HTMLDivElement>(null);
 const [engine,setEngine]=useState<Engine|null>(null);
 const [busy,setBusy]=useState(true);
 const [attempt,setAttempt]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 const [failure,setFailure]=useState("");
 const [residenceCount,setResidenceCount]=useState(0);

 useEffect(()=>{
  const host=hostRef.current;
  if(!host)return;
  let disposed=false;
  let markers:any[]=[];
  let mapInstance:any=null;
  let map3d:any=null;
  setBusy(true);setEngine(null);setFailure("");setSelected(null);
  const load=async()=>{
   if(typeof window==="undefined"||!document.createElement("canvas").getContext("webgl2")){
    throw new Error("This device does not support the WebGL 3D renderer");
   }
   const db=supabase as any;
   const [configResult,residenceResult]=await Promise.all([
    db.from("resmap_map_config").select("google_maps_enabled,google_maps_browser_key,google_maps_map_id").eq("id",1).maybeSingle(),
    db.from("residences").select("id,name,latitude,longitude").eq("is_visible",true).limit(140),
   ]);
   if(disposed)return;
   const config=configResult.data as MapConfig|null;
   if(configResult.error||!config?.google_maps_enabled||!config.google_maps_browser_key){
    throw new Error("Live Google Maps 3D is unavailable");
   }
   const points=((residenceResult.data||[]) as Point[]).filter(isValidPoint);
   const center=chooseCenter(points);
   setResidenceCount(points.length);
   const google=await loadGoogleMaps(config.google_maps_browser_key);
   if(disposed)return;

   // 1. Preferred path: Google's genuine photorealistic 3D buildings and terrain.
   try{
    const {Map3DElement,Marker3DInteractiveElement}=await google.maps.importLibrary("maps3d");
    if(disposed)return;
    if(!Map3DElement)throw new Error("Photorealistic 3D is unsupported");
    map3d=new Map3DElement({
      center,mode:"HYBRID",tilt:67.5,heading:0,range:2800,
      gestureHandling:"GREEDY",defaultUIHidden:false,
      ...(config.google_maps_map_id?{mapId:config.google_maps_map_id}:{})
    });
    map3d.style.width="100%";
    map3d.style.height="100%";
    const ready=waitForPhotorealistic(map3d);
    host.replaceChildren(map3d);
    await ready;
    if(disposed)return;
    if(Marker3DInteractiveElement){
      for(const p of points.slice(0,55)){
       const marker=new Marker3DInteractiveElement({
        position:{lat:Number(p.latitude),lng:Number(p.longitude),altitude:0},
        label:p.name.slice(0,30),title:p.name,extruded:true,sizePreserved:true
       });
       marker.addEventListener("gmp-click",()=>setSelected(p.name));
       map3d.append(marker);
       markers.push(marker);
      }
    }
    setEngine("photorealistic");setBusy(false);
    return;
   }catch(error){
    if(disposed)return;
    console.warn("[ResMap landing] Photorealistic provider unavailable; trying genuine vector tilt",error);
    markers.forEach(m=>m.remove?.());markers=[];
   }
   // 2. Real interactive vector 3D fallback; never label a flat 2D tile map as 3D.
   const maps=await google.maps.importLibrary("maps");
   if(disposed)return;
   const div=document.createElement("div");
   div.style.width="100%";div.style.height="100%";
   host.replaceChildren(div);
   mapInstance=new maps.Map(div,{
    center:{lat:center.lat,lng:center.lng},zoom:17,tilt:55,heading:0,
    mapTypeId:"hybrid",renderingType:maps.RenderingType?.VECTOR,
    tiltInteractionEnabled:true,headingInteractionEnabled:true,
    gestureHandling:"greedy",streetViewControl:false,fullscreenControl:true,mapTypeControl:false,
   });
   await Promise.race([
    new Promise<void>(resolve=>google.maps.event.addListenerOnce(mapInstance,"tilesloaded",()=>resolve())),
    new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("3D vector tiles timed out")),11000)),
   ]);
   if(disposed)return;
   if(mapInstance.getRenderingType?.()!==maps.RenderingType?.VECTOR){
    throw new Error("This device returned a flat raster map instead of 3D");
   }
   mapInstance.moveCamera?.({center:{lat:center.lat,lng:center.lng},zoom:17,tilt:55,heading:0});
   for(const p of points.slice(0,40)){
    const marker=new google.maps.Marker({map:mapInstance,position:{lat:Number(p.latitude),lng:Number(p.longitude)},title:p.name});
    marker.addListener("click",()=>setSelected(p.name));markers.push(marker);
   }
   setEngine("vector");setBusy(false);
  };
  void load().catch(error=>{
   if(disposed)return;
   setFailure(error instanceof Error?error.message:"3D map unavailable");
   setEngine("fallback");setBusy(false);
  });
  return ()=>{
   disposed=true;
   markers.forEach(marker=>{try{if(marker.setMap)marker.setMap(null);else marker.remove?.();}catch{/* Ignore removed renderer. */}});
   markers=[];
   try{mapInstance?.unbindAll?.();}catch{/* Map was unmounted. */}
   if(host.contains(map3d)){try{map3d.remove();}catch{/* Already removed. */}}
   host.replaceChildren();
  };
 },[attempt]);

 if(engine==="fallback")return <div className="space-y-4">
  <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
   <div><p className="font-bold">Photorealistic 3D is unavailable on this device.</p><p className="mt-1 text-muted-foreground">{failure} · Showing an interactive street map instead of a simulated 3D view.</p></div>
   <Button type="button" variant="outline" onClick={()=>{setEngine(null);setBusy(true);setAttempt(x=>x+1);}}><RefreshCw className="mr-2 h-4 w-4"/>Retry real 3D</Button>
  </div>
  <Suspense fallback={<div className="grid h-72 place-items-center rounded-2xl bg-muted text-sm">Opening street map…</div>}><Fallback2D/></Suspense>
 </div>;

 return <section aria-label="Interactive 3D ResMap accommodation preview" className="overflow-hidden rounded-[32px] border border-white/10 bg-[#061633] p-4 text-white shadow-2xl sm:p-6">
  <div className="flex flex-wrap items-end justify-between gap-5 px-2 pb-5 pt-3 sm:px-4 sm:pb-7">
   <div className="max-w-2xl">
    <Badge className="border border-cyan-300/30 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/15"><Rotate3D className="mr-1.5 h-4 w-4"/>LIVE RESMAP 3D</Badge>
    <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">See the neighbourhood before you move.</h2>
    <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">Explore real 3D buildings and terrain, rotate and zoom the map, and discover accommodation near Pretoria campuses. This is live geographic imagery, not an animated demonstration.</p>
   </div>
   <Button size="lg" asChild className="rounded-full bg-white font-black text-slate-950 hover:bg-slate-100"><Link to="/findmyres?view=map&mode=3d">Explore full 3D ResMap <ArrowUpRight className="ml-2 h-4 w-4"/></Link></Button>
  </div>
  <div className="relative h-[400px] overflow-hidden rounded-[24px] border border-white/15 bg-[#102b49] sm:h-[520px]" aria-label="Live interactive 3D map, drag to rotate, zoom to explore">
   <div ref={hostRef} className="absolute inset-0" data-testid="landing-real-3d-map-host"/>
   {busy&&<div role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-[#102b49]/80 backdrop-blur-sm">
      <div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300"/><p className="mt-3 text-sm font-bold">Loading real 3D geography…</p><p className="mt-1 text-xs text-slate-300">Buildings, terrain and live residence locations</p></div>
    </div>}
   {!busy&&engine&&<div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap gap-2">
    <span className="rounded-full bg-slate-950/80 px-3 py-2 text-[11px] font-bold shadow-lg backdrop-blur"><Box className="mr-1 inline h-4 w-4 text-cyan-300"/>{engine==="photorealistic"?"Photorealistic 3D": "Interactive vector 3D"}</span>
    <span className="rounded-full bg-slate-950/80 px-3 py-2 text-[11px] font-bold shadow-lg backdrop-blur"><MapPinned className="mr-1 inline h-4 w-4 text-amber-300"/>{residenceCount} mapped residences</span>
   </div>}
   {selected&&!busy&&<div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 max-w-md rounded-xl bg-slate-950/85 px-4 py-3 text-sm font-bold shadow-xl backdrop-blur">{selected}</div>}
  </div>
  <p className="px-2 pt-4 text-xs leading-5 text-slate-400 sm:px-4">Drag to orbit, pinch or scroll to zoom. Actual 3D availability depends on Google's geographic coverage, your device's WebGL support and network access. The full ResMap offers additional location and route tools.</p>
 </section>;
