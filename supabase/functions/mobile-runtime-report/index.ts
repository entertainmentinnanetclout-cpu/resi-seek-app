import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const env=(name:string)=>Deno.env.get(name)||"";
const url=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const anon=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const service=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const allowed=new Set(["post_login_stable","ui_error","renderer_recovery","boot"]);
const safe=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

function scrubMetadata(value:unknown){
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  const blocked=/token|password|secret|email|phone|student|identity|passport|cookie|authorization/i;
  const out:Record<string,unknown>={};
  for(const [key,val] of Object.entries(value as Record<string,unknown>)){
    if(blocked.test(key))continue;
    if(["string","number","boolean"].includes(typeof val))out[key]=typeof val==="string"?safe(val,180):val;
  }
  return JSON.stringify(out).length<=1800?out:{};
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!url||!anon||!service)return json({error:"Runtime not configured"},500);
  const authHeader=req.headers.get("Authorization")||"";
  if(!authHeader)return json({error:"Authentication required"},401);

  const auth=createClient(url,anon,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await auth.auth.getUser();
  if(userError||!user)return json({error:"Authentication required"},401);

  const body=await req.json().catch(()=>({}));
  const eventType=safe(body?.event_type,60);
  if(!allowed.has(eventType))return json({error:"Invalid event type"},400);

  const release=safe(body?.release,32);
  if(!release)return json({error:"Release is required"},400);

  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const since=new Date(Date.now()-60_000).toISOString();
  const {count}=await db.from("mobile_runtime_events").select("id",{head:true,count:"exact"}).eq("user_id",user.id).gte("created_at",since);
  if(Number(count||0)>=12)return json({ok:true,rate_limited:true});

  const {error}=await db.from("mobile_runtime_events").insert({
    user_id:user.id,
    platform:"android",
    release,
    version_code:Number.isFinite(Number(body?.version_code))?Number(body.version_code):null,
    event_type:eventType,
    stage:safe(body?.stage,120)||null,
    message:safe(body?.message,500)||null,
    metadata:scrubMetadata(body?.metadata),
  });
  if(error)return json({error:"Could not record runtime event"},500);
  return json({ok:true});
});