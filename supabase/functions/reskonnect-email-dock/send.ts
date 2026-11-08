import {renderLetter,htmlEmail,smartTemplate,type CaseContext,type TemplateKey,type Kind, KIND_LABELS} from "./correspondence.ts";
import {createBrandedPdf,createGmailMime,pdfAsBase64} from "./pdf.ts";
import {type EmailSession,validEmail,recipientHint} from "./context.ts";

const statusIs=(value:string,wanted:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,"_")===wanted;
export function assertTemplateIsFactual(ctx:CaseContext,key:TemplateKey){
 const selected=key==="smart"?smartTemplate(ctx):key;
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
 const {data:custom,error}=await s.db.from("reskonnect_email_templates")
  .select("subject_template,body_template").eq("owner_user_id",s.actor)
  .eq("target_kind",ctx.kind).eq("template_key",resolved).maybeSingle();
 if(error)throw Error("Saved template could not be loaded");
 if(["viewing_invite","move_in_arrangements"].includes(resolved)&&note.trim().length<10)
   throw Error("Add practical details such as the viewing date/time or move-in instructions before sending");
  const letter=renderLetter(ctx,key,note,custom||undefined);
 return {...letter,html:htmlEmail(ctx,letter.subject,letter.body)};
}
async function bearerToken(s:EmailSession){
 const {data:connected,error:connectedError}=await s.db.from("landlord_gmail_connections")
  .select("enabled").eq("user_id",s.actor).maybeSingle();
 if(connectedError||!connected?.enabled)throw Error("Connect your Gmail account before sending");
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
 return data.access_token as string;
}
export async function makePreviewPdf(s:EmailSession,ctx:CaseContext,key:TemplateKey,note:string){
 const packet=await previewPacket(s,ctx,key,note);
 const bytes=await createBrandedPdf({
  recipientName:ctx.studentName,property:ctx.property,reference:ctx.reference,
  status:ctx.status,subject:packet.subject,body:packet.body,kindLabel:KIND_LABELS[ctx.kind],residenceImageUrl:ctx.residenceImageUrl
 });
 return {filename:"ResKonnect-"+ctx.kind+"-"+ctx.reference+".pdf",base64:pdfAsBase64(bytes)};
}
export async function sendOne(s:EmailSession,ctx:CaseContext,key:TemplateKey,note:string,requestId:string,batchId:string|null){
 if(!validEmail(ctx.email)||!ctx.contactAllowed)throw Error("Contact details or permission is missing");
 const selected=assertTemplateIsFactual(ctx,key);
 const {count,error:countErr}=await s.db.from("reskonnect_outbound_emails")
  .select("id",{head:true,count:"exact"}).eq("actor_user_id",s.actor)
  .gte("created_at",new Date(Date.now()-86400000).toISOString());
 if(countErr)throw Error("Sending limits are temporarily unavailable");
 if((count||0)>=80)return {sent:false,error:"80 message attempts per 24 hours reached",status:429};
 const {data:recent,error:recentErr}=await s.db.from("reskonnect_outbound_emails")
  .select("id").eq("actor_user_id",s.actor).eq("target_kind",ctx.kind).eq("target_id",ctx.id)
  .eq("template_key",selected).in("delivery_status",["sending","sent","unknown"])
  .gte("created_at",new Date(Date.now()-60000).toISOString()).limit(1);
 if(recentErr)throw Error("Cannot verify duplicate email attempts");
 if(recent?.length)return {sent:false,error:"A recent email with the same purpose exists; check Sent and history",status:409};
 const packet=await previewPacket(s,ctx,key,note);
 const {data:log,error:logErr}=await s.db.from("reskonnect_outbound_emails").insert({
  actor_user_id:s.actor,target_kind:ctx.kind,target_id:ctx.id,template_key:selected,
  idempotency_key:requestId,recipient_email:ctx.email,recipient_user_id:ctx.userId,
  subject:packet.subject,delivery_status:"sending",batch_id:batchId,pdf_attached:false,
  context_snapshot:{recorded_status:ctx.status,document_stage:ctx.documents.stage,
   missing_count:ctx.documents.missing.length,template_key:selected}
 }).select("id").single();
 if(logErr)return {sent:false,error:logErr.code==="23505"?"This send request has already been processed":"Could not record email request",status:409};
 const mark=async(status:"failed"|"unknown",code:string)=>{await s.db.from("reskonnect_outbound_emails").update({delivery_status:status,failure_code:code}).eq("id",log.id);};
 let token;
 try{token=await bearerToken(s);}catch(e){await mark("failed","google_oauth");return {sent:false,error:e instanceof Error?e.message:"Gmail authorization unavailable",status:409};}
 let pdf:Uint8Array;
 try{
  pdf=await createBrandedPdf({recipientName:ctx.studentName,property:ctx.property,reference:ctx.reference,
   status:ctx.status,subject:packet.subject,body:packet.body,kindLabel:KIND_LABELS[ctx.kind],residenceImageUrl:ctx.residenceImageUrl});
 }catch(e){console.error("Branded PDF generation failed",e);await mark("failed","pdf_generation");return {sent:false,error:"Could not generate the official PDF attachment; no email was sent",status:502};}
 const attachment="ResKonnect-"+ctx.kind+"-"+ctx.reference+".pdf";
 const raw=createGmailMime(ctx.email,packet.subject,packet.body,packet.html,pdf,attachment);
 let sent:Response;
 try{
  sent=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{
   method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({raw}),signal:AbortSignal.timeout(15000)
  });
 }catch{await mark("unknown","gmail_delivery_uncertain");return {sent:false,error:"Delivery outcome unknown. Check Gmail Sent Mail before retrying.",status:502};}
 if(!sent.ok){await mark("failed","gmail_http_"+sent.status);return {sent:false,error:sent.status===401||sent.status===403?"Gmail rejected authorization; reconnect Gmail":"Gmail rejected message",status:502};}
 const result=await sent.json();
 const {error:logSaveErr}=await s.db.from("reskonnect_outbound_emails").update({
  delivery_status:"sent",provider_message_id:result.id||null,pdf_attached:true,
  sent_at:new Date().toISOString(),failure_code:null
 }).eq("id",log.id);
 if(logSaveErr)console.error("Gmail accepted message but audit update failed",logSaveErr.message);
 await s.db.from("landlord_gmail_connections").update({last_used_at:new Date().toISOString()}).eq("user_id",s.actor);
 return {sent:true,record_id:ctx.id,attachment,template_key:selected,email_id:log.id,recipient_hint:recipientHint(s,ctx.email)};
}
