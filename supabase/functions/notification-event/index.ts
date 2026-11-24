import {createClient} from "https://esm.sh/@supabase/supabase-js@2.79.0";

/** Signed database-to-Edge dispatcher. HMAC authenticates a single persisted
 * notification ID, never an untrusted recipient or arbitrary message body. */
const supabaseUrl=Deno.env.get("SUPABASE_URL")||Deno.env.get("EXTERNAL_SUPABASE_URL")||"";
const serviceKey=Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});
const hexBytes=(value:string)=>new Uint8Array(value.match(/../g)!.map(pair=>parseInt(pair,16)));
const safeRoute=(value:unknown)=>{
 const v=String(value||"/dashboard/updates");
 return v.startsWith("/")&&!v.startsWith("//")&&!v.startsWith("/_")&&v.length<600?v:"/dashboard/updates";
};

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 if(!supabaseUrl||!serviceKey)return json({error:"Push dispatcher not configured"},503);
 const sig=req.headers.get("x-reskonnect-event-signature")||"";
 if(!/^[a-f0-9]{64}$/i.test(sig))return json({error:"Invalid notification signature"},401);
 const payload=await req.json().catch(()=>null);
 const id=String(payload?.notification_id||"");
 if(!uuid.test(id))return json({error:"Invalid notification id"},400);
 const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const {data:secret,error:secretError}=await admin.rpc("rk_notification_dispatch_hmac_secret");
  if(secretError||typeof secret!=="string"||secret.length<32)return json({error:"Dispatcher authentication is unavailable"},503);
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  const verified=await crypto.subtle.verify("HMAC",key,hexBytes(sig),new TextEncoder().encode(id));
  if(!verified)return json({error:"Invalid notification signature"},401);
  const {data:notice,error:noticeError}=await admin.from("notifications")
   .select("id,user_id,type,title,metadata").eq("id",id).maybeSingle();
  if(noticeError)return json({error:"Notification lookup unavailable"},503);
  if(!notice?.user_id)return json({ok:true,skipped:"no_user"});
  // Prevent replayed webhook requests from sending duplicate lock-screen alerts.
  const {error:claimError}=await admin.from("rk_notification_push_dispatches")
    .insert({notification_id:id,state:"processing"});
  if(claimError?.code==="23505")return json({ok:true,skipped:"already_queued"});
  if(claimError)return json({error:"Could not reserve notification"},503);
  const type=String(notice.type||"").toLowerCase();
  const category=type.includes("application")?"application":
   type.includes("reservation")?"reservation":
   type.includes("single_room")?"single room":
   type.includes("enquir")||type.includes("inquir")||type.includes("message")?"enquiry":"account";
  const route=safeRoute(notice.metadata?.url||notice.metadata?.route||"/dashboard/updates");
  // Lock-screen wording stays generic and does not include names, grades,
  // application documents, messages or other private student details.
  const {data:result,error:dispatchError}=await admin.functions.invoke("send-push",{
   body:{title:"ResKonnect "+category+" update",body:"Open ResKonnect to review your latest update.",url:route,user_ids:[notice.user_id]}
  });
  const sent=Number(result?.web?.sent||0)+Number(result?.android?.sent||0);
  const failed=Boolean(dispatchError)||Number(result?.web?.failed||0)>0||Number(result?.android?.failed||0)>0;
  await admin.from("rk_notification_push_dispatches").update({
   state:failed?"failed":sent>0?"dispatched":"no_device",
   web_delivered:Number(result?.web?.sent||0),
   native_delivered:Number(result?.android?.sent||0),
   last_error:failed?"Provider delivery error":null,
   updated_at:new Date().toISOString(),
  }).eq("notification_id",id);
  if(failed)return json({ok:false,error:"Push delivery incomplete"},503);
  return json({ok:true,sent:sent>0});
 }catch(error){
  console.error("[notification-event] dispatch failed",error instanceof Error?error.name:"unknown");
  return json({error:"Notification delivery unavailable"},503);
 }
});
