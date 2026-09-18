import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const env=(name:string)=>Deno.env.get(name)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const safe=(v:unknown,max=500)=>String(v??"").trim().slice(0,max);
const RELEASE=2;

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey||!anonKey)return json({error:"Supabase runtime is not configured"},500);
  const body=await req.json().catch(()=>({}));
  const action=safe(body?.action||"public_enquiry",80);
  if(!["health","public_enquiry","enquiry_reply"].includes(action))return json({error:"Unsupported action"},400);

  const authHeader=req.headers.get("Authorization")||"";
  let userId:string|null=null;
  if(authHeader){
    try{
      const auth=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
      userId=(await auth.auth.getUser()).data?.user?.id||null;
    }catch{}
  }

  const payload={
    ...body,
    action:action==="health"?"health":"chat",
    agent_key:"luna",
    channel:action==="enquiry_reply"?"in_app":"website",
    context_user_id:userId||body?.context_user_id||null,
    thread_ref:body?.thread_ref||body?.context?.thread_ref||body?.context?.session_id||body?.session_id||null,
    context:{...(body?.context||{}),legacy_entrypoint:"luna-agent",luna_release:RELEASE}
  };
  const response=await fetch(supabaseUrl+"/functions/v1/reskonnect-brain",{method:"POST",headers:{Authorization:authHeader||("Bearer "+anonKey),apikey:anonKey,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const text=await response.text();
  return new Response(text,{status:response.status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
});