import { supabase } from "@/integrations/supabase/client";
import type { CourseMatchSubject } from "@/lib/courseMatch";

export type LoggedProgrammeCheck = {
  programme_id:string;
  programme_requirement_id?:string|null;
  status:string;
  aps_required?:number|null;
  summary?:Record<string,unknown>;
  missing?:Array<Record<string,unknown>>;
  matched?:Array<Record<string,unknown>>;
  context?:Record<string,unknown>;
};

export const saveProgrammeCheckHistory = async ({
  userId, institutionType, scope, highestGrade, aps, subjects, results,
}:{
  userId:string;
  institutionType:"university"|"tvet";
  scope:string[];
  highestGrade:string;
  aps:number|null;
  subjects:CourseMatchSubject[];
  results:LoggedProgrammeCheck[];
}) => {
  const runId=crypto.randomUUID();
  const publishedMet=results.filter((r)=>["eligible","published_requirements_met"].includes(r.status)).length;
  const needsConfirmation=results.filter((r)=>["academic_minimum_selection_required","eligible_with_conditional_curriculum_check","official_confirmation_required"].includes(r.status)).length;
  const notMet=results.filter((r)=>r.status.startsWith("not_eligible")||r.status.endsWith("requirement_not_met")).length;
  const {data:profile}=await supabase.from("profiles").select("full_name").eq("id",userId).maybeSingle();
  const {data:marksProfile,error:marksError}=await (supabase as any).from("student_marks_profiles").insert({
    user_id:userId,full_name:profile?.full_name??null,institution_type:institutionType,highest_grade:highestGrade,
    subjects,estimated_aps:aps,readiness_result:"course_match_completed",requires_official_confirmation:true,
    summary:`Programme comparison saved: ${results.length} routes checked, ${publishedMet} published minimum checks met, ${needsConfirmation} need official confirmation, ${notMet} have a published requirement not currently met.`,
    metadata:{source:"applications_hub",run_id:runId,institution_scope:scope,total_results:results.length,published_minimums_met:publishedMet,official_confirmation_required:needsConfirmation,requirements_not_met:notMet},
  }).select("id").single();
  if(marksError) throw marksError;

  const rows=results.map((r)=>({
    user_id:userId,marks_profile_id:marksProfile.id,programme_id:r.programme_id||null,
    programme_requirement_id:r.programme_requirement_id||null,match_status:r.status,student_aps:aps,
    aps_required:r.aps_required??null,subject_match_summary:r.summary??{},missing_requirements:r.missing??[],
    matched_requirements:r.matched??[],source_context:{source:"applications_hub",run_id:runId,...(r.context??{})},
  }));
  for(let i=0;i<rows.length;i+=150){
    const {error}=await (supabase as any).from("student_programme_match_results").insert(rows.slice(i,i+150));
    if(error) throw error;
  }
  return marksProfile.id as string;
};

export const loadMyProgrammeCheckHistory=async(userId:string,limit=6)=>{
  const {data,error}=await (supabase as any).from("student_marks_profiles")
    .select("id,institution_type,highest_grade,estimated_aps,subjects,summary,metadata,created_at")
    .eq("user_id",userId).eq("readiness_result","course_match_completed").order("created_at",{ascending:false}).limit(limit);
  if(error) throw error;
  return data??[];
};
