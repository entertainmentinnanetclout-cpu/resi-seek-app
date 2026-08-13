import type { CourseMatchSubject } from "@/lib/courseMatch";
import { markForAliases, tncRule, tscRule, type TvetRule } from "@/lib/tvetCourseMatchRules";

export type TvetHighestLevel = "grade9"|"grade10"|"grade11"|"grade12"|"ncv4"|"n4"|"n5"|"n6";
export type TvetRequirementStatus = "published_requirements_met"|"official_confirmation_required"|"grade_requirement_not_met"|"subject_requirement_not_met";
export type TvetProgrammeInput = { id:string; name:string; qualification_type:string|null; campus:string|null; official_url:string|null; metadata:Record<string,any>|null };
export type TvetInstitutionInput = { slug:string; display_name:string; application_url:string|null };
export type TvetRequirementResult = {
  programme_id:string; institution_slug:string; institution_name:string; programme_name:string;
  qualification_type:string; campus:string|null; requirement_status:TvetRequirementStatus;
  check_summary:Record<string,unknown>; missing_requirements:Array<Record<string,unknown>>;
  matched_requirements:Array<Record<string,unknown>>; verification_notes:Array<{label:string;detail:string}>;
  official_url:string|null; application_url:string|null;
};

const fromMetadata = (programme:TvetProgrammeInput):TvetRule|null => {
  const value = programme.metadata?.course_match;
  if (!value || !Array.isArray(value.accepted_levels) || !value.source_url) return null;
  return {
    accepted:value.accepted_levels,
    subjects:Array.isArray(value.subject_rules) ? value.subject_rules.map((item:any)=>({...item,appliesTo:item.applies_to??item.appliesTo})) : [],
    groups:Array.isArray(value.alternative_groups) ? value.alternative_groups.map((item:any)=>({...item,appliesTo:item.applies_to??item.appliesTo})) : [],
    manual:Boolean(value.manual_verification_required), note:value.selection_note||undefined,
    source:String(value.source_url), year:Number(value.source_year)||2026,
  };
};

export const compareTvetPublishedRequirements = (programme:TvetProgrammeInput,institution:TvetInstitutionInput,highest:TvetHighestLevel,subjects:CourseMatchSubject[]):TvetRequirementResult => {
  const req = fromMetadata(programme) ?? (institution.slug === "tshwane-north-tvet-college" ? tncRule(programme.name,programme.qualification_type??"") : tscRule(programme.name,programme.qualification_type??""));
  const missing:Array<Record<string,unknown>>=[];
  const matched:Array<Record<string,unknown>>=[];
  const notes:Array<{label:string;detail:string}>=[];
  let confirmation=Boolean(req.manual);
  const gradePass=req.accepted.includes(highest);
  (gradePass?matched:missing).push({type:"grade_level",label:"Highest completed level",actual:highest,accepted_levels:req.accepted});

  req.subjects.forEach((item)=>{
    if(item.appliesTo?.length&&!item.appliesTo.includes(highest)) return;
    const actual=markForAliases(subjects,item.aliases);
    if(actual==null) missing.push({type:"subject",subject:item.label,minimum_percentage:item.min??null,reason:"subject_not_provided"});
    else if(item.min!=null&&actual<item.min) missing.push({type:"subject",subject:item.label,minimum_percentage:item.min,actual,reason:"mark_below_published_minimum"});
    else { matched.push({type:"subject",subject:item.label,minimum_percentage:item.min??null,actual}); if(item.min==null) confirmation=true; }
  });

  (req.groups??[]).forEach((group)=>{
    if(group.appliesTo?.length&&!group.appliesTo.includes(highest)) return;
    const option=group.options.find((candidate)=>{const actual=markForAliases(subjects,candidate.aliases);return actual!=null&&(candidate.min==null||actual>=candidate.min);});
    if(!option) missing.push({type:"alternative_group",group_key:group.label,reason:"no_published_option_met"});
    else matched.push({type:"alternative_group",group_key:group.label,actual:markForAliases(subjects,option.aliases),minimum_percentage:option.min??null});
  });

  if(req.note) notes.push({label:"Official verification",detail:req.note});
  const subjectMissing=missing.some((item)=>item.type!=="grade_level");
  const status:TvetRequirementStatus=!gradePass?"grade_requirement_not_met":subjectMissing?"subject_requirement_not_met":confirmation?"official_confirmation_required":"published_requirements_met";
  return {programme_id:programme.id,institution_slug:institution.slug,institution_name:institution.display_name,programme_name:programme.name,qualification_type:programme.qualification_type??"TVET programme",campus:programme.campus,requirement_status:status,check_summary:{grade_requirement_met:gradePass,manual_verification_required:Boolean(req.manual),reference_year:req.year},missing_requirements:missing,matched_requirements:matched,verification_notes:notes,official_url:req.source||programme.official_url,application_url:institution.application_url};
};
