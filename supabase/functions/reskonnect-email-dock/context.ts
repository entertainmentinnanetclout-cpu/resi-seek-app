import {documentSignal,smartTemplate,type CaseContext,type Kind,type DocumentRow} from "./correspondence.ts";
import {residencePhoto} from "./residence-media.ts";
import {normalizeWhatsAppPhone} from "./whatsapp.ts";
import {deriveCaseJourney,type OutboundEmail} from "./case-queue.ts";

export type EmailSession={db:any;actor:string;isAdmin:boolean;residences:Set<string>};
export const tables:Record<Kind,string>={application:"applications",reservation:"accommodation_reservations",housing_lead:"residence_leads",support_enquiry:"application_support_queries"};
export const validUuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const validEmail=(v:unknown):v is string=>typeof v==="string"&&v.length<=254&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(v);
export const permitted=(s:EmailSession,kind:Kind)=>s.isAdmin||kind!=="support_enquiry";
export const canView=(s:EmailSession,id:string|null)=>s.isAdmin||!!id&&s.residences.has(id);
export const safe=(v:unknown,max=120)=>String(v||"").replace(/[\r\n<>]/g," ").trim().slice(0,max);
export const recipientHint=(s:EmailSession,email:string)=>s.isAdmin?email.slice(0,2)+"***@"+email.split("@")[1]:"Verified private recipient";
export const publicCase=(s:EmailSession,c:CaseContext)=>({
 id:c.id,kind:c.kind,label:c.studentName,status:c.status,property:c.property,reference:c.reference,
 academic_year:c.year,document_signal:c.documents,recommended_template:smartTemplate(c),
 recipient_hint:validEmail(c.email)?recipientHint(s,c.email):null,can_email:validEmail(c.email)&&c.contactAllowed,
 residence_image_url:c.residenceImageUrl||null,has_whatsapp:!!c.phoneE164
});

