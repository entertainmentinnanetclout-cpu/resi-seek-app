import type {EmailSession} from "./context.ts";
import {canView,safe,validUuid} from "./context.ts";

type Reservation={id:string;applicant_name:string|null;created_at:string;status:string};
type Attempt={id:string;target_id:string;template_key:string;delivery_status:string;sent_at:string|null;created_at:string;provider_message_id:string|null};
const localDay=(iso:string)=>new Date(new Date(iso).getTime()+2*60*60*1000).toISOString().slice(0,10);
const percentage=(value:number,denominator:number)=>denominator>0?Math.round(value*1000/denominator)/10:null;

/** Exact count of case records, distinct contacted cases and message attempts.
 * Never compare a message count with a reservation count or silently invent Gmail receipts.
 */
export function summarizeReservationCorrespondence(reservations:Reservation[],attempts:Attempt[]){
 const ids=new Set(reservations.map(r=>r.id));
 if(ids.size!==reservations.length)throw Error("Duplicate reservation IDs in reconciliation input");
 if(attempts.some(a=>!ids.has(a.target_id)))throw Error("Email attempts escaped the requested reservation scope");
 const byCase=new Map<string,Attempt[]>();
 const byDay:Record<string,number>={},byTemplate:Record<string,number>={};
 let sentMessages=0,providerReceipts=0,failedAttempts=0,uncertainAttempts=0;
 for(const attempt of attempts){
  const group=byCase.get(attempt.target_id)||[];
  group.push(attempt);byCase.set(attempt.target_id,group);
  if(attempt.delivery_status==="sent"){
   sentMessages++;
   if(attempt.provider_message_id)providerReceipts++;
   const day=localDay(attempt.sent_at||attempt.created_at);
   byDay[day]=(byDay[day]||0)+1;
   const key=attempt.template_key||"unknown";
   byTemplate[key]=(byTemplate[key]||0)+1;
  }else if(["unknown","sending"].includes(attempt.delivery_status))uncertainAttempts++;
  else if(attempt.delivery_status==="failed")failedAttempts++;
 }
 let contacted=0,neverAttempted=0,uncertainOnly=0,failedOnly=0,withAdditionalUncertainty=0;
 const pending:{id:string;reference:string;student_name:string;status:string;reason:string}[]=[];
 const reviewUncertainty:{id:string;reference:string;status:string}[]=[];
 for(const reservation of reservations){
  const related=byCase.get(reservation.id)||[];
  const sent=related.some(a=>a.delivery_status==="sent");
  const uncertain=related.some(a=>["unknown","sending"].includes(a.delivery_status));
  if(sent){contacted++;if(uncertain){withAdditionalUncertainty++;reviewUncertainty.push({id:reservation.id,reference:reservation.id.slice(0,8).toUpperCase(),status:reservation.status});}continue;}
  const reason=related.length===0?"never_attempted":uncertain?"uncertain_only":"failed_only";
  if(reason==="never_attempted")neverAttempted++;
  else if(reason==="uncertain_only")uncertainOnly++;
  else failedOnly++;
  pending.push({id:reservation.id,reference:reservation.id.slice(0,8).toUpperCase(),student_name:safe(reservation.applicant_name||"Student",85),status:reservation.status,reason});
 }
 const total=reservations.length;
 if(contacted+neverAttempted+uncertainOnly+failedOnly!==total||sentMessages<contacted)
  throw Error("Reservation and email totals do not reconcile: data completeness cannot be asserted");
 return {
  total_reservations:total,unique_reservations_emailed:contacted,
  coverage_percent:percentage(contacted,total),not_emailed:total-contacted,
  never_attempted:neverAttempted,uncertain_only:uncertainOnly,failed_only:failedOnly,
  sent_messages:sentMessages,provider_receipts:providerReceipts,
  repeat_sent_messages:sentMessages-contacted,
  total_attempts:attempts.length,failed_attempts:failedAttempts,uncertain_attempts:uncertainAttempts,
  with_additional_uncertainty:withAdditionalUncertainty,
  by_day:Object.entries(byDay).sort(([a],[b])=>b.localeCompare(a)).map(([day,count])=>({day,count})),
  by_template:Object.entries(byTemplate).sort(([a],[b])=>a.localeCompare(b)).map(([template,count])=>({template,count})),
  pending,review_uncertainty:reviewUncertainty,
  invariant:"total_reservations = unique_reservations_emailed + never_attempted + uncertain_only + failed_only"
 };
}
export async function reconcileReservationCorrespondence(s:EmailSession,rawResidence:unknown,rawYear:unknown){
 if(!validUuid(rawResidence)||!canView(s,rawResidence))throw Error("Not authorized for this residence's private email ledger");
 const year=Number(rawYear);
 if(!Number.isInteger(year)||year<2025||year>2030)throw Error("Choose a valid academic year");
 const {data:residence,error:residenceError}=await s.db.from("residences").select("id,name").eq("id",rawResidence).maybeSingle();
 if(residenceError||!residence)throw Error("Residence was not found");
 const reservations:Reservation[]=[];
 const perPage=500;
 for(let offset=0;offset<5000;offset+=perPage){
  const {data,error}=await s.db.from("accommodation_reservations")
   .select("id,applicant_name,created_at,status").eq("residence_id",rawResidence)
   .eq("academic_year",year).order("created_at",{ascending:false})
   .order("id",{ascending:false}).range(offset,offset+perPage-1);
  if(error)throw Error("Reservation ledger could not be read completely");
  const rows=(data||[]) as Reservation[];
  reservations.push(...rows);
  if(rows.length<perPage)break;
  if(offset+perPage>=5000)throw Error("This residence has more than 5,000 reservations. Use an audited paginated export instead.");
 }
 const attempts:Attempt[]=[];
 for(let at=0;at<reservations.length;at+=80){
  const ids=reservations.slice(at,at+80).map(r=>r.id);
  for(let offset=0;offset<5000;offset+=500){
   const {data,error}=await s.db.from("reskonnect_outbound_emails")
    .select("id,target_id,template_key,delivery_status,sent_at,created_at,provider_message_id")
    .eq("target_kind","reservation").in("target_id",ids)
    .order("created_at",{ascending:false}).range(offset,offset+499);
   if(error)throw Error("Email attempt ledger could not be read completely");
   const rows=(data||[]) as Attempt[];
   attempts.push(...rows);
   if(rows.length<500)break;
   if(offset+500>=5000)throw Error("Email audit exceeds 5,000 messages in one block. Narrow the reconciliation.");
  }
 }
 return {residence_id:residence.id,residence_name:residence.name,academic_year:year,
  verified_at:new Date().toISOString(),source:"Supabase reservation and Gmail provider acceptance audit",
  ...summarizeReservationCorrespondence(reservations,attempts)};
}
