import {renderLetter,htmlEmail,smartTemplate,type CaseContext,type TemplateKey,type Kind, KIND_LABELS} from "./correspondence.ts";
import {createBrandedPdf,createGmailMime,pdfAsBase64} from "./pdf.ts";
import {type EmailSession,validEmail,recipientHint} from "./context.ts";

const statusIs=(value:string,wanted:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,"_")===wanted;
export function assertTemplateIsFactual(ctx:CaseContext,key:TemplateKey){
 const selected=key==="smart"?smartTemplate(ctx):key;
 if(selected==="triage_received"||selected==="triage_under_review"){
  if(ctx.kind!=="application"&&ctx.kind!=="reservation")throw Error("Triage messages are for applications and reservations only");
  if(["approved","rejected","withdrawn","confirmed","cancelled"].some(s=>statusIs(ctx.status,s)))
   throw Error("A finalised case cannot receive a receipt or review-start message");
  if(selected==="triage_under_review" && ctx.reviewStage!=="under_review"&&
     !(ctx.kind==="application"&&ctx.status==="under_review"))
   throw Error("This case is not marked under review by ResKonnect");
  return selected;
 }
 if(selected==="approved"&&!statusIs(ctx.status,"approved"))throw Error("An approval letter requires a recorded approved decision");
 if(selected==="rejected"&&!statusIs(ctx.status,"rejected"))throw Error("A rejection letter requires a recorded rejected decision");
 if(selected==="conditionally_approved"&&!statusIs(ctx.status,"conditionally_approved"))throw Error("Conditional acceptance requires a recorded conditional approval");
 if(selected==="reservation_confirmed"&&(ctx.kind!=="reservation"||!statusIs(ctx.status,"confirmed")))
  throw Error("A confirmation letter requires a confirmed reservation");
 if(selected==="move_in_arrangements"&&(ctx.kind!=="reservation"||!statusIs(ctx.status,"confirmed")))
   throw Error("Move-in arrangements require a confirmed reservation");
  if(selected==="viewing_invite"&&ctx.kind==="application"&&!["approved","conditionally_approved"].some(s=>statusIs(ctx.status,s)))
   throw Error("Viewing arrangements require an approved or conditionally approved application");
  if(selected==="documents_received"&&ctx.documents.uploaded===0)throw Error("No documents are recorded as received for this case");
 if(selected==="documents_needed"&&ctx.documents.missing.length===0)
  throw Error("A missing-document request is not appropriate: no required documents remain outstanding");
 if(selected==="acknowledgement"&&["approved","rejected","withdrawn","cancelled","confirmed"].some(status=>statusIs(ctx.status,status)))
  throw Error("A receipt-only template does not match the recorded final decision; choose Smart");
 if((selected==="approved"||selected==="rejected"||selected==="conditionally_approved")&&ctx.kind!=="application")
  throw Error("Application decision templates cannot be sent for reservation or enquiry records");
 if(["withdrawn","cancelled"].some(status=>statusIs(ctx.status,status))&&["follow_up","viewing_invite","next_steps"].includes(selected))
  throw Error("A closed case should receive a factual status notice, not an active-application invitation");
 return selected;
}
export async function previewPacket(s:EmailSession,ctx:CaseContext,key:TemplateKey,note:string){
 const resolved=assertTemplateIsFactual(ctx,key);
 const fixedTriage=["triage_received","triage_under_review"].includes(resolved);
 if(fixedTriage&&note.trim())throw Error("Receipt/review-start templates are fixed wording: no unverified decision notes");
 const {data:custom,error}=fixedTriage?{data:null,error:null}:await s.db.from("reskonnect_email_templates")
  .select("subject_template,body_template").eq("owner_user_id",s.actor)
  .eq("target_kind",ctx.kind).eq("template_key",resolved).maybeSingle();
 if(error)throw Error("Saved template could not be loaded");
 if(["viewing_invite","move_in_arrangements"].includes(resolved)&&note.trim().length<10)
   throw Error("Add practical details such as the viewing date/time or move-in instructions before sending");
  const issuer=s.isAdmin?"reskonnect":"residence";
 const letter=renderLetter(ctx,key,note,custom||undefined,issuer);
 return {...letter,issuer,html:htmlEmail(ctx,letter.subject,letter.body,issuer)};
}
async function bearerToken(s:EmailSession){
 const {data:connected,error:connectedError}=await s.db.from("landlord_gmail_connections")
  .select("enabled,gmail_address").eq("user_id",s.actor).maybeSingle();
 if(connectedError||!connected?.enabled)throw Error("Connect your Gmail account before sending");
 const fromEmail=String(connected.gmail_address||"").trim().toLowerCase();
 if(!validEmail(fromEmail))throw Error("The connected Gmail sender address could not be verified. Reconnect Gmail.");
 const {data:refresh,error:refreshErr}=await s.db.rpc("gmail_get_connection_secret",{p_user_id:s.actor});
 if(refreshErr||typeof refresh!=="string"||!refresh)throw Error("Reconnect Gmail to renew sending authorization");
 const id=Deno.env.get("GOOGLE_GMAIL_CLIENT_ID"),secret=Deno.env.get("GOOGLE_GMAIL_CLIENT_SECRET");
 if(!id||!secret)throw Error("Gmail OAuth credentials are not configured");
 const response=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({client_id:id,client_secret:secret,refresh_token:refresh,grant_type:"refresh_token"}),
  signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw Error("Google Gmail authorization has expired or been revoked");
 const data=await response.json();
 if(!data.access_token)throw Error("Google did not return an access token");
 return {token:data.access_token as string,fromEmail};
}
export async function makePreviewPdf(s:EmailSession,ctx:CaseContext,key:TemplateKey,note:string){
 const packet=await previewPacket(s,ctx,key,note);
 const bytes=await createBrandedPdf({
  recipientName:ctx.studentName,property:ctx.property,reference:ctx.reference,
  status:ctx.status,subject:packet.subject,body:packet.body,kindLabel:KIND_LABELS[ctx.kind],nextStep:packet.next_step,residenceImageUrl:ctx.residenceImageUrl
 });
 return {filename:"ResKonnect-"+ctx.kind+"-"+ctx.reference+".pdf",base64:pdfAsBase64(bytes)};
}
export async function sendOne(s:EmailSession,ctx:CaseContext,key:TemplateKey,note:string,requestId:string,batchId:string|null){
 if(!validEmail(ctx.email)||!ctx.contactAllowed)throw Error("Contact details or permission is missing");
 const selected=assertTemplateIsFactual(ctx,key);
 // Repeat requests are resolved from the same audit row and MUST NOT call Gmail again.
 const {data:existing,error:lookupErr}=await s.db.from("reskonnect_outbound_emails")
  .select("id,delivery_status,provider_message_id")
  .eq("actor_user_id",s.actor).eq("idempotency_key",requestId).maybeSingle();
 if(lookupErr)throw Error("Cannot safely verify the email request history");
 if(existing){
  if(existing.delivery_status==="sent"){
   // The original invocation may have ended after the Gmail audit write but
   // before its optional case-status sync. Reconciliation is idempotent and
   // never sends Gmail a second time.
   let recoveredSync:null|{applied:boolean;reason:string}=null;
   if(existing.provider_message_id){
    try{
     const {data,error}=await s.db.rpc("rk_email_sync_after_send",{p_email_id:existing.id});
     if(!error)recoveredSync=data;
    }catch(e){console.warn("Delivered email case-sync recovery unavailable",e instanceof Error?e.message:"unknown");}
   }
   return {sent:true,recovered:true,email_id:existing.id,record_id:ctx.id,status_sync:recoveredSync};
  }
  if(existing.delivery_status==="failed")return {sent:false,status:409,error:"This request previously failed. Review the delivery history before starting a new attempt."};
  return {sent:false,status:202,uncertain:true,error:"Delivery is still being verified. Check Gmail Sent and the Email Dock history before retrying."};
 }
 // The former 80/day actor-based ceiling was an app-side restriction, not Gmail.
 // Sender-specific quota is checked AND atomically reserved after preparing the PDF.

 // Complete every fallible local preparation BEFORE claiming a sending record.
 // In particular, pdf-lib can exhaust Edge CPU. If it does, Gmail was never
 // contacted and there must be no orphaned 'sending' row blocking safe retries.
 const packet=await previewPacket(s,ctx,key,note);
 let sender:{token:string;fromEmail:string};
 try{sender=await bearerToken(s);}
 catch(e){return {sent:false,error:e instanceof Error?e.message:"Gmail authorization unavailable",status:409};}
 let pdf:Uint8Array;
 try{
  pdf=await createBrandedPdf({recipientName:ctx.studentName,property:ctx.property,reference:ctx.reference,
   status:ctx.status,subject:packet.subject,body:packet.body,kindLabel:KIND_LABELS[ctx.kind],nextStep:packet.next_step,residenceImageUrl:ctx.residenceImageUrl});
 }catch(e){console.error("Branded PDF generation failed",e);return {sent:false,error:"Could not generate the official PDF attachment; no email was sent",status:502};}
 const attachment="ResKonnect-"+ctx.kind+"-"+ctx.reference+".pdf";
 const senderName=s.isAdmin?"ResKonnect":(ctx.property==="ResKonnect"?"ResKonnect":ctx.property);
 const senderScope=s.isAdmin?"reskonnect":"residence";
 let raw:string;
 try{
  raw=createGmailMime(ctx.email,packet.subject,packet.body,packet.html,pdf,attachment,
    {name:senderName,email:sender.fromEmail});
 }catch(e){console.error("Gmail message preparation failed",e);return {sent:false,error:"Could not prepare the official email attachment; no email was sent",status:502};}

 // Check again after PDF preparation to narrow the concurrent duplicate window.
 const {data:recent,error:recentErr}=await s.db.from("reskonnect_outbound_emails")
  .select("id").eq("actor_user_id",s.actor).eq("target_kind",ctx.kind).eq("target_id",ctx.id)
  .eq("template_key",selected).in("delivery_status",["sending","sent","unknown"])
  .gte("created_at",new Date(Date.now()-86400000).toISOString()).limit(1);
 if(recentErr)throw Error("Cannot verify duplicate email attempts");
 if(recent?.length)return {sent:false,error:"An existing email attempt has this purpose; check Gmail Sent and history before attempting another send",status:409,uncertain:true};

 // Transaction-level sender lock keeps concurrent staff sessions within the
 // same Gmail mailbox's 24-hour app budget, including uncertain attempts.
 const {data:reservation,error:reserveErr}=await s.db.rpc("rk_gmail_reserve_send",{
  p_sender:sender.fromEmail,p_actor:s.actor,p_kind:ctx.kind,p_target:ctx.id,
  p_template:selected,p_request:requestId,p_recipient:ctx.email,
  p_recipient_user:ctx.userId,p_subject:packet.subject,p_batch:batchId,
  p_snapshot:{recorded_status:ctx.status,document_stage:ctx.documents.stage,
   missing_count:ctx.documents.missing.length,template_key:selected,
   sender_scope:senderScope,sender_display_name:senderName,sender_email:sender.fromEmail,
   accommodation_name:ctx.property}
 });
 if(reserveErr)return {sent:false,error:"Cannot safely reserve sender quota. No email was sent.",status:503};
 if(!reservation?.reserved){
  const limitReached=reservation?.reason==="reskonnect_rolling_ceiling"||
   reservation?.reason==="gmail_temporarily_limited";
  return {sent:false,error:limitReached?
   "Connected Gmail sender has reached its safe 24-hour allowance or a provider pause. Other Gmail activity may also count; try again after it resets.":
   "Cannot authorize or deduplicate this Gmail send. Review the audit first.",
   status:limitReached?429:409};
 }
 const log={id:reservation.id};
 const mark=async(status:"failed"|"unknown",code:string)=>{
  const {error}=await s.db.from("reskonnect_outbound_emails").update({delivery_status:status,failure_code:code}).eq("id",log.id);
  if(error)console.error("Email delivery status audit update failed",error.message);
 };
 let sent:Response;
 try{
  sent=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{
   method:"POST",headers:{"Authorization":"Bearer "+sender.token,"Content-Type":"application/json"},
   body:JSON.stringify({raw}),signal:AbortSignal.timeout(15000)
  });
 }catch{await mark("unknown","gmail_delivery_uncertain");return {sent:false,uncertain:true,error:"Delivery outcome unknown. Check Gmail Sent Mail before retrying.",status:502};}
 if(!sent.ok){
  await mark("failed","gmail_http_"+sent.status);
  if(sent.status===429){
   // Google's per-user quota is authoritative. Stop new attempts for this sender.
   const retryHeader=Number(sent.headers.get("Retry-After"));
   const pauseMinutes=Number.isFinite(retryHeader)&&retryHeader>0?
    Math.min(1440,Math.max(15,Math.ceil(retryHeader/60))):60;
   await s.db.rpc("rk_gmail_sender_pause",{p_sender:sender.fromEmail,p_minutes:pauseMinutes})
    .catch(()=>undefined);
   return {sent:false,error:"Gmail is limiting this mailbox. The sender is paused; review Gmail quota before continuing.",status:429};
  }
  return {sent:false,error:sent.status===401||sent.status===403?"Gmail rejected authorization; reconnect Gmail":"Gmail rejected message",status:502};
 }
 // Gmail HTTP 2xx is accepted delivery handoff. Never turn that into an
 // explicit failure if a later receipt or optional audit write is unavailable.
 let providerId:string|null=null,providerThreadId:string|null=null;
 try{const receipt=await sent.json();providerId=typeof receipt?.id==="string"?receipt.id:null;providerThreadId=typeof receipt?.threadId==="string"?receipt.threadId:null;}
 catch(e){console.warn("Gmail accepted the message but its receipt was unreadable",e);}
 try{
  const {error:logSaveErr}=await s.db.from("reskonnect_outbound_emails").update({
   delivery_status:"sent",provider_message_id:providerId,provider_thread_id:providerThreadId,pdf_attached:true,
   sent_at:new Date().toISOString(),failure_code:null
  }).eq("id",log.id);
  if(logSaveErr)console.error("Gmail accepted message but audit update failed",logSaveErr.message);
 }catch(e){console.error("Gmail accepted message but audit persistence threw",e);}
 // Reconcile only the safe, non-final case status after Gmail confirms delivery.
 // Never reclassify a failed/unknown send as successful and never override
 // recorded placement decisions. A failure here must not turn accepted Gmail
 // delivery into a failed email or an automatic resend.
 let statusSync:{applied:boolean;reason:string;old_status?:string;new_status?:string}|null=null;
 if(providerId){
  try{
   const {data,error}=await s.db.rpc("rk_email_sync_after_send",{p_email_id:log.id});
   if(error){console.error("Email delivered but case status reconciliation unavailable",error.message);}
   else if(data)statusSync=data;
  }catch(e){console.error("Email delivered but case status sync threw",e instanceof Error?e.message:"unknown");}
 }
 // This timestamp is optional, and must never change the result of a sent email.
 try{await s.db.from("landlord_gmail_connections").update({last_used_at:new Date().toISOString()}).eq("user_id",s.actor);}
 catch(e){console.warn("Gmail connection timestamp update failed",e);}
 return {sent:true,record_id:ctx.id,attachment,template_key:selected,email_id:log.id,recipient_hint:recipientHint(s,ctx.email),audit_confirmed:!!providerId,status_sync:statusSync};
}
