import { useEffect, useState } from "react";
import { ExternalLink, GraduationCap, Landmark, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import CourseMatchHistory from "@/components/applications/CourseMatchHistory";
import TvetCourseMatchPanel from "@/components/applications/TvetCourseMatchPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const TvetApplicationsHub=()=>{
  const {user}=useAuth();
  const navigate=useNavigate();
  const [params,setParams]=useSearchParams();
  const [institutions,setInstitutions]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [historyKey,setHistoryKey]=useState(0);
  const selected=params.get("college")||"all";

  useEffect(()=>{
    let active=true;
    (supabase as any).from("application_hub_institutions").select("*").eq("category","tvet").eq("is_active",true).order("sort_order",{ascending:true})
      .then(({data}:any)=>{if(active)setInstitutions(data??[]);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);

  const chooseCollege=(slug:string)=>{
    const next:any={category:"tvet"};
    if(slug!=="all")next.college=slug;
    setParams(next,{replace:true});
    window.setTimeout(()=>document.getElementById("tvet-course-match")?.scrollIntoView({behavior:"smooth",block:"start"}),40);
  };

  return <DashboardLayout>
    <SEO title="Pretoria TVET Applications & Programme Requirements | ResKonnect" description="Compare your school level and subjects with published Tshwane South and Tshwane North TVET programme requirements, save checks to your account and continue to official application routes." keywords="Tshwane South TVET College applications, Tshwane North TVET College applications, Pretoria TVET courses, TSC programmes, TNC programmes"/>
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.10),transparent_34%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.35))]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
        <section className="rounded-3xl border bg-card/90 p-5 shadow-sm sm:p-7 lg:p-9">
          <div className="max-w-3xl"><div className="flex flex-wrap gap-2"><Badge className="rounded-full">Applications • Pretoria</Badge><Badge variant="outline" className="rounded-full">TVET • 2027 planning</Badge></div><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">TVET applications, with the requirements visible before you continue.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Start with TSC or TNC. Signed-in students can save marks, calculate a Grade 12 APS estimate, compare their information with captured published programme requirements and keep a private history of each check.</p></div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          <button onClick={()=>navigate("/apply?category=university")} className="rounded-2xl border bg-card p-4 text-left hover:border-primary/50"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted"><Landmark className="h-5 w-5"/></div><div><p className="font-bold">Universities</p><p className="mt-1 text-xs text-muted-foreground">TUT, UP and UNISA</p></div></div></button>
          <button className="rounded-2xl border border-primary bg-primary/10 p-4 text-left shadow-sm"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5"/></div><div><p className="font-bold">TVET Colleges</p><p className="mt-1 text-xs text-muted-foreground">TSC and TNC programme requirements</p></div></div></button>
          <button onClick={()=>navigate("/apply?category=private")} className="rounded-2xl border bg-card p-4 text-left hover:border-primary/50"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted"><ShieldCheck className="h-5 w-5"/></div><div><p className="font-bold">Private Colleges</p><p className="mt-1 text-xs text-muted-foreground">Verified providers as added</p></div></div></button>
        </section>

        <section className="mt-6 space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pretoria first</p><h2 className="mt-1 text-2xl font-black">Choose a TVET college</h2></div>
          {loading?<div className="grid gap-4 md:grid-cols-2"><div className="h-64 animate-pulse rounded-2xl border bg-card"/><div className="h-64 animate-pulse rounded-2xl border bg-card"/></div>:<div className="grid gap-4 md:grid-cols-2">{institutions.map((institution)=>{const active=selected===institution.slug;const primary=institution.brand_primary??"#17365D";return <Card key={institution.id} className={active?"ring-2 ring-primary":""}><div className="h-24 bg-muted">{institution.logo_url?<div className="flex h-full items-center px-5"><img src={institution.logo_url} alt={`${institution.display_name} logo`} className="h-16 max-w-40 object-contain"/></div>:<div className="flex h-full items-center justify-between px-5 text-white" style={{background:`linear-gradient(120deg,${primary},${institution.brand_secondary??primary})`}}><span className="text-3xl font-black">{institution.short_name}</span><GraduationCap className="h-10 w-10 opacity-30"/></div>}</div><CardContent className="space-y-4 p-5"><div><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{institution.display_name}</h3><Badge variant="outline">Requirements check</Badge></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{institution.description}</p></div><div className="grid gap-2 sm:grid-cols-2"><Button onClick={()=>chooseCollege(institution.slug)}>Check programmes</Button>{institution.application_url&&<Button variant="outline" asChild><a href={institution.application_url} target="_blank" rel="noreferrer">Official application <ExternalLink className="ml-2 h-4 w-4"/></a></Button>}</div></CardContent></Card>;})}</div>}
        </section>

        <div className="mt-6"><TvetCourseMatchPanel selectedCollege={selected} onSelectedCollegeChange={chooseCollege} onSaved={()=>setHistoryKey((key)=>key+1)}/></div>
        {user&&<div className="mt-6"><CourseMatchHistory userId={user.id} refreshKey={historyKey}/></div>}
      </div>
    </div>
  </DashboardLayout>;
};

export default TvetApplicationsHub;
