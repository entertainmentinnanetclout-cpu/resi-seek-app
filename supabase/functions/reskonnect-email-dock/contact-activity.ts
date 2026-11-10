import {canView,permitted,safe,tables,validUuid,type EmailSession} from "./context.ts";
import type {Kind} from "./correspondence.ts";

type Channel="email"|"whatsapp"|"status";
type Activity={
 id:string;source:string;target_kind:Kind|"contact";target_id:string;contact_id?:string;
 channel:Channel;state:string;at:string;operator_id?:string|null;
};
const LIMIT=120;
const page=(n:unknown)=>Math.min(40,Math.max(0,Math.floor(Number(n)||0)));
const setOf=(rows:any[],key:string)=>[...new Set(rows.map(r=>r[key]).filter(validUuid))] as string[];
const batch=async (db:any,table:string,field:string,ids:string[],columns:string,limit=1500)=>{
 if(!ids.length)return [] as any[];
 const rows:any[]=[];
 for(let i=0;i<ids.length;i+=100){
  const {data,error}=await db.from(table).select(columns).in(field,ids.slice(i,i+100)).limit(limit);
  if(error)throw new Error("Contact activity lookup is temporarily unavailable");
  rows.push(...(data||[]));
 }
 return rows;
};
const recordKey=(row:any,kind:Kind)=>String(row.id);
const personName=(row:any,profile:any)=>safe(row?.applicant_name||row?.contact_name||row?.full_name||profile?.full_name||"Student",95);
const latest=(rows:any[])=>rows.sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")))[0]||null;

