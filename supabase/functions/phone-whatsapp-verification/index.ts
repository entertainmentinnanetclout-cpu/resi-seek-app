import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const env=(k:string)=>Deno.env.get(k)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const accountSid=env("TWILIO_ACCOUNT_SID");
const authToken=env("TWILIO_AUTH_TOKEN");
const db=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
const now=()=>new Date().toISOString();
const allow=new Set(["https://www.reskonnect.org","https://reskonnect.org","http://localhost:8080"]);
const cors=(req:Request)=>({
  "Access-Control-Allow-Origin":allow.has(req.headers.get("origin")||"")?(req.headers.get("origin")||"https://www.reskonnect.org"):"https://www.reskonnect.org",
  "Access-Control-Allow-Headers":"authorization,content-type,apikey,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Vary":"Origin"
});
const json=(req:Request,b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(req),"Content-Type":"application/json","Cache-Control":"no-store"}});
const norm=(v:string)=>{
  const d=String(v||"").replace(/\D/g,"");
  if(/^27[6-8]\d{8}$/.test(d))return "+"+d;
  if(/^0[6-8]\d{8}$/.test(d))return "+27"+d.slice(1);
  if(/^[6-8]\d{8}$/.test(d))return "+27"+d;
  return "";
};
async function currentUser(req:Request){
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return null;
  const {data,error}=await db.auth.getUser(token);
  return error?null:data.user;
}
async function twilio(url:string,fields:Record<string,string>){
  if(!accountSid||!authToken)throw new Error("Twilio credentials are not configured.");
  const r=await fetch(url,{
    method:"POST",
    headers:{Authorization:"Basic "+btoa(accountSid+":"+authToken),"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams(fields)
  });
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(body?.message||body?.detail||("Twilio HTTP "+r.status));
  return body;
}
async function verifyService(){
  const {data:conn,error}=await db.from("adminos_integration_connections").select("config").eq("provider","twilio_verify").maybeSingle();
  if(error)throw error;
  const existing=String(conn?.config?.service_sid||"");
  if(existing.startsWith("VA"))return existing;
  const created=await twilio("https://verify.twilio.com/v2/Services",{FriendlyName:"ResKonnect Security",CodeLength:"6"});
  const sid=String(created?.sid||"");
  if(!sid.startsWith("VA"))throw new Error("Twilio Verify service provisioning failed.");
  await db.from("adminos_integration_connections").update({
    status:"connected",enabled:true,setup_step:3,external_account_label:"ResKonnect Security",
    config:{...(conn?.config||{}),service_sid:sid,channel:"whatsapp",service_auto_provision:true},
    last_tested_at:now(),last_success_at:now(),last_error:null,last_error_at:null,updated_at:now()
  }).eq("provider","twilio_verify");
  return sid;
}
async function securityEvent(userId:string,type:string,risk:string,outcome:string,meta:any={}){
  await db.from("user_security_events").insert({user_id:userId,event_type:type,risk_level:risk,outcome,metadata:meta}).catch(()=>null);
}
async function rateLimit(userId:string,phone:string){
  const t=Date.now();
  const [a,b,c]=await Promise.all([
    db.from("user_phone_verification_attempts").select("id",{count:"exact",head:true}).eq("user_id",userId).gte("requested_at",new Date(t-60000).toISOString()),
    db.from("user_phone_verification_attempts").select("id",{count:"exact",head:true}).or("user_id.eq."+userId+",phone_e164.eq."+phone).gte("requested_at",new Date(t-900000).toISOString()),
    db.from("user_phone_verification_attempts").select("id",{count:"exact",head:true}).or("user_id.eq."+userId+",phone_e164.eq."+phone).gte("requested_at",new Date(t-86400000).toISOString())
  ]);
  if((a.count||0)>=1)return {ok:false,message:"Please wait before requesting another code.",retry_after:60};
  if((b.count||0)>=3)return {ok:false,message:"Too many codes requested. Try again in 15 minutes.",retry_after:900};
  if((c.count||0)>=6)return {ok:false,message:"Daily verification limit reached. Try again later.",retry_after:86400};
  return {ok:true,message:"",retry_after:0};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors(req)});
  if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
  if(!supabaseUrl||!serviceKey)return json(req,{error:"backend_not_configured"},500);

  const user=await currentUser(req);
  if(!user)return json(req,{error:"authentication_required"},401);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"status");

  const {data:p,error}=await db.from("profiles")
    .select("id,phone,phone_number,phone_e164,phone_verified_at,security_level")
    .eq("id",user.id).maybeSingle();
  if(error||!p)return json(req,{error:"profile_not_found"},404);

  const savedPhone=norm(String(p.phone_e164||p.phone||p.phone_number||""));
  if(action==="status")return json(req,{phone:savedPhone,phone_verified:Boolean(p.phone_verified_at),phone_verified_at:p.phone_verified_at,security_level:p.security_level||"basic"});

  const phone=norm(String(body.phone||savedPhone));
  if(!phone)return json(req,{error:"invalid_phone",message:"Enter a valid South African mobile number."},400);
  if(savedPhone&&savedPhone!==phone)return json(req,{error:"phone_mismatch",message:"Save this number to your ResKonnect profile before verifying it."},409);

  if(action==="start"){
    if(p.phone_verified_at&&savedPhone===phone)return json(req,{ok:true,already_verified:true,phone_verified:true});
    const limit=await rateLimit(user.id,phone);
    if(!limit.ok){
      await securityEvent(user.id,"phone_verification.rate_limited","medium","blocked",{phone_suffix:phone.slice(-4)});
      return json(req,{error:"rate_limited",message:limit.message,retry_after:limit.retry_after},429);
    }
    await db.from("user_phone_verification_attempts").update({status:"cancelled"}).eq("user_id",user.id).in("status",["requested","pending"]);
    try{
      const sid=await verifyService();
      const started=await twilio("https://verify.twilio.com/v2/Services/"+sid+"/Verifications",{To:phone,Channel:"whatsapp"});
      const expiresAt=new Date(Date.now()+600000).toISOString();
      const {data:attempt,error:insertError}=await db.from("user_phone_verification_attempts").insert({
        user_id:user.id,phone_e164:phone,provider:"twilio_verify",channel:"whatsapp",
        verification_sid:String(started?.sid||""),status:"pending",requested_at:now(),last_sent_at:now(),
        expires_at:expiresAt,metadata:{twilio_status:started?.status||"pending"}
      }).select("id,expires_at,status").single();
      if(insertError)throw insertError;
      await securityEvent(user.id,"phone_verification.requested","low","allowed",{phone_suffix:phone.slice(-4),channel:"whatsapp"});
      return json(req,{ok:true,challenge_id:attempt.id,status:attempt.status,expires_at:attempt.expires_at,phone_masked:"••••••"+phone.slice(-4)});
    }catch(e){
      const message=e instanceof Error?e.message:String(e);
      await db.from("adminos_integration_connections").update({status:"error",last_tested_at:now(),last_error_at:now(),last_error:message,updated_at:now()}).eq("provider","twilio_verify");
      await securityEvent(user.id,"phone_verification.delivery_failed","medium","failed",{error:message.slice(0,250)});
      return json(req,{error:"verification_delivery_failed",message},502);
    }
  }

  if(action==="verify"){
    const code=String(body.code||"").replace(/\D/g,"").slice(0,10);
    if(!/^\d{4,10}$/.test(code))return json(req,{error:"invalid_code",message:"Enter the code sent to WhatsApp."},400);
    const {data:a}=await db.from("user_phone_verification_attempts").select("*")
      .eq("user_id",user.id).eq("phone_e164",phone).in("status",["requested","pending"])
      .order("requested_at",{ascending:false}).limit(1).maybeSingle();
    if(!a)return json(req,{error:"challenge_not_found",message:"Request a new WhatsApp verification code."},404);
    if(new Date(a.expires_at).getTime()<Date.now()){
      await db.from("user_phone_verification_attempts").update({status:"expired"}).eq("id",a.id);
      return json(req,{error:"code_expired",message:"This code expired. Request a new one."},410);
    }
    if(Number(a.check_attempts||0)>=5){
      await db.from("user_phone_verification_attempts").update({status:"locked"}).eq("id",a.id);
      return json(req,{error:"challenge_locked",message:"Too many incorrect attempts. Request a new code later."},423);
    }
    const {data:conn}=await db.from("adminos_integration_connections").select("config").eq("provider","twilio_verify").maybeSingle();
    const sid=String(conn?.config?.service_sid||"");
    if(!sid.startsWith("VA"))return json(req,{error:"verify_service_not_ready"},503);
    try{
      const checked=await twilio("https://verify.twilio.com/v2/Services/"+sid+"/VerificationCheck",{To:phone,Code:code});
      const attempts=Number(a.check_attempts||0)+1;
      if(String(checked?.status||"").toLowerCase()!=="approved"){
        const locked=attempts>=5;
        await db.from("user_phone_verification_attempts").update({check_attempts:attempts,status:locked?"locked":"pending",last_error:"Code not approved"}).eq("id",a.id);
        await securityEvent(user.id,"phone_verification.code_rejected",locked?"high":"medium","blocked",{attempts});
        return json(req,{error:locked?"challenge_locked":"incorrect_code",message:locked?"Too many attempts. Request a new code later.":"That code was not accepted. Check WhatsApp and try again.",attempts_remaining:Math.max(0,5-attempts)},locked?423:400);
      }
      const verifiedAt=now();
      await db.from("user_phone_verification_attempts").update({check_attempts:attempts,status:"approved",verified_at:verifiedAt,last_error:null}).eq("id",a.id);
      await db.from("profiles").update({
        phone,phone_number:phone,phone_e164:phone,phone_verified_at:verifiedAt,
        phone_verification_method:"whatsapp_twilio_verify",security_level:"contact_verified",updated_at:verifiedAt
      }).eq("id",user.id);
      await db.from("adminos_contacts").update({phone,updated_at:verifiedAt}).eq("profile_user_id",user.id);
      await securityEvent(user.id,"phone_verification.approved","low","verified",{phone_suffix:phone.slice(-4),channel:"whatsapp"});
      return json(req,{ok:true,phone_verified:true,phone,verified_at:verifiedAt,security_level:"contact_verified"});
    }catch(e){
      const message=e instanceof Error?e.message:String(e);
      await db.from("user_phone_verification_attempts").update({check_attempts:Number(a.check_attempts||0)+1,last_error:message.slice(0,500)}).eq("id",a.id);
      await securityEvent(user.id,"phone_verification.provider_error","medium","failed",{error:message.slice(0,250)});
      return json(req,{error:"verification_check_failed",message},502);
    }
  }
  return json(req,{error:"unsupported_action"},400);
});