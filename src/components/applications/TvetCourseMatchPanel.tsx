import { useMemo, useState } from "react";
import { ExternalLink, Loader2, LockKeyhole, Plus, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { estimateAcademicAps, type CourseMatchSubject } from "@/lib/courseMatch";
import { saveProgrammeCheckHistory } from "@/lib/courseMatchHistory";
import { compareTvetPublishedRequirements, type TvetHighestLevel, type TvetRequirementResult } from "@/lib/tvetRequirementCheck";

const INITIAL_SUBJECTS:CourseMatchSubject[]=[
  {name:"English Home Language",mark:0},{name:"Mathematics",mark:0},{name:"Mathematical Literacy",mark:0},
  {name:"Physical Sciences",mark:0},{name:"Accounting",mark:0},{name:"Business Studies",mark:0},
  {name:"Tourism",mark:0},{name:"Economic & Management Sciences",mark:0},{name:"Social Sciences",mark:0},
  {name:"Natural Sciences",mark:0},{name:"Consumer Studies",mark:0},{name:"Hospitality Studies",mark:0},
];
const LEVELS:Array<[TvetHighestLevel,string]>=[
  ["grade9","Grade 9"],["grade10","Grade 10"],["grade11","Grade 11"],["grade12","Grade 12 / NSC"],
  ["ncv4","NC(V) Level 4"],["n4","N4"],["n5","N5"],["n6","N6"],
];
const labelForLevel=(value:TvetHighestLevel)=>LEVELS.find(([key])=>key===value)?.[1]??value;

const TvetCourseMatchPanel=({selectedCollege="all",onSelectedCollegeChange,onSaved}:{selectedCollege?:string;onSelectedCollegeChange?:(slug:string)=>void;onSaved?:()=>void})=>{
  const {user}=useAuth();
  const navigate=useNavigate();
  const [highest,setHighest]=useState<TvetHighestLevel>("grade12");
  const [subjects,setSubjects]=useState<CourseMatchSubject[]>(INITIAL_SUBJECTS);
  const [results,setResults]=useState<TvetRequirementResult[]>([]);
  const [checking,setChecking]=useState(false);
  const [hasChecked,setHasChecked]=useState(false);
  const [filter,setFilter]=useState("all");
  const [query,setQuery]=useState("");
  const usable=useMemo(()=>subjects.filter((s)=>s.name.trim()&&s.mark>0),[subjects]);
  const aps=useMemo(()=>estimateAcademicAps(usable),[usable]);

  const updateSubject=(index:number,patch:Partial<CourseMatchSubject>)=>setSubjects((rows)=>rows.map((row,i)=>i===index?{...row,...patch}:row));
  const signIn=()=>{
    sessionStorage.setItem("reskonnect_tvet_check_draft",JSON.stringify({highest,subjects,selectedCollege}));
    const returnTo=`/apply?category=tvet${selectedCollege!=="all"?`&college=${encodeURIComponent(selectedCollege)}`:""}`;
    navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const runCheck=async()=>{
    if(!user){toast.info("Sign in to calculate your saved APS profile and view personalised programme results.");signIn();return;}
    setChecking(true);
    try{
      let institutionQuery=(supabase as any).from("application_hub_institutions")
        .select("institution_id,slug,display_name,application_url").eq("category","tvet").eq("is_active",true);
      if(selectedCollege!=="all")institutionQuery=institutionQuery.eq("slug",selectedCollege);
      const {data:institutions,error:institutionError}=await institutionQuery.order("sort_order",{ascending:true});
      if(institutionError)throw institutionError;
      const institutionRows=(institutions??[]).filter((row:any)=>row.institution_id);
      const byId=new Map(institutionRows.map((row:any)=>[row.institution_id,row]));
      const {data:programmes,error:programmeError}=await (supabase as any).from("programmes")
        .select("id,institution_id,name,qualification_type,campus,official_url,metadata")
        .eq("is_active",true).in("institution_id",institutionRows.map((row:any)=>row.institution_id));
      if(programmeError)throw programmeError;
      const rank=(status:string)=>status==="published_requirements_met"?1:status==="official_confirmation_required"?2:status==="subject_requirement_not_met"?3:4;
      const checked=(programmes??[]).map((programme:any)=>compareTvetPublishedRequirements(programme,byId.get(programme.institution_id),highest,usable))
        .sort((a:TvetRequirementResult,b:TvetRequirementResult)=>rank(a.requirement_status)-rank(b.requirement_status)||a.institution_name.localeCompare(b.institution_name)||a.programme_name.localeCompare(b.programme_name));
      setResults(checked);setHasChecked(true);setFilter("all");setQuery("");
      try{
        await saveProgrammeCheckHistory({userId:user.id,institutionType:"tvet",scope:selectedCollege==="all"?["TSC","TNC"]:[selectedCollege],highestGrade:labelForLevel(highest),aps:highest==="grade12"?aps:null,subjects:usable,results:checked.map((row:TvetRequirementResult)=>({programme_id:row.programme_id,status:row.requirement_status,summary:row.check_summary,missing:row.missing_requirements,matched:row.matched_requirements,context:{institution_slug:row.institution_slug,institution_name:row.institution_name,programme_name:row.programme_name,qualification_type:row.qualification_type,campus:row.campus,official_url:row.official_url,application_url:row.application_url}}))});
        onSaved?.();
      }catch(logError){console.warn("Programme check history could not be saved",logError);toast.warning("Results are shown, but this check could not be added to your history.");}
      toast.success(`Compared your information with ${checked.length} published TVET programme routes.`);
    }catch(error:any){console.error(error);toast.error(error?.message??"TVET programme comparison could not be completed.");}
    finally{setChecking(false);}
  };

  const filtered=useMemo(()=>results.filter((row)=>{
    if(filter!=="all"&&row.requirement_status!==filter)return false;
    const needle=query.trim().toLowerCase();
    return !needle||`${row.programme_name} ${row.qualification_type} ${row.campus??""} ${row.institution_name}`.toLowerCase().includes(needle);
  }),[results,filter,query]);
  const counts=useMemo(()=>({met:results.filter((r)=>r.requirement_status==="published_requirements_met").length,confirm:results.filter((r)=>r.requirement_status==="official_confirmation_required").length,notMet:results.filter((r)=>r.requirement_status.endsWith("requirement_not_met")).length}),[results]);

  return <section id="tvet-course-match" className="scroll-mt-6 space-y-5">
    <Card className="overflow-hidden">
      <div className="border-b bg-muted/40 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">TVET Course Match</p>
        <h2 className="mt-1 text-xl font-black">Compare your level and subjects with published TSC & TNC requirements</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">TVET matching is not APS-only. It uses the college&apos;s published grade/previous-level and subject requirements. College placement, capacity and the official decision still apply.</p>
      </div>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div><label className="text-xs font-semibold">College</label><select value={selectedCollege} onChange={(e)=>onSelectedCollegeChange?.(e.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="all">Compare TSC + TNC</option><option value="tshwane-south-tvet-college">Tshwane South TVET College</option><option value="tshwane-north-tvet-college">Tshwane North TVET College</option></select></div>
          <div><label className="text-xs font-semibold">Highest completed level</label><select value={highest} onChange={(e)=>setHighest(e.target.value as TvetHighestLevel)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm">{LEVELS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
          <div className="rounded-xl border bg-muted/30 p-3"><p className="text-[11px] text-muted-foreground">Grade 12 APS estimate</p><p className="mt-1 text-2xl font-black">{user&&highest==="grade12"?aps:"—"}</p><p className="text-[10px] text-muted-foreground">{user?highest==="grade12"?"Saved with this check":"APS not used for this level":"Sign in to calculate & save"}</p></div>
        </div>

        <div><div className="flex items-center justify-between gap-3"><div><p className="font-bold">Subjects and marks</p><p className="text-xs text-muted-foreground">Enter only subjects you have taken. Add or rename rows where needed.</p></div><Badge variant="outline">{usable.length} entered</Badge></div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">{subjects.map((subject,index)=><div key={index} className="flex gap-2 rounded-xl border bg-muted/20 p-2"><Input value={subject.name} onChange={(e)=>updateSubject(index,{name:e.target.value})} className="h-9 flex-1 bg-background"/><Input type="number" min={0} max={100} value={subject.mark||""} onChange={(e)=>updateSubject(index,{mark:Math.max(0,Math.min(100,Number(e.target.value)||0))})} placeholder="%" className="h-9 w-20 bg-background"/>{index>=INITIAL_SUBJECTS.length&&<Button variant="ghost" size="icon" className="h-9 w-9" onClick={()=>setSubjects((rows)=>rows.filter((_,i)=>i!==index))}><Trash2 className="h-4 w-4"/></Button>}</div>)}</div>
          <Button variant="outline" size="sm" className="mt-3" onClick={()=>setSubjects((rows)=>[...rows,{name:"",mark:0}])}><Plus className="mr-2 h-4 w-4"/>Add subject</Button>
        </div>

        {!user&&<div className="rounded-2xl border border-primary/30 bg-primary/5 p-4"><div className="flex gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-primary"/><div><p className="font-bold">Sign in to unlock personalised results</p><p className="mt-1 text-xs leading-5 text-muted-foreground">You can prepare your marks here, but APS output and programme-by-programme results are account features so your checks can be saved privately to your profile.</p></div></div></div>}
        <Button size="lg" className="w-full" onClick={runCheck} disabled={checking}>{checking?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:user?<Search className="mr-2 h-4 w-4"/>:<LockKeyhole className="mr-2 h-4 w-4"/>}{checking?"Comparing published requirements…":user?"Check published programme requirements":"Sign in to calculate APS & view results"}</Button>
      </CardContent>
    </Card>

    {user&&hasChecked&&<>
      <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Published minimum checks met</p><p className="mt-1 text-2xl font-black">{counts.met}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Official confirmation needed</p><p className="mt-1 text-2xl font-black">{counts.confirm}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Requirement not currently met</p><p className="mt-1 text-2xl font-black">{counts.notMet}</p></CardContent></Card></div>
      <Card><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search programme or campus…" className="pl-9"/></div><select value={filter} onChange={(e)=>setFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All results</option><option value="published_requirements_met">Published requirements met</option><option value="official_confirmation_required">Official confirmation required</option><option value="subject_requirement_not_met">Subject requirement not met</option><option value="grade_requirement_not_met">Grade/level requirement not met</option></select></div></CardContent></Card>
      <div className="grid gap-3">{filtered.map((row)=>{const positive=row.requirement_status==="published_requirements_met";const confirm=row.requirement_status==="official_confirmation_required";return <Card key={row.programme_id}><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge variant="outline">{row.institution_name}</Badge><Badge variant={positive?"default":"secondary"}>{positive?"Published requirements met":confirm?"Official confirmation required":"Requirement check incomplete"}</Badge></div><h3 className="mt-3 font-bold">{row.programme_name}</h3><p className="mt-1 text-xs text-muted-foreground">{row.qualification_type}{row.campus?` • ${row.campus}`:""}</p>{row.missing_requirements.length>0&&<div className="mt-3 rounded-xl bg-muted/40 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Missing / below published requirement</p>{row.missing_requirements.slice(0,4).map((item,index)=><p key={index} className="mt-1 text-xs">• {item.type==="grade_level"?"Highest completed level":String(item.subject??item.group_key??"Additional requirement")}{item.minimum_percentage?` ${item.minimum_percentage}%+`:""}</p>)}</div>}{row.verification_notes[0]&&<p className="mt-3 text-xs leading-5 text-muted-foreground">{row.verification_notes[0].detail}</p>}</div><div className="flex shrink-0 gap-2">{row.official_url&&<Button variant="outline" size="sm" asChild><a href={row.official_url} target="_blank" rel="noreferrer">Source <ExternalLink className="ml-1.5 h-3.5 w-3.5"/></a></Button>}{row.application_url&&<Button size="sm" asChild><a href={row.application_url} target="_blank" rel="noreferrer">Official application <ExternalLink className="ml-1.5 h-3.5 w-3.5"/></a></Button>}</div></div></CardContent></Card>})}</div>
      <div className="rounded-2xl border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Important:</strong> This is an informational comparison against captured published requirements. It is not an admission decision or offer. TSC/TNC placement assessment, verified documents, capacity, programme selection and the college&apos;s official decision remain authoritative.</div>
    </>}
  </section>;
};

export default TvetCourseMatchPanel;
