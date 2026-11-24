import {supabase} from "@/integrations/supabase/client";

const CLOSED = new Set(["cancelled","withdrawn","rejected"]);
type Kind="application"|"reservation";
export type HousingChoice={allowed:boolean;reason:string;slotsUsed:number};

/** Informational preflight for a better user experience.
 * Authoritative, race-safe enforcement is done in the database trigger.
 */
export async function checkStudentHousingChoice(userId:string,residenceId:string,academicYear:number,kind:Kind):Promise<HousingChoice>{
 const [a,b]=await Promise.all([
  supabase.from("applications").select("residence_id,status").eq("user_id",userId).eq("academic_year",academicYear),
  (supabase as any).from("accommodation_reservations").select("residence_id,status").eq("user_id",userId).eq("academic_year",academicYear),
 ]);
 if(a.error||b.error)return {allowed:false,reason:"Could not verify your existing accommodation requests. Refresh your dashboard and try again.",slotsUsed:0};
 const active=(rows:any[])=>rows.filter(r=>r.residence_id&&!CLOSED.has(String(r.status||"").toLowerCase()));
 const applications=active(a.data||[]),reservations=active(b.data||[]);
 const slots=new Set([...applications,...reservations].map(r=>r.residence_id));
 if((kind==="application"?applications:reservations).some(r=>r.residence_id===residenceId)){
  return {allowed:false,reason:`You already have an active ${kind} for this residence in ${academicYear}. Track it in My ResKonnect.`,slotsUsed:slots.size};
 }
 if(!slots.has(residenceId)&&slots.size>=3){
  return {allowed:false,reason:`You have already selected three different residences for ${academicYear}. Review your applications or reservations in My ResKonnect before selecting another.`,slotsUsed:slots.size};
 }
 return {allowed:true,reason:"",slotsUsed:slots.size};
}
