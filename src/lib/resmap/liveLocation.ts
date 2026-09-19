import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/accountRouting";

export type LiveLocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";
export interface LivePosition { latitude:number;longitude:number;accuracy:number;altitude:number|null;heading:number|null;speed:number|null;timestamp:number; }
export interface LiveLocationState { status:LiveLocationStatus;position:LivePosition|null;deviceHeading:number|null;orientationAvailable:boolean;error:string|null; }
const OPT_IN_KEY="reskonnect_resmap_live_location_opt_in";
const LAST_POSITION_KEY="reskonnect_resmap_last_position";
let state:LiveLocationState={status:"idle",position:null,deviceHeading:null,orientationAvailable:false,error:null};
let watchId:number|null=null;
let nativePolling:ReturnType<typeof setInterval>|null=null;
let orientationListening=false;
let pending:Promise<boolean>|null=null;
const subscribers=new Set<(next:LiveLocationState)=>void>();
function emit(patch:Partial<LiveLocationState>){state={...state,...patch};subscribers.forEach(listener=>listener(state));}
function normalizeHeading(value:number|null|undefined){if(value==null||!Number.isFinite(Number(value)))return null;const heading=Number(value)%360;return heading<0?heading+360:heading;}
function readLastPosition():LivePosition|null{if(typeof window==="undefined")return null;try{const p=JSON.parse(localStorage.getItem(LAST_POSITION_KEY)||"null");if(!Number.isFinite(p?.latitude)||!Number.isFinite(p?.longitude))return null;return {latitude:Number(p.latitude),longitude:Number(p.longitude),accuracy:Number(p.accuracy||0),altitude:p.altitude==null?null:Number(p.altitude),heading:normalizeHeading(p.heading),speed:p.speed==null?null:Number(p.speed),timestamp:Number(p.timestamp||Date.now())};}catch{return null;}}
if(typeof window!=="undefined"){const cached=readLastPosition();if(cached)state={...state,position:cached};}
function onFix(p:any){
 if(!Number.isFinite(Number(p?.latitude))||!Number.isFinite(Number(p?.longitude)))throw new Error("Location coordinates were invalid");
 const next:LivePosition={latitude:Number(p.latitude),longitude:Number(p.longitude),accuracy:Number(p.accuracy||0),altitude:p.altitude==null?null:Number(p.altitude),heading:normalizeHeading(p.heading),speed:p.speed==null?null:Number(p.speed),timestamp:Number(p.timestamp||Date.now())};
 try{localStorage.setItem(LAST_POSITION_KEY,JSON.stringify(next));}catch{/* optional */}
 emit({status:"granted",position:next,error:null});
}
function onBrowserFix(position:GeolocationPosition){
 // GeolocationCoordinates contains prototype getters; object spread omits their values on Android and Safari.
 const c=position.coords;
 onFix({latitude:c.latitude,longitude:c.longitude,accuracy:c.accuracy,altitude:c.altitude,heading:c.heading,speed:c.speed,timestamp:position.timestamp});
}
function onBrowserError(error:GeolocationPositionError){const denied=error.code===error.PERMISSION_DENIED;emit({status:denied?"denied":state.position?"granted":"unavailable",error:error.message||(denied?"Location permission denied":"Location unavailable. Choose your campus manually.")});}
function orientationHandler(event:DeviceOrientationEvent & {webkitCompassHeading?:number}){const heading=normalizeHeading(event.webkitCompassHeading)??(event.alpha==null?null:normalizeHeading(360-event.alpha));if(heading!=null)emit({deviceHeading:heading,orientationAvailable:true});}
function attachOrientation(){if(typeof window==="undefined"||orientationListening)return;orientationListening=true;window.addEventListener("deviceorientationabsolute",orientationHandler as EventListener,true);window.addEventListener("deviceorientation",orientationHandler as EventListener,true);}
async function requestOrientation(){if(typeof window==="undefined")return;const ctor=(window as any).DeviceOrientationEvent;if(!ctor)return;try{if(typeof ctor.requestPermission==="function"&&await ctor.requestPermission()!=="granted")return;attachOrientation();}catch{/* optional */}}
function nativeProvider(){return (window as any).Capacitor?.Plugins?.ResKonnectLocation as {getPosition:()=>Promise<any>}|undefined;}
async function nativeFix(){const provider=nativeProvider();if(!provider?.getPosition)throw new Error("Native location module unavailable. Update ResKonnect or select your campus manually.");let timer:ReturnType<typeof setTimeout>|undefined;try{const result=await Promise.race([provider.getPosition(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Location timed out. Select your campus manually or retry outside.")),14000);})]);onFix(result);}finally{if(timer)clearTimeout(timer);}}
function startWatch(){
 if(typeof window==="undefined")return;
 if(isNativeApp()){if(nativePolling)return;nativePolling=setInterval(()=>{if(document.visibilityState==="visible")void nativeFix().catch(()=>{/* retain last valid position */});},60000);return;}
 if(!navigator.geolocation){emit({status:"unavailable",error:"Your browser does not support geolocation."});return;}
 if(watchId!=null)return;
 watchId=navigator.geolocation.watchPosition(onBrowserFix,onBrowserError,{enableHighAccuracy:false,maximumAge:30000,timeout:14000});
}
export async function requestLiveLocation(){
 if(typeof window==="undefined")return false;
 if(pending)return pending;
 emit({status:"requesting",error:null});void requestOrientation();
 pending=(async()=>{
  if(isNativeApp()){
   try{await nativeFix();try{localStorage.setItem(OPT_IN_KEY,"1");}catch{/* optional */}startWatch();return true;}
   catch(error:any){const message=String(error?.message||"Location unavailable. Select a campus manually.");const denied=String(error?.code||"")==="PERMISSION_DENIED"||/permission.*denied/i.test(message);emit({status:denied?"denied":"unavailable",error:message});return false;}
  }
  if(!navigator.geolocation){emit({status:"unavailable",error:"This browser does not support geolocation."});return false;}
  return await new Promise<boolean>(resolve=>{
   let finished=false;
   const timer=setTimeout(()=>{if(finished)return;finished=true;emit({status:"unavailable",error:"Location timed out. Select your campus manually."});resolve(false);},15000);
   navigator.geolocation.getCurrentPosition(pos=>{if(finished)return;finished=true;clearTimeout(timer);onBrowserFix(pos);try{localStorage.setItem(OPT_IN_KEY,"1");}catch{/* optional */}startWatch();resolve(true);},error=>{if(finished)return;finished=true;clearTimeout(timer);onBrowserError(error);resolve(false);},{enableHighAccuracy:false,maximumAge:30000,timeout:12000});
  });
 })();try{return await pending;}finally{pending=null;}
}
export function resumeLiveLocationIfOptedIn(){if(typeof window==="undefined")return;try{if(localStorage.getItem(OPT_IN_KEY)!=="1")return;}catch{return;}attachOrientation();if(isNativeApp()){if(state.status==="granted")startWatch();}else startWatch();}
export function hasLiveLocationOptIn(){if(typeof window==="undefined")return false;try{return localStorage.getItem(OPT_IN_KEY)==="1";}catch{return false;}}
export function stopLiveLocation(){
 if(typeof navigator!=="undefined"&&navigator.geolocation&&watchId!=null)navigator.geolocation.clearWatch(watchId);watchId=null;
 if(nativePolling)clearInterval(nativePolling);nativePolling=null;
 if(typeof window!=="undefined"){window.removeEventListener("deviceorientationabsolute",orientationHandler as EventListener,true);window.removeEventListener("deviceorientation",orientationHandler as EventListener,true);orientationListening=false;try{localStorage.removeItem(OPT_IN_KEY);}catch{/* optional */}}
 emit({status:"idle",deviceHeading:null,orientationAvailable:false,error:null});
}
export function subscribeLiveLocation(listener:(next:LiveLocationState)=>void){subscribers.add(listener);listener(state);return()=>{subscribers.delete(listener);};}
export function getLiveLocationState(){return state;}
export function useLiveLocation(){const [,setSnapshot]=useState<LiveLocationState>(state);useEffect(()=>{resumeLiveLocationIfOptedIn();return subscribeLiveLocation(setSnapshot);},[]);return {get status(){return state.status;},get position(){return state.position;},get deviceHeading(){return state.deviceHeading;},get orientationAvailable(){return state.orientationAvailable;},get error(){return state.error;},get effectiveHeading(){return state.position?.heading??state.deviceHeading;}};}
export function distanceKm(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){const r=(value:number)=>value*Math.PI/180;const h=Math.sin(r(b.latitude-a.latitude)/2)**2+Math.cos(r(a.latitude))*Math.cos(r(b.latitude))*Math.sin(r(b.longitude-a.longitude)/2)**2;return 2*6371*Math.asin(Math.sqrt(h));}
