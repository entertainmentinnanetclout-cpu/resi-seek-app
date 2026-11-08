import {supabase} from "@/integrations/supabase/client";

export const ACCOMMODATION_APPLICATION_YEAR = 2026;
export const RESERVATION_YEAR = 2027;

export type ResidenceIntakeRule = {
 residence_id:string; academic_year:number; is_open:boolean;private_only:boolean;
 opens_on:string;closes_on:string;
};
const saDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

/** Default closed. Failure to read the policy never opens a registration route. */
export function canApplyToResidence(rule:ResidenceIntakeRule|null|undefined, fundingType="private"):boolean{
 if(!rule?.is_open)return false;
 const now=saDate();
 if(now<rule.opens_on||now>rule.closes_on)return false;
 if(rule.private_only&&fundingType!=="private")return false;
 return true;
}

export async function getResidenceIntake(residenceId:string,academicYear=ACCOMMODATION_APPLICATION_YEAR):Promise<ResidenceIntakeRule|null>{
 const {data,error}=await (supabase as any).from("residence_application_intake")
  .select("residence_id,academic_year,is_open,private_only,opens_on,closes_on")
  .eq("residence_id",residenceId).eq("academic_year",academicYear).maybeSingle();
 if(error){console.warn("[intake] Failed to load application schedule",error.message);return null;}
 return data as ResidenceIntakeRule|null;
}
