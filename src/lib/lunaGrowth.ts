import { supabase } from "@/integrations/supabase/client";

export type LunaAttribution = {
  campaignCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  capturedAt?: number;
};

const VISITOR_KEY="rk_growth_visitor";
const SESSION_KEY="rk_growth_session";
const ATTR_KEY="rk_growth_attribution";
const LANDING_KEY="rk_growth_landing_logged";
const ATTR_TTL_MS=30*24*60*60*1000;
let authBindingStarted=false;

const storageSafe=(storage:Storage,key:string)=>{try{return storage.getItem(key);}catch{return null;}};
const setStorageSafe=(storage:Storage,key:string,value:string)=>{try{storage.setItem(key,value);}catch{/* analytics must never block UX */}};
const removeStorageSafe=(storage:Storage,key:string)=>{try{storage.removeItem(key);}catch{/* no-op */}};

export function getLunaVisitorId(){
  let id=storageSafe(localStorage,VISITOR_KEY);
  if(!id){id=crypto.randomUUID();setStorageSafe(localStorage,VISITOR_KEY,id);}
  return id;
}

export function getLunaSessionId(){
  let id=storageSafe(sessionStorage,SESSION_KEY);
  if(!id){id=crypto.randomUUID();setStorageSafe(sessionStorage,SESSION_KEY,id);}
  return id;
}

function readUrlAttribution():LunaAttribution{
  const q=new URLSearchParams(window.location.search);
  return{
    campaignCode:q.get("rk_campaign")||q.get("utm_campaign")||undefined,
    utmSource:q.get("utm_source")||undefined,
    utmMedium:q.get("utm_medium")||undefined,
    utmCampaign:q.get("utm_campaign")||undefined,
    utmContent:q.get("utm_content")||undefined,
    utmTerm:q.get("utm_term")||undefined,
  };
}

function readStoredAttribution():LunaAttribution{
  try{
    const parsed=JSON.parse(storageSafe(localStorage,ATTR_KEY)||"{}") as LunaAttribution;
    if(!parsed.capturedAt||Date.now()-parsed.capturedAt>ATTR_TTL_MS){removeStorageSafe(localStorage,ATTR_KEY);return{};}
    return parsed;
  }catch{return{};}
}

export function getLunaAttribution():LunaAttribution{
  const fromUrl=readUrlAttribution();
  if(Object.values(fromUrl).some(Boolean)){
    const stored={...fromUrl,capturedAt:Date.now()};
    setStorageSafe(localStorage,ATTR_KEY,JSON.stringify(stored));
    return stored;
  }
  return readStoredAttribution();
}

function referrerHost(){try{return document.referrer?new URL(document.referrer).hostname:null;}catch{return null;}}

async function syncAttributionSession(attr:LunaAttribution=getLunaAttribution()){
  try{
    await (supabase as any).rpc("luna_capture_attribution",{
      p_visitor_hash:getLunaVisitorId(),
      p_session_id:getLunaSessionId(),
      p_landing_path:`${window.location.pathname}${window.location.search}`.slice(0,500),
      p_campaign_code:attr.campaignCode||null,
      p_utm_source:attr.utmSource||null,
      p_utm_medium:attr.utmMedium||null,
      p_utm_campaign:attr.utmCampaign||null,
      p_utm_content:attr.utmContent||null,
      p_utm_term:attr.utmTerm||null,
      p_referrer_host:referrerHost(),
    });
  }catch{/* attribution capture must never block UX */}
}

export async function captureLunaDemandEvent(eventType:string,payload:Record<string,unknown>={}){
  const attr=getLunaAttribution();
  try{
    await (supabase as any).rpc("luna_log_demand_event",{
      p_event_type:eventType,
      p_visitor_hash:getLunaVisitorId(),
      p_session_id:getLunaSessionId(),
      p_payload:{...payload,campaign_code:attr.campaignCode||attr.utmCampaign||null},
    });
  }catch{/* non-blocking instrumentation */}
}

function bindAttributionToAuth(){
  if(authBindingStarted)return;
  authBindingStarted=true;
  supabase.auth.onAuthStateChange((event,session)=>{
    if(session?.user&&["INITIAL_SESSION","SIGNED_IN","TOKEN_REFRESHED","USER_UPDATED"].includes(event)){
      window.setTimeout(()=>{void syncAttributionSession();},0);
    }
  });
}

export async function initLunaAttribution(){
  if(typeof window==="undefined")return;
  bindAttributionToAuth();
  const attr=getLunaAttribution();
  const sessionId=getLunaSessionId();
  await syncAttributionSession(attr);
  const landingStamp=`${sessionId}:${window.location.pathname}:${attr.campaignCode||attr.utmCampaign||"organic"}`;
  if(storageSafe(sessionStorage,LANDING_KEY)!==landingStamp){
    setStorageSafe(sessionStorage,LANDING_KEY,landingStamp);
    await captureLunaDemandEvent(attr.campaignCode||attr.utmCampaign?"campaign_visit":"landing",{surface:"website",path:window.location.pathname});
  }
}
