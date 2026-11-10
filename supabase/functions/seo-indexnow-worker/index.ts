import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const env=(k:string)=>Deno.env.get(k)||"";
const url=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const service=createClient(url,serviceKey,{auth:{persistSession:false}});
const HOST="www.reskonnect.org";
const INDEXNOW_KEY="9b698dd216df7a00d2f9a598a4372726";
const KEY_LOCATION=`https://${HOST}/${INDEXNOW_KEY}.txt`;
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-seo-cron-token","Access-Control-Allow-Methods":"POST,OPTIONS"};

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});

async function authorized(req:Request){
  const token=req.headers.get("x-seo-cron-token")||"";
  if(!token)return false;
  const {data}=await service.from("adminos_scheduler_secrets").select("secret_value").eq("secret_key","seo_indexnow_worker").maybeSingle();
  const expected=String(data?.secret_value||"");
  if(!expected||token.length!==expected.length)return false;
  let diff=0;for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^expected.charCodeAt(i);
  return diff===0;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  if(!url||!serviceKey)return json({error:"supabase_not_configured"},500);
  if(!await authorized(req))return json({error:"unauthorized"},401);

  const {data:rows,error}=await service.from("seo_index_queue")
    .select("id,path,action,attempts,queued_at")
    .in("status",["pending","failed"])
    .lt("attempts",5)
    .order("queued_at",{ascending:true})
    .limit(100);
  if(error)return json({error:"queue_read_failed",detail:error.message},500);
  if(!rows?.length)return json({ok:true,processed:0,reason:"queue_empty"});

  const ids=rows.map((r:any)=>r.id);
  await service.from("seo_index_queue").update({status:"processing",last_error:null}).in("id",ids);

  const urlList=rows.map((r:any)=>{
    const p=String(r.path||"/").startsWith("/")?String(r.path||"/"):`/${String(r.path||"")}`;
    return `https://${HOST}${p}`;
  });

  try{
    const response=await fetch("https://api.indexnow.org/indexnow",{
      method:"POST",
      headers:{"Content-Type":"application/json; charset=utf-8"},
      body:JSON.stringify({host:HOST,key:INDEXNOW_KEY,keyLocation:KEY_LOCATION,urlList})
    });
    const detail=await response.text().catch(()=>"");
    if(!response.ok)throw new Error(`IndexNow HTTP ${response.status}${detail?`: ${detail.slice(0,500)}`:""}`);

    await Promise.all(rows.map((r:any)=>service.from("seo_index_queue").update({
      status:"submitted",attempts:Number(r.attempts||0)+1,processed_at:new Date().toISOString(),last_error:null
    }).eq("id",r.id)));

    return json({ok:true,processed:rows.length,status:response.status,host:HOST});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await Promise.all(rows.map((r:any)=>service.from("seo_index_queue").update({
      status:"failed",attempts:Number(r.attempts||0)+1,last_error:message
    }).eq("id",r.id)));
    return json({error:"indexnow_submission_failed",detail:message,failed:rows.length},502);
  }
});
