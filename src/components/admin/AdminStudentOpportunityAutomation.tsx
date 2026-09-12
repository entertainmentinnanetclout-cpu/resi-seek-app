import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, GraduationCap, RefreshCw, SearchCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CaseRow={
  id:string;source_type:string;source_id:string;case_type:string;institution:string|null;campus:string|null;programme:string|null;
  source_status:string;readiness_score:number;readiness_band:string;next_best_action:string|null;priority:number;
  automation_state:string;stale_days:number;calculated_at:string;
};
type CatalogRow={
  id:string;source_type:string;source_id:string;title:string;provider:string|null;public_state:string;health_state:string;
  quality_score:number;deadline:string|null;last_verified_at:string|null;recommended_action:string|null;auto_hygiene_applied:boolean;
};
type MatchRow={
  id:string;user_id:string;opportunity_source_type:string;opportunity_source_id:string;match_score:number;match_band:string;
  rationale:string;requires_official_confirmation:boolean;status:string;expires_at:string|null;metadata:Record<string,any>;
};

const label=(value:string)=>String(value||"").replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function AdminStudentOpportunityAutomation(){
  const[cases,setCases]=useState<CaseRow[]>([]);
  const[catalog,setCatalog]=useState<CatalogRow[]>([]);
  const[matches,setMatches]=useState<MatchRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const[c,h,m]=await Promise.all([
      (supabase as any).from("adminos_student_opportunity_cases").select("*").order("priority",{ascending:false}).order("calculated_at",{ascending:false}).limit(300),
      (supabase as any).from("adminos_opportunity_catalog_health").select("*").order("health_state",{ascending:true}).order("deadline",{ascending:true}).limit(300),
      (supabase as any).from("adminos_student_opportunity_matches").select("*").in("status",["suggested","interested","applied"]).order("match_score",{ascending:false}).limit(300),
    ]);
    if(c.error)toast.error(c.error.message||"Could not load RG9 student cases");
    if(h.error)toast.error(h.error.message||"Could not load opportunity catalog health");
    if(m.error)toast.error(m.error.message||"Could not load potential opportunity matches");
    setCases(c.data||[]);setCatalog(h.data||[]);setMatches(m.data||[]);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const runNow=async()=>{
    setRunning(true);
    const{data,error}=await(supabase as any).rpc("adminos_run_rg9_now");
    setRunning(false);
    if(error)return toast.error(error.message||"RG9 cycle failed");
    toast.success("Student Opportunities cycle complete · "+Number(data?.wil_cases||0)+" WIL + "+Number(data?.application_support_cases||0)+" service cases");
    await load();
  };

  const stats=useMemo(()=>({
    cases:cases.length,
    staff:cases.filter((x)=>x.automation_state==="staff_attention").length,
    ready:cases.filter((x)=>x.readiness_band==="ready").length,
    stale:cases.filter((x)=>Number(x.stale_days||0)>=7).length,
    catalog:catalog.length,
    catalogAttention:catalog.filter((x)=>["needs_verification","incomplete","closing_soon"].includes(x.health_state)).length,
    expired:catalog.filter((x)=>x.health_state==="expired").length,
    matches:matches.length,
  }),[cases,catalog,matches]);

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap gap-2"><Badge>RG9</Badge><Badge variant="outline">Student Opportunities Agent</Badge><Badge variant="outline">Official confirmation required</Badge></div>
        <h2 className="mt-3 text-2xl font-black">Student Opportunity Automation</h2>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Unifies WIL and application-support readiness, keeps bursary/opportunity catalogs from presenting expired items as current, and surfaces potential matches without claiming eligibility, admission, funding or placement.</p>
      </div>
      <div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button><Button onClick={()=>void runNow()} disabled={running}><Sparkles className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG9</Button></div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric icon={GraduationCap} label="Unified cases" value={stats.cases}/>
      <Metric icon={AlertTriangle} label="Staff attention" value={stats.staff}/>
      <Metric icon={ShieldCheck} label="Ready cases" value={stats.ready}/>
      <Metric icon={AlertTriangle} label="Stale cases" value={stats.stale}/>
      <Metric icon={SearchCheck} label="Catalog records" value={stats.catalog}/>
      <Metric icon={AlertTriangle} label="Catalog attention" value={stats.catalogAttention}/>
      <Metric icon={AlertTriangle} label="Expired catalog" value={stats.expired}/>
      <Metric icon={BriefcaseBusiness} label="Potential matches" value={stats.matches}/>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="rounded-[22px]"><CardHeader><CardTitle>Student-service cases</CardTitle></CardHeader><CardContent className="space-y-3">
        {cases.length===0?<Empty text="No Student Services cases yet."/>:cases.slice(0,40).map((row)=><div key={row.id} className="rounded-2xl border p-4">
          <div className="flex flex-wrap items-center gap-2"><Badge>{label(row.case_type)}</Badge><Badge variant="outline">{label(row.source_status)}</Badge><Badge variant={row.automation_state==="staff_attention"?"destructive":"secondary"}>{label(row.automation_state)}</Badge></div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_170px] md:items-center"><div><p className="font-black">{row.programme||row.institution||"Student service case"}</p><p className="mt-1 text-xs text-muted-foreground">{[row.institution,row.campus,row.stale_days?("stale "+row.stale_days+" day(s)"):null].filter(Boolean).join(" · ")}</p><p className="mt-2 text-xs font-semibold">{row.next_best_action||"Review next step"}</p></div><div><div className="mb-1 flex justify-between text-xs"><span>Readiness</span><strong>{row.readiness_score}/100</strong></div><Progress value={row.readiness_score} className="h-2"/></div></div>
        </div>)}
      </CardContent></Card>

      <Card className="rounded-[22px]"><CardHeader><CardTitle>Catalog integrity</CardTitle></CardHeader><CardContent className="space-y-3">
        {catalog.length===0?<Empty text="No bursary or public-opportunity catalog records."/>:catalog.slice(0,50).map((row)=><div key={row.id} className="rounded-2xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black">{row.title}</p><p className="text-[11px] text-muted-foreground">{row.provider||label(row.source_type)}</p></div><div className="flex gap-1"><Badge variant={row.health_state==="expired"?"destructive":row.health_state==="ready"?"default":"outline"}>{label(row.health_state)}</Badge><Badge variant="secondary">{row.quality_score}/100</Badge></div></div>
          <p className="mt-2 text-xs text-muted-foreground">{row.recommended_action||"Continue monitoring."}</p>
          {row.auto_hygiene_applied&&<p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-primary">Automatic public hygiene applied</p>}
        </div>)}
      </CardContent></Card>
    </div>

    <Card className="rounded-[22px]"><CardHeader><CardTitle>Potential opportunity matches</CardTitle></CardHeader><CardContent>
      <div className="mb-4 rounded-2xl border bg-muted/30 p-3 text-xs text-muted-foreground"><strong className="text-foreground">Governance:</strong> a match means only that ResKonnect detected possible textual/context fit. It never means the student is eligible, admitted, funded, shortlisted or placed. Official provider/institution rules always control.</div>
      {matches.length===0?<Empty text="No verified current opportunities are available to match right now."/>:<div className="grid gap-3 lg:grid-cols-2">{matches.slice(0,40).map((row)=><div key={row.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-2"><Badge>{label(row.match_band)}</Badge><strong>{row.match_score}/100</strong></div><p className="mt-2 text-sm font-bold">{row.metadata?.provider||row.metadata?.organisation||label(row.opportunity_source_type)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{row.rationale}</p><Badge variant="outline" className="mt-3">Official confirmation required</Badge></div>)}</div>}
    </CardContent></Card>
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number|string}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{typeof value==="number"?value.toLocaleString("en-ZA"):value}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">{text}</div>;}
