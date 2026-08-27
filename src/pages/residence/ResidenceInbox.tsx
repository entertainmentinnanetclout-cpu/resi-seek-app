import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { ArrowRight, Inbox, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getResidenceApplicationRef, getResidenceApplicationStatusLabel, RESIDENCE_APPLICATION_GROUPS, statusMatchesGroup, type ResidenceApplicationStatusGroup } from "@/lib/residenceApplications";
import SEO from "@/components/SEO";
import type { ResidencePortalContext } from "./ResidenceLayout";

interface ApplicationRow {
  id:string; status:string; funding_type:string|null; created_at:string|null; updated_at:string|null; move_in_date:string|null; notes:string|null; user_id:string|null; institution_type:string|null;
  applicant_name:string|null; student_number:string|null; campus:string|null; course:string|null;
}

const statusGroupFromParam=(value:string|null):ResidenceApplicationStatusGroup=>{
  if(!value) return "all";
  if(RESIDENCE_APPLICATION_GROUPS.some((group)=>group.value===value)) return value as ResidenceApplicationStatusGroup;
  if(value==="submitted") return "new";
  if(value==="conditionally_approved") return "approved";
  if(["rejected","withdrawn"].includes(value)) return "closed";
  return "all";
};

export default function ResidenceInbox(){
  const navigate=useNavigate();
  const {residence}=useOutletContext<ResidencePortalContext>();
  const [searchParams,setSearchParams]=useSearchParams();
  const [applications,setApplications]=useState<ApplicationRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [search,setSearch]=useState("");
  const [statusGroup,setStatusGroup]=useState<ResidenceApplicationStatusGroup>(()=>statusGroupFromParam(searchParams.get("status")));
  const [funding,setFunding]=useState(searchParams.get("funding")||"all");

  const load=useCallback(async()=>{
    if(!residence?.id) return;
    setLoading(true);setError(null);
    const {data,error:loadError}=await (supabase as any).from("residence_portal_applications_safe").select("*").eq("residence_id",residence.id).order("created_at",{ascending:false});
    if(loadError){console.error(loadError);setError("Applications could not be loaded. Please retry.");}
    else setApplications((data||[]) as ApplicationRow[]);
    setLoading(false);
  },[residence?.id]);

  useEffect(()=>{setStatusGroup(statusGroupFromParam(searchParams.get("status")));setFunding(searchParams.get("funding")||"all");},[searchParams]);
  useEffect(()=>{if(!residence?.id)return;void load();const channel=supabase.channel(`residence-inbox-${residence.id}`).on("postgres_changes",{event:"*",schema:"public",table:"applications",filter:`residence_id=eq.${residence.id}`},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel);};},[residence?.id,load]);

  const counts=useMemo(()=>Object.fromEntries(RESIDENCE_APPLICATION_GROUPS.map((group)=>[group.value,applications.filter((app)=>statusMatchesGroup(app.status,group.value)).length])),[applications]);
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return applications.filter((app)=>{if(!statusMatchesGroup(app.status,statusGroup))return false;if(funding!=="all"&&(app.funding_type||"other")!==funding)return false;if(!q)return true;return [app.applicant_name,app.student_number,app.campus,app.course,getResidenceApplicationRef(app.id)].filter(Boolean).join(" ").toLowerCase().includes(q);});},[applications,statusGroup,funding,search]);
  const changeStatus=(value:ResidenceApplicationStatusGroup)=>{const next=new URLSearchParams(searchParams);if(value==="all")next.delete("status");else next.set("status",value);setSearchParams(next,{replace:true});};
  const changeFunding=(value:string)=>{const next=new URLSearchParams(searchParams);if(value==="all")next.delete("funding");else next.set("funding",value);setSearchParams(next,{replace:true});};
  const nextNew=applications.find((app)=>app.status==="submitted");
  if(!residence)return <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Loading your residence...</div>;

  return <><SEO noIndex title={`Applications | ${residence.name} | ResKonnect`} description={`Review accommodation applications for ${residence.name}.`}/><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-primary">{residence.name}</p><h1 className="mt-1 text-3xl font-black tracking-tight">Applications</h1><p className="mt-2 text-sm text-muted-foreground">Review applicants without exposing personal phone numbers or email addresses to residence portal users.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button>{nextNew&&<Button onClick={()=>navigate(`/residence/application/${nextNew.id}`)}>Review next new<ArrowRight className="ml-2 h-4 w-4"/></Button>}</div></div>
    <Card className="border-emerald-500/20 bg-emerald-500/[0.035]"><CardContent className="flex items-start gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"/><div><p className="text-sm font-bold">Privacy-safe applicant view</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Residence staff can see the applicant name, student number, campus, course, funding and application workflow. Direct phone and email details remain protected by ResKonnect.</p></div></CardContent></Card>
    <Card className="border-primary/10 shadow-sm"><CardContent className="space-y-4 p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-[1fr_190px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name, student number, campus, course or application ref" className="pl-10"/></div><Select value={funding} onValueChange={changeFunding}><SelectTrigger><SelectValue placeholder="Funding"/></SelectTrigger><SelectContent><SelectItem value="all">All funding</SelectItem><SelectItem value="nsfas">NSFAS</SelectItem><SelectItem value="bursary">Bursary</SelectItem><SelectItem value="private">Private</SelectItem><SelectItem value="other">Other / unspecified</SelectItem></SelectContent></Select></div><div className="flex gap-2 overflow-x-auto pb-1">{RESIDENCE_APPLICATION_GROUPS.map((group)=><Button key={group.value} size="sm" variant={statusGroup===group.value?"default":"outline"} onClick={()=>changeStatus(group.value)} className="shrink-0">{group.label}<Badge variant={statusGroup===group.value?"secondary":"outline"} className="ml-2">{counts[group.value]||0}</Badge></Button>)}</div></CardContent></Card>
    {error?<Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-7 text-center"><p className="font-semibold text-destructive">{error}</p><Button className="mt-4" variant="outline" onClick={()=>void load()}>Try again</Button></CardContent></Card>:loading?<Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading applications...</CardContent></Card>:filtered.length===0?<Card><CardContent className="py-14 text-center"><Inbox className="mx-auto h-9 w-9 text-muted-foreground"/><p className="mt-3 font-semibold">No matching applications</p><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">{applications.length?"Change the status, funding or search filters to see more applications.":"No student has submitted an application to this accommodation yet. New applications will appear here automatically."}</p></CardContent></Card>:<div className="grid gap-3">{filtered.map((app)=><Card key={app.id} className="cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md" onClick={()=>navigate(`/residence/application/${app.id}`)}><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-5 w-5"/></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold">{app.applicant_name||"Applicant"}</h2><Badge variant={app.status==="rejected"?"destructive":app.status==="approved"?"default":"secondary"}>{getResidenceApplicationStatusLabel(app.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Ref {getResidenceApplicationRef(app.id)} · {app.created_at?new Date(app.created_at).toLocaleDateString("en-ZA"):"Date unavailable"}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{app.student_number&&<span>Student: {app.student_number}</span>}{app.campus&&<span>{app.campus}</span>}{app.course&&<span>{app.course}</span>}</div></div></div><div className="flex flex-wrap items-center gap-2 lg:justify-end">{app.funding_type&&<Badge variant="outline" className="uppercase">{app.funding_type}</Badge>}{app.institution_type&&<Badge variant="outline">{app.institution_type}</Badge>}<Button size="sm" variant="outline" onClick={(e)=>{e.stopPropagation();navigate(`/residence/application/${app.id}`);}}>Open application<ArrowRight className="ml-2 h-3.5 w-3.5"/></Button></div></div></CardContent></Card>)}</div>}
    {!loading&&!error&&filtered.length>0&&<div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground"><span>{filtered.length} of {applications.length} applications shown</span><span className="hidden items-center gap-1 sm:flex"><SlidersHorizontal className="h-4 w-4"/>Filters update instantly</span></div>}
  </div></>;
}