export async function contactActivity(s:EmailSession,input:any){
 const {db}=s;
 const offset=page(input?.page)*LIMIT;
 const queries=[
  {source:"premium_email",channel:"email" as const,run:()=>db.from("reskonnect_outbound_emails")
   .select("id,target_kind,target_id,delivery_status,created_at,sent_at,actor_user_id")
   .order("created_at",{ascending:false}).range(offset,offset+LIMIT-1)},
  {source:"manual_whatsapp",channel:"whatsapp" as const,run:()=>db.from("reskonnect_whatsapp_handoffs")
   .select("id,target_kind,target_id,status,created_at,marked_sent_at,actor_user_id")
   .order("created_at",{ascending:false}).range(offset,offset+LIMIT-1)},
  {source:"bulk_status",channel:"status" as const,run:()=>db.from("reskonnect_bulk_status_audit")
   .select("id,target_kind,target_id,new_status,created_at,actor_user_id")
   .order("created_at",{ascending:false}).range(offset,offset+LIMIT-1)},
  {source:"application_status",channel:"status" as const,run:()=>db.from("application_status_history")
   .select("id,application_id,new_status,created_at,actor_user_id")
   .not("application_id","is",null).order("created_at",{ascending:false}).range(offset,offset+LIMIT-1)},
  {source:"provider_whatsapp",channel:"whatsapp" as const,run:()=>db.from("adminos_whatsapp_messages")
   .select("id,contact_id,status,created_at,sent_at,delivered_at")
   .eq("direction","outbound").not("contact_id","is",null)
   .order("created_at",{ascending:false}).range(offset,offset+LIMIT-1)},
  {source:"provider_email",channel:"email" as const,run:()=>db.from("adminos_email_messages")
   .select("id,contact_id,created_at,sent_at")
   .eq("direction","outbound").not("contact_id","is",null)
   .order("created_at",{ascending:false}).range(offset,offset+LIMIT-1)},
  {source:"provider_email_outbox",channel:"email" as const,run:()=>db.from("adminos_email_outbox")
   .select("id,contact_id,created_at,sent_at")
   .eq("status","sent").not("contact_id","is",null)
   .order("created_at",{ascending:false}).range(offset,offset+LIMIT-1)},
 ];
 const results=await Promise.all(queries.map(q=>q.run()));
 if(results.some(r=>r.error))throw Error("Contact activity services are temporarily unavailable");
 const has_more=results.some(r=>(r.data||[]).length===LIMIT);
 const events:Activity[]=[];
 results.forEach((r,i)=>{
  const source=queries[i].source,channel=queries[i].channel;
  for(const row of r.data||[]){
   const kind:Kind|"contact"=source==="application_status"?"application":
    source.startsWith("provider_")?"contact":row.target_kind;
   const id=source==="application_status"?row.application_id:
    source.startsWith("provider_")?row.contact_id:row.target_id;
   if(!id||(!["application","reservation","housing_lead","support_enquiry","contact"].includes(kind)))continue;
   const state=source==="premium_email"?String(row.delivery_status):
    source==="manual_whatsapp"?String(row.status):
    channel==="status"?String(row.new_status):
    source==="provider_whatsapp"?String(row.status||"sent"):"sent";
   const at=(source==="premium_email"?row.sent_at:
    source==="manual_whatsapp"?row.marked_sent_at:
    channel==="email"||channel==="whatsapp"?row.sent_at:null)||row.created_at;
   if(!at)continue;
   events.push({id:String(row.id),source,target_kind:kind,target_id:id,contact_id:kind==="contact"?id:undefined,
    channel,state,at,operator_id:row.actor_user_id||null});
  }
 });
 const contactIds=[...new Set(events.map(e=>e.contact_id).filter(validUuid))] as string[];
 const contacts=await batch(db,"adminos_contacts","id",contactIds,"id,profile_user_id,full_name,contact_type");
 const contactsById=new Map<string,any>(contacts.map(c=>[c.id,c]));
 const linkUserIds=[...new Set(contacts.map(c=>c.profile_user_id).filter(validUuid))] as string[];
 const directByKind=new Map<Kind,any[]>();
 for(const kind of ["application","reservation","housing_lead","support_enquiry"] as Kind[]){
  const ids=[...new Set(events.filter(e=>e.target_kind===kind).map(e=>e.target_id))];
  directByKind.set(kind,await batch(db,tables[kind],"id",ids,
   kind==="application"?"id,user_id,residence_id,status,created_at":
   kind==="reservation"?"id,user_id,residence_id,status,applicant_name,created_at":
   kind==="housing_lead"?"id,user_id,residence_id,stage,contact_name,created_at":
   "id,user_id,status,full_name,consent_to_be_contacted,created_at"));
 }
 const [linkedApps,linkedReservations]=await Promise.all([
  batch(db,"applications","user_id",linkUserIds,"id,user_id,residence_id,status,created_at"),
  batch(db,"accommodation_reservations","user_id",linkUserIds,"id,user_id,residence_id,status,applicant_name,created_at")
 ]);
 const linkedByUser=new Map<string,{kind:Kind;row:any}>();
 for(const [kind,rows] of [["application",linkedApps],["reservation",linkedReservations]] as [Kind,any[]][]){
  for(const row of rows){
   if(!s.isAdmin&&!canView(s,row.residence_id||null))continue;
   const old=linkedByUser.get(row.user_id);
   if(!old||String(row.created_at)>String(old.row.created_at))linkedByUser.set(row.user_id,{kind,row});
  }
 }
 const direct=new Map<string,any>();
 for(const [kind,rows] of directByKind){
  for(const row of rows)direct.set(kind+":"+recordKey(row,kind),row);
 }
 const userIds=[...new Set([
  ...[...direct.values()].map(x=>x.user_id),
  ...linkUserIds
 ].filter(validUuid))] as string[];
 const residenceIds=[...new Set([
  ...[...direct.values()].map(x=>x.residence_id),
  ...[...linkedByUser.values()].map(x=>x.row.residence_id)
 ].filter(validUuid))] as string[];
 const [profiles,residences]=await Promise.all([
  batch(db,"profiles","id",userIds,"id,full_name"),
  batch(db,"residences","id",residenceIds,"id,name")
 ]);
 const people=new Map<string,any>(profiles.map(p=>[p.id,p]));
 const places=new Map<string,string>(residences.map(r=>[r.id,r.name]));
 const grouped=new Map<string,any>();
 for(const event of events.sort((a,b)=>b.at.localeCompare(a.at))){
  let row:any=null,kind:Kind|"contact"=event.target_kind,recordId=event.target_id;
  const contact=event.contact_id?contactsById.get(event.contact_id):null;
  if(kind==="contact"){
   if(!contact)continue;
   const linked=contact.profile_user_id?linkedByUser.get(contact.profile_user_id):null;
   if(linked){kind=linked.kind;row=linked.row;recordId=row.id;}
   else if(!s.isAdmin)continue;
  }else row=direct.get(kind+":"+recordId);
  if(kind!=="contact"){
   if(!row||!permitted(s,kind)||!canView(s,row.residence_id||null))continue;
   if(kind==="support_enquiry"&&row.consent_to_be_contacted!==true)continue;
  }
  const userId=row?.user_id||contact?.profile_user_id||null;
  const groupKey=userId?"user:"+userId:kind==="contact"?"contact:"+contact.id:kind+":"+recordId;
  const p=userId?people.get(userId):null;
  const eventRow={id:event.id,channel:event.channel,source:event.source,state:event.state,at:event.at};
  let entry=grouped.get(groupKey);
  if(!entry){
   entry={key:groupKey,student_name:kind==="contact"?safe(contact?.full_name||"Unlinked WhatsApp contact",95):personName(row,p),
    property:row?.residence_id?places.get(row.residence_id)||"Residence":"No linked residence",
    status:String(row?.status||row?.stage||"Unlinked contact"),
    case_kind:kind==="contact"?null:kind,case_id:kind==="contact"?null:recordId,
    linked:kind!=="contact",last_at:event.at,
    email_count:0,whatsapp_count:0,status_count:0,last_email_state:null,last_whatsapp_state:null,
    last_status_change:null,events:[] as any[]};
   grouped.set(groupKey,entry);
  }
  entry.events.push(eventRow);
  if(event.channel==="email"){
   entry.email_count++;
   if(entry.last_email_state===null)entry.last_email_state=event.state;
  }else if(event.channel==="whatsapp"){
   entry.whatsapp_count++;
   if(entry.last_whatsapp_state===null)entry.last_whatsapp_state=event.state;
  }else{
   entry.status_count++;
   if(entry.last_status_change===null)entry.last_status_change=event.state;
  }
  if(entry.events.length>30)entry.events.length=30;
 }
 const items=[...grouped.values()].sort((a,b)=>b.last_at.localeCompare(a.last_at));
 for(const item of items){
  const last=item.events[0];
  const latestContact=item.events.find((e:any)=>e.channel!=="status"&&(
   (e.channel==="email"&&e.state==="sent")||
   (e.channel==="whatsapp"&&["sent","delivered","read","operator_marked_sent"].includes(e.state))));
  const latestStatus=item.events.find((e:any)=>e.channel==="status");
  if(!item.linked)item.next_action="Link this contact to a student case before taking a case action";
  else if(item.last_email_state==="unknown")item.next_action="Check Gmail Sent before retrying an uncertain email";
  else if(item.last_whatsapp_state==="opened")item.next_action="WhatsApp opened only; confirm whether the message was sent";
  else if(latestStatus&&(!latestContact||latestStatus.at>latestContact.at))
   item.next_action="Review the new status and send a factual update if needed";
  else if(["approved","confirmed","rejected"].includes(item.status.toLowerCase()))
   item.next_action="Review placement and decision follow-up";
  else if(item.status==="documents_required")item.next_action="Follow up on missing documents";
  else item.next_action="Review case and plan the next contact";
  // Never return applicant emails, phone numbers, message bodies, or unrestricted case rows.
  item.events=item.events.slice(0,20);
 }
 return {items,has_more,next_page:page(input?.page)+1,as_of:new Date().toISOString(),
  scanned_events:events.length,scope:s.isAdmin?"admin":"assigned_residences"};
}
