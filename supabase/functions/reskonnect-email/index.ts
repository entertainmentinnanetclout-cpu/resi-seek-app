import { createClient } from "npm:@supabase/supabase-js@2.86.2";
import { generateEmailPdf, renderEmailHtml, type EmailDocument } from "./email-branding.ts";

/** Manual, authenticated, transactional Gmail correspondence for ResKonnect. */
type Kind = "application" | "reservation" | "housing_lead" | "support_enquiry";
type Template = "status_update" | "feedback" | "documents_needed" | "next_steps" | "enquiry_response" | "viewing_invite" | "follow_up" | "reservation_confirmation" | "application_acknowledgement" | "resolution_summary" | "reminder";
const source: Record<Kind, string> = {
  application: "applications", reservation: "accommodation_reservations",
  housing_lead: "residence_leads", support_enquiry: "application_support_queries"
};
const choices: Record<Kind, Template[]> = {
  application: ["status_update","feedback","documents_needed","next_steps","follow_up","application_acknowledgement","reminder"],
  reservation: ["status_update","feedback","next_steps","viewing_invite","follow_up","reservation_confirmation","reminder"],
  housing_lead: ["enquiry_response","viewing_invite","feedback","follow_up","reminder"],
  support_enquiry: ["enquiry_response","feedback","next_steps","follow_up","resolution_summary"]
};
const HEADERS = {
  "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store",
  "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"
};
const json = (value:unknown, status=200) => new Response(JSON.stringify(value),{status,headers:HEADERS});
const validUuid = (s:unknown):s is string => typeof s==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const safe = (value:unknown, max=180):string => String(value ?? "").replace(/[\r\n<>]/g," ").trim().slice(0,max);
const validEmail = (s:unknown):s is string => typeof s==="string" && s.length<=254 && /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(s);
const hint = (value:string) => { const p=value.split("@"); return (p[0]?.slice(0,2)||"*")+"***@"+(p[1]||""); };
const toBase64 = (bytes:Uint8Array) => {
  let binary=""; for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
};
const base64url = (value:string) => toBase64(new TextEncoder().encode(value)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const b64wrap=(value:string)=>toBase64(new TextEncoder().encode(value)).match(/.{1,76}/g)?.join("\r\n")||"";
const attachmentWrap=(bytes:Uint8Array)=>toBase64(bytes).match(/.{1,76}/g)?.join("\r\n")||"";
const readable=(value:string)=>safe(value.replace(/_/g," ")).replace(/\b\w/g,x=>x.toUpperCase());

Deno.serve(async (req:Request) => {
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:HEADERS});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const authToken=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!authToken) return json({error:"Sign in to ResKonnect"},401);
  const apiUrl=Deno.env.get("SUPABASE_URL"), serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!apiUrl||!serviceKey) return json({error:"Email service not configured"},503);
  const db=createClient(apiUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:login,error:loginError}=await db.auth.getUser(authToken);
  if(loginError||!login.user) return json({error:"Your login session has expired"},401);
  const actor=login.user.id;
  const [roleResult,portalResult]=await Promise.all([
    db.from("user_roles").select("role").eq("user_id",actor).in("role",["admin","residence_portal"]),
    db.from("residence_portal_accounts").select("residence_id").eq("user_id",actor).eq("is_active",true)
  ]);
  if(roleResult.error||portalResult.error) return json({error:"Could not verify access"},503);
  const isAdmin=!!roleResult.data?.some(r=>r.role==="admin");
  const isLandlord=!!roleResult.data?.some(r=>r.role==="residence_portal") && !!portalResult.data?.length;
  if(!isAdmin&&!isLandlord) return json({error:"Email tools are restricted to authorized staff and landlords"},403);
  const permittedResidences=new Set((portalResult.data||[]).map(r=>r.residence_id));
  let input:{action?:string; kind?:string; target_id?:string; template_key?:string; message?:string; idempotency_key?:string;attach_pdf?:boolean;batch_id?:string}={};
  try {input=await req.json();} catch {return json({error:"Invalid request body"},400);}
  if(input.action==="history"){
    const q=db.from("reskonnect_outbound_emails").select("id,target_kind,target_id,template_key,recipient_email,subject,delivery_status,created_at,sent_at,failure_code,pdf_attached,batch_id")
      .eq("actor_user_id",actor).order("created_at",{ascending:false}).limit(50);
    const {data,error}=await q;
    if(error) return json({error:"Could not retrieve email history"},503);
    return json({items:(data||[]).map(item=>({...item,recipient_email:isAdmin?hint(item.recipient_email):"Private recipient"}))});
  }
  if(input.action==="list"){
    const kind=input.kind as Kind;
    if(!Object.hasOwn(source,kind)) return json({error:"Invalid inbox type"},400);
    if(kind==="support_enquiry"&&!isAdmin) return json({error:"Access denied"},403);
    if(!isAdmin&&permittedResidences.size===0) return json({items:[]});
    let query;
    if(kind==="application") query=db.from(source[kind]).select("id,user_id,residence_id,status,created_at").order("created_at",{ascending:false}).limit(75);
    else if(kind==="reservation") query=db.from(source[kind]).select("id,user_id,residence_id,status,created_at,applicant_name").order("created_at",{ascending:false}).limit(75);
    else if(kind==="housing_lead") query=db.from(source[kind]).select("id,user_id,residence_id,stage,created_at,contact_name,contact_email").order("created_at",{ascending:false}).limit(75);
    else query=db.from(source[kind]).select("id,user_id,status,created_at,full_name,email,consent_to_be_contacted").order("created_at",{ascending:false}).limit(75);
    if(!isAdmin) query=query.in("residence_id",Array.from(permittedResidences));
    const {data,error}=await query;
    if(error) return json({error:"Could not retrieve records"},503);
    const rows=data||[];
    const ids=Array.from(new Set(rows.map((r:any)=>r.user_id).filter(validUuid)));
    const residenceIds=Array.from(new Set(rows.map((r:any)=>r.residence_id).filter(validUuid)));
    const [profiles,residences]=await Promise.all([
      ids.length?db.from("profiles").select("id,email,full_name").in("id",ids):Promise.resolve({data:[],error:null}),
      residenceIds.length?db.from("residences").select("id,name").in("id",residenceIds):Promise.resolve({data:[],error:null})
    ]);
    if(profiles.error||residences.error) return json({error:"Could not resolve contact details"},503);
    const people=new Map((profiles.data||[]).map((r:any)=>[r.id,r]));
    const places=new Map((residences.data||[]).map((r:any)=>[r.id,r.name]));
    const items=rows.map((r:any)=>{
      const p:any=people.get(r.user_id);
      const email=kind==="support_enquiry"?r.email:kind==="housing_lead"?(r.contact_email||p?.email):p?.email;
      const contactAllowed=kind!=="support_enquiry" || r.consent_to_be_contacted===true;
      return {
        id:r.id,kind,label:safe(r.applicant_name||r.contact_name||r.full_name||p?.full_name||"Applicant"),
        status:r.status||r.stage||"new",residence_name:places.get(r.residence_id)||null,
        email_hint:validEmail(email)?(isAdmin?hint(email):"Verified recipient"):null,can_email:validEmail(email)&&contactAllowed,
        created_at:r.created_at
      };
    });
    return json({items});
  }
  if(input.action!=="preview"&&input.action!=="pdf_preview"&&input.action!=="send") return json({error:"Unknown email action"},400);
  const kind=input.kind as Kind, template=input.template_key as Template;
  if(!Object.hasOwn(source,kind) || !choices[kind].includes(template)) return json({error:"Unsupported email template"},400);
  if(!validUuid(input.target_id)) return json({error:"Invalid record ID"},400);
  if(kind==="support_enquiry"&&!isAdmin) return json({error:"Access denied"},403);
  const message=String(input.message||"").trim();
  if(message.length>2500) return json({error:"Message exceeds 2,500 characters"},400);
  if(["feedback","documents_needed","enquiry_response","viewing_invite","follow_up","resolution_summary","reminder"].includes(template) && message.length<8) return json({error:"Add a useful message before sending"},400);
  const {data:target,error:targetError}=await db.from(source[kind]).select("*").eq("id",input.target_id).maybeSingle();
  if(targetError) return json({error:"Record lookup failed"},503);
  if(!target) return json({error:"Record not found"},404);
  if(!isAdmin&&(!target.residence_id||!permittedResidences.has(target.residence_id))) return json({error:"This record belongs to a different residence"},403);
  if(kind==="support_enquiry"&&target.consent_to_be_contacted!==true) return json({error:"Contact permission not recorded for this enquiry"},403);
  if(template==="reservation_confirmation" && target.status!=="confirmed") return json({error:"A reservation confirmation can only be issued after the recorded reservation status is confirmed"},409);
  let recipientEmail:string|null=kind==="support_enquiry"?target.email:kind==="housing_lead"?target.contact_email:null;
  let recipientName:string=target.applicant_name||target.contact_name||target.full_name||"Student";
  if(target.user_id){
    const {data:profile,error:profileError}=await db.from("profiles").select("email,full_name").eq("id",target.user_id).maybeSingle();
    if(profileError) return json({error:"Student profile lookup failed"},503);
    if(!recipientEmail) recipientEmail=profile?.email||null;
    if(!target.applicant_name&&!target.contact_name&&!target.full_name) recipientName=profile?.full_name||recipientName;
  }
  if(!validEmail(recipientEmail)) return json({error:"No valid email address recorded for this person"},422);
  const {data:place,error:placeError}=target.residence_id?await db.from("residences").select("name").eq("id",target.residence_id).maybeSingle():{data:null,error:null};
  if(placeError) return json({error:"Residence lookup failed"},503);
  const property=safe(place?.name||"your selected accommodation");
  const label=kind==="application"?"application":kind==="reservation"?"reservation":kind==="housing_lead"?"accommodation enquiry":"support enquiry";
  const factualStatus=readable(target.status||target.stage||"Received");
  const signer=isAdmin?"ResKonnect Support":property+" · ResKonnect";
  const subjectFocus:Record<Template,string>={
    status_update:"Status update",feedback:"Personal feedback",documents_needed:"Documents required",
    next_steps:"Next steps",enquiry_response:"Enquiry response",viewing_invite:"Viewing arrangements",
    follow_up:"Follow-up",reservation_confirmation:"Reservation confirmation",
    application_acknowledgement:"Application received",resolution_summary:"Enquiry resolution",reminder:"Reminder"
  };
  const subject="ResKonnect | "+readable(label)+" — "+subjectFocus[template];
  const templates:Record<Template,string>={
    status_update:"We are writing with an update on your "+label+".\nCurrent recorded status: "+factualStatus+".",
    feedback:"We have feedback regarding your "+label+".",
    documents_needed:"Additional documents or information are needed for your "+label+". Please upload documents through your secure ResKonnect dashboard.",
    next_steps:"Here are the next steps for your "+label+".\nCurrent recorded status: "+factualStatus+".",
    enquiry_response:"Thank you for your enquiry. Here is our response.",
    viewing_invite:"We are sharing viewing or accommodation visit information with you.",
    follow_up:"This is a follow-up regarding your "+label+".\nCurrent recorded status: "+factualStatus+".",
    reservation_confirmation:"Your reservation status is confirmed in ResKonnect. Please review the details, conditions and any further instructions on your dashboard.",
    application_acknowledgement:"We acknowledge receipt of your application. This is not approval or a placement guarantee.\nCurrent recorded status: "+factualStatus+".",
    resolution_summary:"We are following up with a summary of how your enquiry was addressed.",
    reminder:"This is a reminder relating to your "+label+".\nCurrent recorded status: "+factualStatus+"."
  };
  const note=message.replace(/\r/g,"").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,"").trim();
  const body=[
    "Hello "+safe(recipientName,90)+",","",
    templates[template],...(note?["",note]:[]),"",
    kind==="application"||kind==="reservation"?"Property: "+property:"",
    "Please sign in to ResKonnect for the latest official details. Do not email identity documents unless requested through a secure platform process.","",
    "Kind regards,",signer,"","This service communication relates to your existing ResKonnect record."
  ].filter((line)=>line!=="__unused__").join("\n");
  const document:EmailDocument={
    kind,template,status:target.status||target.stage||"received",subject,body,
    reference:input.target_id,recipient:safe(recipientName,90),property,
    issuedAt:new Date().toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg"}),
    sender:signer
  };
  const html=renderEmailHtml(document);
  const filename="ResKonnect-"+kind+"-"+input.target_id.slice(0,8)+".pdf";
  if(input.action==="preview") return json({
    subject,body,html,pdf_filename:filename,recipient_hint:isAdmin?hint(recipientEmail):"Private recipient",
    kind,template_key:template,status:factualStatus
  });
  if(input.action==="pdf_preview") {
    try {
      const attachment=await generateEmailPdf(document);
      return json({filename:attachment.filename,
        base64:toBase64(attachment.bytes),
        mime_type:"application/pdf"});
    } catch(error){console.error("PDF preview error",error);return json({error:"Could not generate PDF preview"},503);}
  }
  const attachPdf=input.attach_pdf!==false;
  if(input.batch_id && !validUuid(input.batch_id)) return json({error:"Invalid batch ID"},400);
  if(!validUuid(input.idempotency_key)) return json({error:"Missing valid send request ID"},400);
  const {data:connected,error:connectedError}=await db.from("landlord_gmail_connections")
    .select("enabled,gmail_address").eq("user_id",actor).maybeSingle();
  if(connectedError) return json({error:"Could not verify Gmail connection"},503);
  if(!connected?.enabled) return json({error:"Connect Gmail in Email Settings before sending"},409);
  const since=new Date(Date.now()-24*3600*1000).toISOString();
  const {count,error:limitError}=await db.from("reskonnect_outbound_emails")
    .select("id",{count:"exact",head:true}).eq("actor_user_id",actor).gte("created_at",since);
  if(limitError) return json({error:"Email rate limit unavailable"},503);
  if((count||0)>=80) return json({error:"Daily email safety limit reached (80 per account)"},429);
  const {data:duplicate,error:dupeError}=await db.from("reskonnect_outbound_emails").select("id")
    .eq("actor_user_id",actor).eq("target_kind",kind).eq("target_id",input.target_id)
    .eq("template_key",template).in("delivery_status",["sending","sent","unknown"])
    .gte("created_at",new Date(Date.now()-60*1000).toISOString()).limit(1);
  if(dupeError) return json({error:"Could not verify email duplication"},503);
  if(duplicate?.length) return json({error:"An email of this type was recently attempted for this record. Check history before trying again."},409);
  const {data:attempt,error:claimError}=await db.from("reskonnect_outbound_emails").insert({
    actor_user_id:actor,target_kind:kind,target_id:input.target_id,template_key:template,
    idempotency_key:input.idempotency_key,recipient_email:recipientEmail,recipient_user_id:target.user_id||null,
    subject,delivery_status:"sending",pdf_attached:attachPdf,batch_id:input.batch_id||null
  }).select("id").single();
  if(claimError)return json({error:claimError.code==="23505"?"This email request was already processed":"Could not record email attempt"},claimError.code==="23505"?409:503);
  const mark=async(status:"failed"|"unknown",code:string)=>{
    await db.from("reskonnect_outbound_emails").update({delivery_status:status,failure_code:code}).eq("id",attempt.id);
  };
  const {data:refresh,error:secretError}=await db.rpc("gmail_get_connection_secret",{p_user_id:actor});
  if(secretError||!refresh){await mark("failed","token_unavailable");return json({error:"Please reconnect your Gmail account"},409);}
  const clientId=Deno.env.get("GOOGLE_GMAIL_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_GMAIL_CLIENT_SECRET");
  if(!clientId||!clientSecret){await mark("failed","oauth_config_missing");return json({error:"Gmail service configuration missing"},503);}
  let newToken:Response;
  try {newToken=await fetch("https://oauth2.googleapis.com/token",{method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:"refresh_token"})
  });} catch {await mark("failed","token_network");return json({error:"Could not contact Google authorization servers"},502);}
  if(!newToken.ok){await mark("failed","token_rejected");return json({error:"Google authorization needs reconnecting"},409);}
  const tokenResult=await newToken.json();
  if(!tokenResult.access_token){await mark("failed","token_missing");return json({error:"Invalid Google access token"},502);}
  let attachment:{filename:string,bytes:Uint8Array}|null=null;
  if(attachPdf) {
    try {attachment=await generateEmailPdf(document);}
    catch(error){console.error("PDF generation failed",error);await mark("failed","pdf_generation_failed");return json({error:"PDF could not be generated; no email was sent"},503);}
  }
  const boundary="RK-"+crypto.randomUUID().replace(/-/g,"");
  const alternative="RK-ALT-"+crypto.randomUUID().replace(/-/g,"");
  const mimeParts=[
    "To: "+recipientEmail,
    "Subject: =?UTF-8?B?"+toBase64(new TextEncoder().encode(subject))+"?=",
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=\""+boundary+"\"",
    "",
    "--"+boundary,
    "Content-Type: multipart/alternative; boundary=\""+alternative+"\"",
    "",
    "--"+alternative,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64wrap(body),
    "--"+alternative,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64wrap(html),
    "--"+alternative+"--"
  ];
  if(attachment) mimeParts.push(
    "--"+boundary,
    "Content-Type: application/pdf; name=\""+attachment.filename+"\"",
    "Content-Disposition: attachment; filename=\""+attachment.filename+"\"",
    "Content-Transfer-Encoding: base64",
    "",
    attachmentWrap(attachment.bytes)
  );
  mimeParts.push("--"+boundary+"--","");
  const mime=mimeParts.join("\r\n");
  let sent:Response;
  try {sent=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{
    method:"POST",headers:{Authorization:"Bearer "+tokenResult.access_token,"Content-Type":"application/json"},
    body:JSON.stringify({raw:base64url(mime)}),signal:AbortSignal.timeout(15000)
  });} catch {await mark("unknown","gmail_delivery_uncertain");return json({error:"Gmail delivery could not be confirmed. Check Sent Mail before retrying."},502);}
  if(!sent.ok){await mark("failed","gmail_http_"+sent.status);return json({error:sent.status===401||sent.status===403?"Gmail denied sending. Check permission or reconnect.":"Gmail returned an error",gmail_status:sent.status},502);}
  const data=await sent.json();
  await db.from("reskonnect_outbound_emails").update({delivery_status:"sent",provider_message_id:data.id||null,sent_at:new Date().toISOString(),failure_code:null}).eq("id",attempt.id);
  await db.from("landlord_gmail_connections").update({last_used_at:new Date().toISOString()}).eq("user_id",actor);
  return json({sent:true,message_id:data.id||null,email_id:attempt.id,pdf_attached:attachPdf,recipient_hint:isAdmin?hint(recipientEmail):"Private recipient"});
});
