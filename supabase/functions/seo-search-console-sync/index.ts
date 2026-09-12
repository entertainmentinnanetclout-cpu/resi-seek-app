import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const env=(k:string)=>Deno.env.get(k)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-seo-cron-token","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});

const b64url=(input:Uint8Array|string)=>{
  const bytes=typeof input==="string"?new TextEncoder().encode(input):input;
  let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const pemBytes=(pem:string)=>{
  const raw=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
  const binary=atob(raw);const out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;
};
const normalizePath=(value:string)=>{
  try{const u=new URL(value);return u.pathname.length>1?u.pathname.replace(/\/+$/,""):u.pathname||"/";}
  catch{let p=(value||"/").split("?")[0].split("#")[0];if(!p.startsWith("/"))p="/"+p;return p.length>1?p.replace(/\/+$/,""):p;}
};
const isoDate=(d:Date)=>d.toISOString().slice(0,10);

async function authorized(req:Request){
  const token=req.headers.get("x-seo-cron-token")||"";
  if(!token)return false;
  const {data}=await service.from("adminos_scheduler_secrets").select("secret_value").eq("secret_key","seo_search_console_sync").maybeSingle();
  const expected=String(data?.secret_value||"");
  if(!expected||token.length!==expected.length)return false;
  let diff=0;for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^expected.charCodeAt(i);
  return diff===0;
}

function parseServiceAccount(){
  const raw=env("GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON");
  if(!raw)return null;
  try{return JSON.parse(raw);}
  catch{
    try{return JSON.parse(atob(raw));}catch{return null;}
  }
}

async function googleAccessToken(sa:any){
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claims=b64url(JSON.stringify({
    iss:sa.client_email,
    scope:"https://www.googleapis.com/auth/webmasters.readonly",
    aud:"https://oauth2.googleapis.com/token",
    iat:now,exp:now+3600
  }));
  const unsigned=`${header}.${claims}`;
  const key=await crypto.subtle.importKey("pkcs8",pemBytes(sa.private_key),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
  const assertion=`${unsigned}.${b64url(new Uint8Array(sig))}`;
  const body=new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion});
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.access_token)throw new Error(data.error_description||data.error||`Google token HTTP ${r.status}`);
  return String(data.access_token);
}

async function setIntegration(patch:Record<string,unknown>){
  await service.from("adminos_integration_connections").update({...patch,updated_at:new Date().toISOString()}).eq("provider","google_search_console");
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  if(!supabaseUrl||!serviceKey)return json({error:"supabase_not_configured"},500);
  if(!await authorized(req))return json({error:"unauthorized"},401);

  const body=await req.json().catch(()=>({}));
  const requestedDays=Math.max(1,Math.min(14,Number(body.days||7)));
  const sa=parseServiceAccount();
  if(!sa?.client_email||!sa?.private_key){
    await setIntegration({status:"needs_action",enabled:false,setup_step:2,last_tested_at:new Date().toISOString(),last_error_at:new Date().toISOString(),last_error:"GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON is not configured"});
    return json({error:"search_console_credentials_missing",setup_required:true},503);
  }

  const {data:connection}=await service.from("adminos_integration_connections").select("config").eq("provider","google_search_console").maybeSingle();
  const siteUrl=String(connection?.config?.site_url||env("GOOGLE_SEARCH_CONSOLE_SITE_URL")||"sc-domain:reskonnect.org");

  try{
    const token=await googleAccessToken(sa);
    const end=new Date();end.setUTCDate(end.getUTCDate()-1);
    let imported=0;let daysSynced=0;

    for(let offset=requestedDays-1;offset>=0;offset--){
      const day=new Date(end);day.setUTCDate(end.getUTCDate()-offset);
      const date=isoDate(day);
      const endpoint=`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
      const response=await fetch(endpoint,{
        method:"POST",
        headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body:JSON.stringify({startDate:date,endDate:date,dimensions:["query","page","device","country"],rowLimit:25000,startRow:0})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error?.message||`Search Console HTTP ${response.status}`);
      const rows=Array.isArray(data.rows)?data.rows:[];
      const mapped=rows.map((row:any)=>{
        const keys=Array.isArray(row.keys)?row.keys:[];
        return {
          metric_date:date,query:String(keys[0]||""),page_path:normalizePath(String(keys[1]||"/")),
          device:String(keys[2]||"unknown"),country:String(keys[3]||"unknown"),
          clicks:Number(row.clicks||0),impressions:Number(row.impressions||0),ctr:Number(row.ctr||0),
          avg_position:row.position==null?null:Number(row.position),source:"google_search_console",
          metadata:{site_url:siteUrl},imported_at:new Date().toISOString()
        };
      });
      for(let i=0;i<mapped.length;i+=1000){
        const chunk=mapped.slice(i,i+1000);
        const {error}=await service.from("adminos_search_console_query_metrics").upsert(chunk,{onConflict:"metric_date,query,page_path,device,country"});
        if(error)throw new Error(error.message);
      }
      imported+=mapped.length;daysSynced++;
    }

    const {data:cycle,error:cycleError}=await service.rpc("adminos_rg12_seo_cycle");
    if(cycleError)throw new Error(cycleError.message);

    await setIntegration({status:"connected",enabled:true,setup_step:3,last_tested_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:null,last_error_at:null});
    return json({ok:true,site_url:siteUrl,days_synced:daysSynced,rows_imported:imported,cycle});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await setIntegration({status:"error",enabled:true,last_tested_at:new Date().toISOString(),last_error_at:new Date().toISOString(),last_error:message});
    return json({error:"search_console_sync_failed",detail:message},502);
  }
});
