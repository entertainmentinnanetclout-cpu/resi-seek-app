import {createClient} from "npm:@supabase/supabase-js@2.86.2";
import {KINDS,TEMPLATES,TEMPLATE_KEYS,APPLICATION_STATUSES,RESERVATION_STATUSES,
 smartTemplate,validateTemplate,type Kind,type TemplateKey} from "./correspondence.ts";
import {type EmailSession,readCase,listCases,validUuid,permitted,publicCase} from "./context.ts";
import {previewPacket,makePreviewPdf,sendOne} from "./send.ts";

const HEAD={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const res=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:HEAD});
const keys:TemplateKey[]=["smart",...TEMPLATE_KEYS];
const isKind=(x:unknown):x is Kind=>typeof x==="string"&&KINDS.includes(x as Kind);
const isTemplate=(x:unknown):x is TemplateKey=>typeof x==="string"&&keys.includes(x as TemplateKey);
const idsFrom=(x:unknown,max:number):string[]|null=>
 Array.isArray(x)&&x.length>0&&x.length<=max&&x.every(validUuid)&&new Set(x).size===x.length?x:null;
const messageText=(x:any)=>typeof x==="string"?x.trim():"";
const failure=(e:unknown)=>{const msg=e instanceof Error?e.message:"Request could not be completed";
 const forbidden=/another residence|not consent|restricted|not authorized|permission|access denied/i.test(msg);
 return res({error:msg},forbidden?403:422);
};

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 if(req.method!=="POST")return res({error:"Method not allowed"},405);
 const bearer=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!bearer)return res({error:"Sign in to ResKonnect"},401);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!service)return res({error:"Service configuration unavailable"},503);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authErr}=await db.auth.getUser(bearer);
 if(authErr||!auth.user)return res({error:"ResKonnect login session expired"},401);
 const actor=auth.user.id;
 const [roles,portal]=await Promise.all([
  db.from("user_roles").select("role").eq("user_id",actor).in("role",["admin","residence_portal"]),
  db.from("residence_portal_accounts").select("residence_id").eq("user_id",actor).eq("is_active",true)
 ]);
 if(roles.error||portal.error)return res({error:"Role verification unavailable"},503);
 const isAdmin=!!roles.data?.some(x=>x.role==="admin");
 const isLandlord=!!roles.data?.some(x=>x.role==="residence_portal")&&!!portal.data?.length;
 if(!isAdmin&&!isLandlord)return res({error:"The Email Dock is for authorized staff and landlords only"},403);
 const s:EmailSession={db,actor,isAdmin,residences:new Set((portal.data||[]).map(x=>x.residence_id))};
 let input:any;
 try{input=await req.json();}catch{return res({error:"Invalid request JSON"},400);}
 const action=String(input?.action||"");
 const kind:Kind=input.kind;
 const kindOK=isKind(kind)&&permitted(s,kind);
 const key:TemplateKey=isTemplate(input.template_key)?input.template_key:"smart";
 const note=messageText(input.message);
 if(note.length>2500)return res({error:"Message note exceeds 2,500 characters"},400);

 if(action==="history"){
  const {data,error}=await db.from("reskonnect_outbound_emails").select("id,target_kind,target_id,template_key,recipient_email,subject,delivery_status,created_at,sent_at,failure_code,pdf_attached,batch_id")
   .eq("actor_user_id",actor).order("created_at",{ascending:false}).limit(100);
  if(error)return res({error:"Cannot retrieve email audit history"},503);
  return res({items:(data||[]).map(item=>({...item,recipient_email:isAdmin?item.recipient_email.slice(0,2)+"***@"+item.recipient_email.split("@")[1]:"Private recipient"}))});
 }
 if(action==="templates"){
  const {data,error}=await db.from("reskonnect_email_templates")
   .select("target_kind,template_key,subject_template,body_template,updated_at").eq("owner_user_id",actor);
  if(error)return res({error:"Cannot load editable templates"},503);
  return res({defaults:TEMPLATES,overrides:data||[],placeholders:["student_name","property","reference","status","document_list","next_step","custom_note","kind_label","year","contact_email"]});
 }
 if(action==="save_template"||action==="reset_template"){
  if(!kindOK||!isTemplate(input.template_key)||input.template_key==="smart")
   return res({error:"Invalid template category"},400);
  if(action==="reset_template"){
   const {error}=await db.from("reskonnect_email_templates").delete()
    .eq("owner_user_id",actor).eq("target_kind",kind).eq("template_key",input.template_key);
   return error?res({error:"Unable to reset template"},503):res({saved:true});
  }
  const subject=String(input.subject_template||""),body=String(input.body_template||"");
  if(!validateTemplate(subject,180)||!validateTemplate(body,4000)||subject.length<5||body.length<20||/[\r\n]/.test(subject))
   return res({error:"Invalid template. Use only the supported placeholders and allowed lengths."},400);
  const {error}=await db.from("reskonnect_email_templates").upsert({
   owner_user_id:actor,target_kind:kind,template_key:input.template_key,
   subject_template:subject.trim(),body_template:body.trim(),updated_at:new Date().toISOString()
  },{onConflict:"owner_user_id,target_kind,template_key"});
  return error?res({error:"Could not save template"},503):res({saved:true});
 }
 if(!kindOK)return res({error:"Invalid or restricted record category"},403);
 if(action==="list"){
  try{const items=await listCases(s,kind);if(validUuid(input.highlight_id)&&!items.some(x=>x.id===input.highlight_id)){const c=await readCase(s,kind,input.highlight_id);const safe=publicCase(s,c);items.unshift({...safe,created_at:new Date().toISOString(),document_stage:c.documents.stage,missing_count:c.documents.missing.length,pending_review:c.documents.pendingReview});}return res({items});}catch(e){return failure(e);}
 }
 if(["case","preview","pdf_preview","send"].includes(action)){
  if(!validUuid(input.target_id))return res({error:"Invalid record ID"},400);
  try{
   const c=await readCase(s,kind,input.target_id);
   if(action==="case")return res({case:publicCase(s,c),statuses:kind==="application"?APPLICATION_STATUSES:kind==="reservation"?RESERVATION_STATUSES:[]});
   const packet=await previewPacket(s,c,key,note);
   if(action==="preview")return res({...packet,case:publicCase(s,c),recipient_hint:publicCase(s,c).recipient_hint,pdf_attached:true});
   if(action==="pdf_preview")return res(await makePreviewPdf(s,c,key,note));
   if(input.confirmed!==true||!validUuid(input.request_id))return res({error:"Send confirmation and request ID required"},400);
   if(input.expected_status!==c.status||input.expected_document_stage!==c.documents.stage)return res({error:"Case details or document uploads changed since preview; regenerate the email"},409);
   const result=await sendOne(s,c,key,note,input.request_id,null);
   return res(result,result.sent?200:result.status||502);
  }catch(e){return failure(e);}
 }
 if(["bulk_preview","bulk_send","bulk_status_preview","bulk_status_apply"].includes(action)){
  const max=action==="bulk_send"?5:25;
  const ids=idsFrom(input.ids,max);
  if(!ids)return res({error:"Select 1 to "+max+" unique case records"},400);
  if(action==="bulk_preview"){
   const items:any[]=[];
   for(const id of ids){
    try{const c=await readCase(s,kind,id);const packet=await previewPacket(s,c,key,note);
      items.push({id,ok:true,...publicCase(s,c),subject:packet.subject,body:packet.body,resolved_key:packet.resolved_key});}
    catch(e){items.push({id,ok:false,error:e instanceof Error?e.message:"Unavailable"});}
   }
   return res({items,eligible:items.filter(x=>x.ok).length,requested:ids.length});
  }
  if(action==="bulk_send"){
   if(input.confirmed!==true||!validUuid(input.batch_id)||!Array.isArray(input.requests)||input.requests.length!==ids.length||
      input.requests.some((r:any,i:number)=>r?.id!==ids[i]||!validUuid(r.request_id)))
    return res({error:"Review and explicitly approve each batch of up to five emails"},400);
   const results:any[]=[];
   for(const item of input.requests){
    try{const c=await readCase(s,kind,item.id);if(item.expected_status!==c.status||item.expected_document_stage!==c.documents.stage)throw Error("Case changed since bulk preview; review again");const result=await sendOne(s,c,key,note,item.request_id,input.batch_id);
      results.push({id:item.id,...result});}
    catch(e){results.push({id:item.id,sent:false,error:e instanceof Error?e.message:"Send failed"});}
   }
   return res({results,succeeded:results.filter(x=>x.sent).length,failed:results.filter(x=>!x.sent).length});
  }
  if(!["application","reservation"].includes(kind))return res({error:"Only applications and reservations have bulk statuses"},400);
  const desired=String(input.new_status||"");
  const allowed=kind==="application"?APPLICATION_STATUSES:RESERVATION_STATUSES;
  if(!allowed.includes(desired))return res({error:"Invalid status for this case type"},400);
  const reason=messageText(input.status_note);
  if(reason.length>500)return res({error:"Status note exceeds 500 characters"},400);
  if(["approved","rejected","conditionally_approved","confirmed","cancelled"].includes(desired)&&reason.length<8)
   return res({error:"Provide a factual decision note of at least eight characters"},400);
  const expected=input.expected_statuses;
  const preview:any[]=[];
  for(const id of ids){
   try{
    const c=await readCase(s,kind,id);
    const needsDocumentCheck=(kind==="application"&&["approved","conditionally_approved"].includes(desired))||(kind==="reservation"&&desired==="confirmed");
    const missing=needsDocumentCheck?c.documents.missing:[];
    let why=c.status===desired?"Already in this status":missing.length?"Missing required files: "+missing.join(", "):null;
    if(typeof expected?.[id]==="string"&&expected[id]!==c.status)why="Recorded status changed since selection";
    preview.push({id,ok:!why,reason:why,from:c.status,to:desired,label:c.studentName,document_signal:c.documents});
   }catch(e){preview.push({id,ok:false,reason:e instanceof Error?e.message:"Not available"});}
  }
  if(action==="bulk_status_preview")return res({items:preview,eligible:preview.filter(x=>x.ok).length,requested:ids.length});
  if(input.confirmed!==true||!validUuid(input.operation_id)||!expected||ids.some(id=>typeof expected[id]!=="string"))
   return res({error:"Bulk status update requires confirmed operation ID and original status for each record"},400);
  const results:any[]=[];
  for(const p of preview){
   if(!p.ok){results.push({id:p.id,updated:false,error:p.reason});continue;}
   const {data:existing,error:dupeErr}=await db.from("reskonnect_bulk_status_audit")
    .select("id").eq("actor_user_id",actor).eq("operation_id",input.operation_id).eq("target_id",p.id).maybeSingle();
   if(dupeErr||existing){results.push({id:p.id,updated:false,error:existing?"Already processed":"Audit check unavailable"});continue;}
   const table=kind==="application"?"applications":"accommodation_reservations";
   const {data:changed,error:updateErr}=await db.from(table).update({status:desired}).eq("id",p.id).eq("status",p.from)
    .select("id,user_id,residence_id").maybeSingle();
   if(updateErr||!changed){results.push({id:p.id,updated:false,error:"The recorded case changed or update was blocked"});continue;}
   const {error:auditErr}=await db.from("reskonnect_bulk_status_audit").insert({
    actor_user_id:actor,operation_id:input.operation_id,target_kind:kind,
    target_id:p.id,old_status:p.from,new_status:desired,document_signal:p.document_signal.stage
   });
   if(auditErr)console.error("Status changed but bulk audit insert failed",p.id,auditErr.message);
   if(kind==="application"){
    await db.from("application_activity_log").insert({
     application_id:p.id,residence_id:changed.residence_id,actor_type:isAdmin?"admin":"residence",
     actor_user_id:actor,action_type:"status_updated",metadata:{previous_status:p.from,new_status:desired,bulk_operation_id:input.operation_id,note:reason}
    });
   }
   if(changed.user_id){
    await db.from("notifications").insert({
     user_id:changed.user_id,type:kind==="application"?"application_status":"reservation_status",
     title:"ResKonnect "+kind+" updated",
     message:"Your "+kind+" is now "+desired.replace(/_/g," ")+". Sign in to see the current details.",
     metadata:{record_id:p.id,status:desired,bulk_operation_id:input.operation_id}
    });
   }
   results.push({id:p.id,updated:true,to:desired});
  }
  return res({results,updated:results.filter(x=>x.updated).length,failed:results.filter(x=>!x.updated).length,
   emails_sent:0,message:"Statuses have been processed. Email notifications require a separate reviewed send."});
 }
 return res({error:"Unknown premium email dock operation"},400);
});
