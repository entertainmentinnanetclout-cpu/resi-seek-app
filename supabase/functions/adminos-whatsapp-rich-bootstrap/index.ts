import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env=(n:string)=>Deno.env.get(n)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const accountSid=env("TWILIO_ACCOUNT_SID");
const authToken=env("TWILIO_AUTH_TOKEN");
const basic=()=>`Basic ${btoa(`${accountSid}:${authToken}`)}`;
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});

async function twilioJson(url:string,options:RequestInit={}){
  if(!accountSid||!authToken) throw new Error("Twilio credentials are not configured");
  const r=await fetch(url,{...options,headers:{Authorization:basic(),...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d?.message||d?.detail||d?.error?.message||`Twilio HTTP ${r.status}`);
  return d;
}

function samplesFor(config:any){
  const raw=JSON.stringify(config||{}); const vars:Record<string,string>={};
  for(const m of raw.matchAll(/\{\{(\d+)\}\}/g)){
    const n=m[1];
    vars[n]=n==="1"?"Ayanda":n==="2"?"Example Residence":"Under review";
  }
  return vars;
}

async function listRemote(){
  const d=await twilioJson("https://content.twilio.com/v1/Content?PageSize=1000");
  return Array.isArray(d?.contents)?d.contents:Array.isArray(d?.content)?d.content:[];
}

async function approvalStatus(sid:string){
  const d=await twilioJson(`https://content.twilio.com/v1/Content/${encodeURIComponent(sid)}/ApprovalRequests`);
  const wa=d?.whatsapp||{};
  return {status:String(wa.status||"unknown").toLowerCase(),rejection_reason:wa.rejection_reason||null,category:wa.category||null};
}

async function submitApproval(sid:string,name:string){
  try{
    return await twilioJson(`https://content.twilio.com/v1/Content/${encodeURIComponent(sid)}/ApprovalRequests/whatsapp`,{method:"POST",body:JSON.stringify({name,category:"UTILITY"})});
  }catch(e){
    const msg=e instanceof Error?e.message:String(e);
    if(/already|submitted|exists|duplicate/i.test(msg)) return {status:"pending",duplicate:true};
    throw e;
  }
}

async function authorized(req:Request,service:any){
  const token=req.headers.get("x-adminos-cron-token")||"";
  if(!token) return false;
  const row=await service.from("adminos_scheduler_secrets").select("secret_value").eq("secret_key","whatsapp_event_worker").maybeSingle();
  const expected=String(row.data?.secret_value||""); if(!expected||token.length!==expected.length)return false;
  let diff=0; for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^expected.charCodeAt(i); return diff===0;
}

serve(async(req)=>{
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey)return json({error:"Supabase runtime is not configured"},500);
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  if(!(await authorized(req,service)))return json({error:"Unauthorized"},401);
  const body=await req.json().catch(()=>({})); const action=String(body.action||"bootstrap");
  try{
    const rows=(await service.from("adminos_whatsapp_rich_content").select("*").neq("status","disabled").order("created_at")).data||[];
    const remote=await listRemote(); const byName=new Map(remote.map((x:any)=>[String(x.friendly_name||x.friendlyName||""),x]));
    const results:any[]=[];
    for(const row of rows){
      let sid=row.content_sid as string|null;
      try{
        if(!sid){
          const existing:any=byName.get(row.content_key);
          if(existing?.sid)sid=existing.sid;
          else{
            const created=await twilioJson("https://content.twilio.com/v1/Content",{method:"POST",body:JSON.stringify({friendly_name:row.content_key,language:"en",variables:samplesFor(row.config),types:{[row.content_type]:row.config}})});
            sid=created?.sid||null;
          }
          if(!sid)throw new Error("Twilio did not return a Content SID");
          await service.from("adminos_whatsapp_rich_content").update({content_sid:sid,status:"created",metadata:{...(row.metadata||{}),created_at_twilio:new Date().toISOString()},updated_at:new Date().toISOString()}).eq("id",row.id);
        }
        if(row.approval_required){
          if(action!=="sync")await submitApproval(sid,row.content_key);
          const a=await approvalStatus(sid).catch(()=>({status:"pending",rejection_reason:null,category:"UTILITY"}));
          const mapped=a.status==="approved"?"approved":a.status==="rejected"?"rejected":"pending_approval";
          await service.from("adminos_whatsapp_rich_content").update({status:mapped,metadata:{...(row.metadata||{}),twilio_approval:a,synced_at:new Date().toISOString()},updated_at:new Date().toISOString()}).eq("id",row.id);
          results.push({content_key:row.content_key,content_sid:sid,status:mapped,rejection_reason:a.rejection_reason});
        }else{
          await service.from("adminos_whatsapp_rich_content").update({status:"created",updated_at:new Date().toISOString()}).eq("id",row.id);
          results.push({content_key:row.content_key,content_sid:sid,status:"created"});
        }
      }catch(e){
        const error=e instanceof Error?e.message:String(e);
        await service.from("adminos_whatsapp_rich_content").update({status:"provider_error",metadata:{...(row.metadata||{}),provider_error:error,provider_error_at:new Date().toISOString()},updated_at:new Date().toISOString()}).eq("id",row.id);
        results.push({content_key:row.content_key,content_sid:sid,status:"provider_error",error});
      }
    }
    return json({ok:true,action,processed:results.length,results});
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},500);}
});