import {type EmailSession,validUuid,recipientHint,readCase} from "./context.ts";

const READ_SCOPE="https://www.googleapis.com/auth/gmail.readonly";
type Category="confirmation_intent"|"documents_provided"|"documents_question"|"viewing_request"|"more_time"|"declined"|"payment_question"|"general_question"|"acknowledgement"|"other";
const CATEGORIES:Category[]=["confirmation_intent","documents_provided","documents_question","viewing_request","more_time","declined","payment_question","general_question","acknowledgement","other"];
const classify=(body:string):{category:Category;stage:string}=>{
 const text=body.toLowerCase().replace(/\s+/g," ").slice(0,1800);
 if(/\b(no longer interested|not interested|i decline|i reject|withdraw my|cancel my (application|reservation)|i do not accept|i don't accept)\b/.test(text))
  return {category:"declined",stage:"follow_up"};
 if(/\b(need more time|more time to|extension|can i have more time|will reply later|not ready yet)\b/.test(text))
  return {category:"more_time",stage:"follow_up"};
 if(/\b(which documents|what documents|document requirements|where (can|do) i upload|how (can|do) i upload)\b/.test(text))
  return {category:"documents_question",stage:"documents_review"};
 if(/\b(i (have |already )?(uploaded|submitted|sent|attached) (my |the )?(documents|proof|id|registration)|documents (have been|are) (uploaded|attached))\b/.test(text))
  return {category:"documents_provided",stage:"documents_review"};
 if(/\b(viewing|view the room|see the residence|come to see|visit the property|tour the room)\b/.test(text))
  return {category:"viewing_request",stage:"viewing_review"};
 if(/\b(payment|deposit|nsfas|allowance|top up|bursary|rent)\b/.test(text)&&/\?|\b(how|when|where|can i|what|why|must i)\b/.test(text))
  return {category:"payment_question",stage:"response_review"};
 if(!/\b(how do i|can you|could you|what if|not confirm|cannot confirm|can't confirm|didn't accept)\b/.test(text) &&
    /\b(i accept|i confirm|yes,? i (accept|confirm|agree|will take)|i (am|'m) ready (to move|for final)|i want to (take|confirm) the (room|place)|final confirmation|i will move in)\b/.test(text))
  return {category:"confirmation_intent",stage:"final_confirmation_review"};
 if(/\?/.test(text)||/\b(i would like to know|please clarify|can you explain|i have a question)\b/.test(text))
  return {category:"general_question",stage:"response_review"};
 if(/\b(thank you|thanks|received with thanks|acknowledge receipt|noted)\b/.test(text))
  return {category:"acknowledgement",stage:"response_review"};
 return {category:"other",stage:"response_review"};
};
const dateWindow=(value:any)=>{
 const today=new Date(Date.now()+2*60*60*1000).toISOString().slice(0,10);
 const day=typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:today;
 const ms=Date.parse(day+"T00:00:00.000Z")-2*60*60*1000;
 if(!Number.isFinite(ms))throw Error("Invalid local date");
 return {day,from:new Date(ms).toISOString(),to:new Date(ms+86400000).toISOString()};
};
const gmailToken=async(s:EmailSession)=>{
 const {data:connection,error}=await s.db.from("landlord_gmail_connections")
  .select("enabled,reply_read_enabled,gmail_address").eq("user_id",s.actor).maybeSingle();
 if(error)throw Error("Cannot confirm Gmail inbox authorization");
 if(!connection?.enabled||!connection?.reply_read_enabled)
  throw Error("Reply reading is not enabled. Choose Enable Gmail reply sync and approve Google's read-only inbox permission.");
 const {data:secret,error:secretError}=await s.db.rpc("gmail_get_connection_secret",{p_user_id:s.actor});
 if(secretError||typeof secret!=="string"||!secret)throw Error("Reconnect your Gmail account to enable reply sync");
 const client=Deno.env.get("GOOGLE_GMAIL_CLIENT_ID"),password=Deno.env.get("GOOGLE_GMAIL_CLIENT_SECRET");
 if(!client||!password)throw Error("Gmail OAuth is temporarily unavailable");
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",
  headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({client_id:client,client_secret:password,refresh_token:secret,grant_type:"refresh_token"}),
  signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("Gmail inbox authorization expired. Reconnect with reply sync permission.");
 const token=await response.json();
 if(typeof token.access_token!=="string")throw Error("Google did not grant a Gmail token");
 const scope=String(token.scope||"");
 // The connection table is only an audit of consent. Google's issued token
 // remains the real enforcement boundary.
 if(scope&&!scope.split(/\s+/).includes(READ_SCOPE))throw Error("Gmail read permission missing. Enable reply sync through Google consent.");
 return token.access_token as string;
};
const googleGet=async(token:string,path:string)=>{
 const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/"+path,{
  headers:{"Authorization":"Bearer "+token},signal:AbortSignal.timeout(15000)});
 if(response.status===401||response.status===403)
  throw Error("Google has not authorized inbox reading. Reconnect Gmail with reply sync enabled.");
 if(!response.ok)throw Error("Gmail thread lookup unavailable (HTTP "+response.status+")");
 return await response.json();
};
const header=(message:any,key:string)=>String((message.payload?.headers||[]).find((h:any)=>String(h.name).toLowerCase()===key.toLowerCase())?.value||"");
const mailbox=(value:string)=>{const bracket=value.match(/<([^<>]+)>/);return String(bracket?.[1]||value).trim().toLowerCase().replace(/^["']|["']$/g,"");};
const decode=(value:string)=>{try{const b64=value.replace(/-/g,"+").replace(/_/g,"/");const bin=atob(b64.padEnd(Math.ceil(b64.length/4)*4,"="));return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));}catch{return "";}};
const textBody=(payload:any):string=>{
 if(!payload)return "";
 if(payload.mimeType==="text/plain"&&typeof payload.body?.data==="string")return decode(payload.body.data);
 for(const part of payload.parts||[]){const result=textBody(part);if(result)return result;}
 return "";
};
const freshBody=(text:string)=>String(text).split(/\n\s*(?:On .{10,150}wrote:|From:|-----Original Message-----)/i)[0].trim().slice(0,1800);
const safeSnippet=(input:string)=>input.replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,700);
const recentRows=async(s:EmailSession,day:unknown)=>{
 const d=dateWindow(day);
 let q=s.db.from("reskonnect_outbound_emails")
  .select("id,target_kind,target_id,recipient_user_id,recipient_email,subject,template_key,delivery_status,created_at,sent_at,pdf_attached,provider_message_id,provider_thread_id,last_reply_checked_at",{count:"exact"})
  .eq("actor_user_id",s.actor).eq("delivery_status","sent")
  .gte("sent_at",d.from).lt("sent_at",d.to)
  .order("sent_at",{ascending:false}).limit(100);
 const {data,error,count}=await q;
 if(error)throw Error("Cannot load today's sent email audit");
 return {...d,items:data||[],total:count||0};
};
export async function replyOverview(s:EmailSession,day:unknown){
 const {items,total,day:date}=await recentRows(s,day);
 const ids=items.map((x:any)=>x.id);
 const {data:connection}=await s.db.from("landlord_gmail_connections")
  .select("enabled,reply_read_enabled").eq("user_id",s.actor).maybeSingle();
 if(!ids.length)return {day:date,items:[],total:0,reply_sync_enabled:!!connection?.enabled&&!!connection?.reply_read_enabled,
  counts:{sent:0,replied:0,awaiting:0,unchecked:0,pending_review:0,final_confirmation:0}};
 const {data:replies,error:replyErr}=await s.db.from("reskonnect_email_replies")
  .select("id,outbound_email_id,received_at,classification,suggested_stage,review_status,reviewed_category,snippet")
  .eq("actor_user_id",s.actor).in("outbound_email_id",ids).order("received_at",{ascending:false}).limit(500);
 if(replyErr)throw Error("Cannot retrieve recorded Gmail replies");
 const userIds=[...new Set(items.map((x:any)=>x.recipient_user_id).filter(validUuid))];
 const {data:profiles,error:profileErr}=userIds.length?await s.db.from("profiles").select("id,full_name").in("id",userIds):{data:[],error:null};
 if(profileErr)throw Error("Cannot load linked student names");
 const names=new Map((profiles||[]).map((x:any)=>[x.id,String(x.full_name||"Student")]));
 const byEmail=new Map<string,any[]>();
 for(const reply of replies||[]){const old=byEmail.get(reply.outbound_email_id)||[];old.push(reply);byEmail.set(reply.outbound_email_id,old);}
 const rows=items.map((x:any)=>{
  const found=byEmail.get(x.id)||[];
  const reply_status=found.length?"replied":x.last_reply_checked_at?"awaiting_reply":"not_checked";
  return {id:x.id,target_kind:x.target_kind,target_id:x.target_id,subject:x.subject,template_key:x.template_key,
   student_name:names.get(x.recipient_user_id)||"Student",recipient_hint:recipientHint(s,x.recipient_email),
   delivery_status:x.delivery_status,sent_at:x.sent_at,pdf_attached:x.pdf_attached,
   reply_status,last_checked_at:x.last_reply_checked_at||null,reply_count:found.length,latest_reply:found[0]||null};
 });
 return {day:date,items:rows,total,reply_sync_enabled:!!connection?.enabled&&!!connection?.reply_read_enabled,
  counts:{sent:total,replied:rows.filter((x:any)=>x.reply_status==="replied").length,
   awaiting:rows.filter((x:any)=>x.reply_status==="awaiting_reply").length,
   unchecked:rows.filter((x:any)=>x.reply_status==="not_checked").length,
   pending_review:rows.filter((x:any)=>x.latest_reply?.review_status==="pending").length,
   final_confirmation:rows.filter((x:any)=>x.latest_reply?.suggested_stage==="final_confirmation_review").length}};
}
export async function replySync(s:EmailSession,day:unknown,offset:unknown){
 const token=await gmailToken(s),records=await recentRows(s,day);
 const offsetNum=Math.max(0,Math.min(90,Number.isFinite(Number(offset))?Math.floor(Number(offset)):0));
 const items=records.items.slice(offsetNum,offsetNum+10);
 let scanned=0,repliesFound=0,failed=0;
 const errors:string[]=[];
 for(const outgoing of items){
  if(!outgoing.provider_message_id)continue;
  try{
   let threadId=outgoing.provider_thread_id;
   if(!threadId){
    const sent=await googleGet(token,"messages/"+encodeURIComponent(outgoing.provider_message_id)+"?format=metadata");
    threadId=typeof sent.threadId==="string"?sent.threadId:null;
    if(!threadId)throw Error("Original Gmail thread was not found");
    const {error:linkError}=await s.db.from("reskonnect_outbound_emails")
     .update({provider_thread_id:threadId}).eq("id",outgoing.id).eq("actor_user_id",s.actor);
    if(linkError)throw Error("Could not link the Gmail thread to the sent email");
   }
   const thread=await googleGet(token,"threads/"+encodeURIComponent(threadId)+"?format=full");
   const boundary=Date.parse(outgoing.sent_at||outgoing.created_at);
   for(const message of thread.messages||[]){
    if(message.id===outgoing.provider_message_id)continue;
    if(mailbox(header(message,"From"))!==String(outgoing.recipient_email).toLowerCase())continue;
    const receivedAt=Number(message.internalDate);
    if(!Number.isFinite(receivedAt)||receivedAt<boundary-30000)continue;
    const body=freshBody(textBody(message.payload)||String(message.snippet||""));
    const proposal=classify(body);
    const {data:inserted,error:insertError}=await s.db.from("reskonnect_email_replies").insert({
     outbound_email_id:outgoing.id,actor_user_id:s.actor,gmail_message_id:message.id,gmail_thread_id:threadId,
     from_email:String(outgoing.recipient_email).toLowerCase(),received_at:new Date(receivedAt).toISOString(),
     subject:header(message,"Subject").slice(0,240),snippet:safeSnippet(body||String(message.snippet||"")),
     classification:proposal.category,suggested_stage:proposal.stage
    }).select("id").maybeSingle();
    if(insertError&&insertError.code!=="23505")throw Error("Cannot record the student's reply");
    let replyId=inserted?.id;
    if(!replyId){
     const {data:existing,error:lookupError}=await s.db.from("reskonnect_email_replies")
      .select("id").eq("actor_user_id",s.actor).eq("gmail_message_id",message.id).maybeSingle();
     if(lookupError)throw Error("Cannot reconcile this Gmail reply");
     replyId=existing?.id;
    }else repliesFound++;
    if(replyId){
     const {error:caseError}=await s.db.from("reskonnect_email_response_cases")
      .upsert({reply_id:replyId,actor_user_id:s.actor,target_kind:outgoing.target_kind,target_id:outgoing.target_id,
       student_user_id:outgoing.recipient_user_id||null,recommended_stage:proposal.stage},
       {onConflict:"reply_id",ignoreDuplicates:true});
     if(caseError)throw Error("Cannot create the student's response case record");
    }
   }
   const {error:checkError}=await s.db.from("reskonnect_outbound_emails")
    .update({last_reply_checked_at:new Date().toISOString()}).eq("id",outgoing.id).eq("actor_user_id",s.actor);
   if(checkError)throw Error("Could not save the reply-check timestamp");
   scanned++;
  }catch(error){failed++;if(errors.length<3)errors.push(error instanceof Error?error.message:"Reply check failed");}
 }
 return {day:records.day,processed:items.length,scanned,found:repliesFound,failed,errors,
  next_offset:offsetNum+items.length<Math.min(records.total,100)?offsetNum+items.length:null};
}
export async function reviewReply(s:EmailSession,input:any,aal2:boolean){
 if(!validUuid(input.reply_id))throw Error("Select a valid reply");
 const category=String(input.category||"");
 if(!CATEGORIES.includes(category as Category))throw Error("Choose a supported response category");
 const decision=String(input.decision||"reviewed");
 if(!["reviewed","final_confirmation_pending","verified_final"].includes(decision))throw Error("Unsupported case stage");
 const note=String(input.note||"").trim();
 if(note.length<8||note.length>1000)throw Error("Add a factual review note of 8–1000 characters");
 const {data:reply,error:replyError}=await s.db.from("reskonnect_email_replies")
  .select("id,outbound_email_id,review_status").eq("id",input.reply_id).eq("actor_user_id",s.actor).maybeSingle();
 if(replyError||!reply)throw Error("This Gmail reply is not in your authorized inbox");
 const {data:outgoing,error:outError}=await s.db.from("reskonnect_outbound_emails")
  .select("target_kind,target_id,recipient_user_id").eq("id",reply.outbound_email_id).eq("actor_user_id",s.actor).maybeSingle();
 if(outError||!outgoing)throw Error("The source email no longer belongs to this account");
 const caseContext=await readCase(s,outgoing.target_kind,outgoing.target_id);
 if(decision!=="reviewed"&&category!=="confirmation_intent")throw Error("Final confirmation review requires an explicit student confirmation response");
 if(decision==="verified_final"){
  if(!s.isAdmin||!aal2)throw Error("Final confirmation needs an MFA-verified ResKonnect administrator");
  if(outgoing.target_kind!=="reservation"||caseContext.status!=="confirmed")
   throw Error("A reply cannot confirm a placement. The linked reservation must already be officially confirmed.");
  const {data:workflow,error:workflowError}=await s.db.from("rk_case_workflows")
   .select("handover_approved_at,stage").eq("kind","reservation").eq("case_id",outgoing.target_id).maybeSingle();
  if(workflowError||!workflow?.handover_approved_at||!["handover_approved","closed"].includes(String(workflow.stage)))
   throw Error("Complete verified eligibility and ResKonnect handover signoff before recording final confirmation");
  if(!caseContext.userId)throw Error("A linked student identity is required to complete the housing lifecycle");
  const {data:existing,error:existingError}=await s.db.from("rk_student_journey_milestones")
   .select("status").eq("user_id",caseContext.userId).eq("milestone","housing").maybeSingle();
  if(existingError)throw Error("Student journey status is unavailable");
  const evidence="reskonnect_email_reply:"+reply.id;
  const {error:journeyError}=await s.db.from("rk_student_journey_milestones").upsert({
   user_id:caseContext.userId,milestone:"housing",status:"verified_complete",
   note:"Official confirmed reservation and approved handover; student email confirmation reviewed",
   evidence_reference:evidence,updated_by:s.actor,verified_at:new Date().toISOString()
  },{onConflict:"user_id,milestone"});
  if(journeyError)throw Error("Cannot verify the student housing journey; confirmation case was not finalized");
  if(existing?.status!=="verified_complete"){
   const {error:auditError}=await s.db.from("rk_student_journey_audit").insert({
    user_id:caseContext.userId,milestone:"housing",old_status:existing?.status||"not_started",
    new_status:"verified_complete",actor_id:s.actor,note:"Verified official reservation and handover following reviewed student confirmation",
    evidence_reference:evidence
   });
   if(auditError)throw Error("Housing milestone was updated, but the journey audit needs reconciliation");
  }
 }
 const stage=decision==="verified_final"?"final_confirmation_verified":
  decision==="final_confirmation_pending"?"final_confirmation_review":
  category==="documents_provided"||category==="documents_question"?"documents_review":
  category==="viewing_request"?"viewing_review":
  category==="more_time"||category==="declined"?"follow_up":"closed";
 const now=new Date().toISOString();
 const {error:caseError}=await s.db.from("reskonnect_email_response_cases").update({
  recommended_stage:stage,case_stage:stage,status:decision==="verified_final"?"verified":"reviewed",
  reviewed_by:s.actor,reviewed_at:now,review_note:note,updated_at:now
 }).eq("reply_id",reply.id).eq("actor_user_id",s.actor);
 if(caseError)throw Error("Could not update this response case");
 const {error:reviewError}=await s.db.from("reskonnect_email_replies").update({
  review_status:decision,reviewed_category:category,reviewed_by:s.actor,reviewed_at:now,review_note:note
 }).eq("id",reply.id).eq("actor_user_id",s.actor);
 if(reviewError)throw Error("The response case was updated but the reply review audit needs reconciliation");
 return {reviewed:true,case_stage:stage,student_lifecycle_updated:decision==="verified_final"};
}