export async function readCase(s:EmailSession,kind:Kind,id:string):Promise<CaseContext>{
 const {db}=s;
 if(!permitted(s,kind))throw Error("This record category is restricted");
 const {data:row,error:rowError}=await db.from(tables[kind]).select("*").eq("id",id).maybeSingle();
 if(rowError)throw Error("Unable to load case");
 if(!row)throw Error("Case was not found");
 if(!canView(s,row.residence_id||null))throw Error("Case belongs to another residence");
 if(kind==="support_enquiry"&&row.consent_to_be_contacted!==true)throw Error("Applicant did not consent to contact");
 const userId=validUuid(row.user_id)?row.user_id:null;
 const [profile,property,docs,caseDocs]=await Promise.all([
  userId?db.from("profiles").select("email,full_name,phone,phone_number,phone_e164").eq("id",userId).maybeSingle():Promise.resolve({data:null,error:null}),
  row.residence_id?db.from("residences").select("name,image_url,cover_image_url,images").eq("id",row.residence_id).maybeSingle():Promise.resolve({data:null,error:null}),
  userId&&(kind==="application"||kind==="reservation")?db.from("documents").select("document_type,status").eq("user_id",userId).limit(150):Promise.resolve({data:[],error:null}),
  kind==="application"?db.from("application_documents").select("doc_type,status").eq("application_id",id).limit(150):Promise.resolve({data:[],error:null})
 ]);
 if(profile.error||property.error||docs.error||caseDocs.error)throw Error("Cannot check applicant documents");
 const address=kind==="support_enquiry"?row.email:kind==="housing_lead"?(row.contact_email||profile.data?.email):profile.data?.email;
 const image=await residencePhoto(db,row.residence_id||null,[property.data?.cover_image_url,property.data?.image_url,property.data?.images]);
 const phoneCandidate=kind==="support_enquiry"?(row.whatsapp_number||row.phone):kind==="housing_lead"?(row.contact_phone||profile.data?.phone_e164||profile.data?.phone):
  (profile.data?.phone_e164||profile.data?.phone||profile.data?.phone_number);
 const phoneE164=normalizeWhatsAppPhone(phoneCandidate);
 const files:DocumentRow[]=[
  ...(docs.data||[]).map((d:any)=>({type:d.document_type,status:d.status})),
  ...(caseDocs.data||[]).map((d:any)=>({type:d.doc_type,status:d.status}))
 ];
 return {
  kind,id,userId,residenceId:row.residence_id||null,
  studentName:safe(row.applicant_name||row.contact_name||row.full_name||profile.data?.full_name||"Student",95),
  property:safe(property.data?.name||"ResKonnect",130),year:String(row.academic_year||""),
  status:String(row.status||row.stage||"new"),email:validEmail(address)?address:"",
  reference:id.split("-")[0].toUpperCase(),fundingType:row.funding_type||null,
  documents:documentSignal(kind,files,row.funding_type||null),
  residenceImageUrl:image?.url||null,phoneE164,
  contactAllowed:kind!=="support_enquiry"||row.consent_to_be_contacted===true
 };
}
export async function listCases(s:EmailSession,kind:Kind,options:{offset:number;pageSize:number;academicYear:number|null}){
 if(!permitted(s,kind))throw Error("Case category is restricted");
 const {db}=s;
 const offset=Math.max(0,Math.floor(options.offset)||0);
 const pageSize=Math.min(100,Math.max(1,Math.floor(options.pageSize)||100));
 let q=db.from(tables[kind]).select("*",{count:"exact"}).order("created_at",{ascending:false}).order("id",{ascending:false});
 if(!s.isAdmin)q=q.in("residence_id",[...s.residences]);
 if((kind==="application"||kind==="reservation")&&options.academicYear)q=q.eq("academic_year",options.academicYear);
 const {data,error,count}=await q.range(offset,offset+pageSize-1);
 if(error)throw Error("Unable to load selected cases");
 const rows=data||[];
 const ids=[...new Set(rows.map((r:any)=>r.user_id).filter(validUuid))] as string[];
 const rid=[...new Set(rows.map((r:any)=>r.residence_id).filter(validUuid))] as string[];
 const [people,places,globalDocs,appDocs]=await Promise.all([
  ids.length?db.from("profiles").select("id,full_name,email").in("id",ids):Promise.resolve({data:[],error:null}),
  rid.length?db.from("residences").select("id,name").in("id",rid):Promise.resolve({data:[],error:null}),
  ids.length&&(kind==="application"||kind==="reservation")?db.from("documents").select("user_id,document_type,status,uploaded_at").in("user_id",ids).limit(1500):Promise.resolve({data:[],error:null}),
  kind==="application"&&rows.length?db.from("application_documents").select("application_id,doc_type,status,uploaded_at").in("application_id",rows.map((r:any)=>r.id)).limit(1500):Promise.resolve({data:[],error:null})
 ]);
 if(people.error||places.error||globalDocs.error||appDocs.error)throw Error("Unable to resolve documents or applicants");
 const {data:outreach,error:outreachError}=rows.length?await db.from("reskonnect_outbound_emails")
  .select("target_id,template_key,delivery_status,created_at,sent_at,context_snapshot")
  .eq("target_kind",kind).in("target_id",rows.map((r:any)=>r.id)).order("created_at",{ascending:false}).limit(1000):{data:[],error:null};
 if(outreachError)throw Error("Unable to synchronize outbound email history");
 const lastMail=new Map<string,OutboundEmail>(),lastSent=new Map<string,OutboundEmail>();
 for(const message of outreach||[]){
  if(!lastMail.has(message.target_id))lastMail.set(message.target_id,message as OutboundEmail);
  if(message.delivery_status==="sent"&&!lastSent.has(message.target_id))lastSent.set(message.target_id,message as OutboundEmail);
 }
 const lastUpload=new Map<string,string>();
 const noteUpload=(id:string,date:string|null|undefined)=>{if(date&&(!lastUpload.has(id)||date>lastUpload.get(id)!))lastUpload.set(id,date);};
 const person=new Map<string,any>((people.data||[]).map((p:any)=>[p.id,p]));
 const place=new Map<string,string>((places.data||[]).map((p:any)=>[p.id,p.name]));
 const docs=new Map<string,DocumentRow[]>(),app=new Map<string,DocumentRow[]>();
 for(const d of globalDocs.data||[]){const list=docs.get(d.user_id)||[];list.push({type:d.document_type,status:d.status});docs.set(d.user_id,list);noteUpload(d.user_id,d.uploaded_at);}
 for(const d of appDocs.data||[]){const list=app.get(d.application_id)||[];list.push({type:d.doc_type,status:d.status});app.set(d.application_id,list);noteUpload(d.application_id,d.uploaded_at);}
 const items=rows.map((r:any)=>{
  const p=person.get(r.user_id);
  const address=kind==="support_enquiry"?r.email:kind==="housing_lead"?(r.contact_email||p?.email):p?.email;
  const submittedDocs=[...(docs.get(r.user_id)||[]),...(app.get(r.id)||[])];
  const signal=documentSignal(kind,submittedDocs,r.funding_type||null);
  const c:CaseContext={
   kind,id:r.id,userId:r.user_id,residenceId:r.residence_id||null,
   studentName:safe(r.applicant_name||r.contact_name||r.full_name||p?.full_name||"Student",95),
   property:place.get(r.residence_id)||"ResKonnect",year:String(r.academic_year||""),
   status:String(r.status||r.stage||"new"),email:validEmail(address)?address:"",
   reference:r.id.split("-")[0].toUpperCase(),fundingType:r.funding_type||null,
   documents:signal,contactAllowed:kind!=="support_enquiry"||r.consent_to_be_contacted===true
  };
  const latestUpload=[lastUpload.get(r.id),lastUpload.get(r.user_id)].filter(Boolean).sort().reverse()[0]||null;
  const journey=deriveCaseJourney(c,lastSent.get(r.id)||lastMail.get(r.id)||null,latestUpload,r.created_at);
  return {...publicCase(s,c),created_at:r.created_at,document_stage:signal.stage,
   missing_count:signal.missing.length,pending_review:signal.pendingReview,uploaded_count:submittedDocs.length,
   workflow_bucket:journey.bucket,...journey};
 });
 return {items,total:count||0,has_more:offset+rows.length<(count||0),next_offset:offset+rows.length};
}
