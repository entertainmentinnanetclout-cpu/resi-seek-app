import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Flame, MessageCircle, RefreshCw, Target, ThermometerSun } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Lead={
  id:string;thread_id:string;intent?:string|null;normalized_intent?:string|null;stage:string;campus?:string|null;funding?:string|null;
  academic_year?:number|null;academic_cycle?:string|null;academic_period?:number|null;study_level?:string|null;student_stage?:string|null;
  selected_residence_id?:string|null;next_follow_up_at?:string|null;follow_up_count:number;converted_at?:string|null;updated_at:string;
  contact_id?:string|null;lead_score:number;qualification_band:string;next_best_action?:string|null;next_action_url?:string|null;
};

const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function AdminWhatsAppConversionPipeline(){
  const[rows,setRows]=useState<Lead[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const r=await(supabase as any).from("adminos_whatsapp_conversion_leads").select("*").order("lead_score",{ascending:false}).order("updated_at",{ascending:false}).limit(250);
      if(r.error)throw r.error;
      setRows(r.data||[]);
    }catch(e:any){toast.error(e?.message||"Could not load conversion pipeline");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  const runNow=async()=>{
    setRunning(true);
    const{data,error}=await(supabase as any).rpc("adminos_run_rg6_now");
    setRunning(false);
    if(error)return toast.error(error.message||"RG6 cycle failed");
    toast.success("Dimpho conversion cycle complete · "+Number(data?.scored||0)+" leads rescored");
    await load();
  };

  const stats=useMemo(()=>{
    const now=Date.now();
    return{
      open:rows.filter((r)=>!r.converted_at).length,
      hot:rows.filter((r)=>r.qualification_band==="hot").length,
      warm:rows.filter((r)=>r.qualification_band==="warm").length,
      review:rows.filter((r)=>r.qualification_band==="human_review").length,
      converted:rows.filter((r)=>Boolean(r.converted_at)||r.stage==="converted").length,
      due:rows.filter((r)=>!r.converted_at&&r.next_follow_up_at&&new Date(r.next_follow_up_at).getTime()<=now).length,
      avg:rows.length?Math.round(rows.reduce((s,r)=>s+Number(r.lead_score||0),0)/rows.length):0,
    };
  },[rows]);

  return <Card className="min-w-0 overflow-hidden">
    <CardHeader>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary"/>RG6 · Dimpho Conversion Automation</CardTitle>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Deterministic intent normalization, 0–100 lead scoring, one next-best action, academic-context capture and consent-aware follow-ups. Protected decisions remain human-only.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button>
          <Button className="rounded-full" onClick={()=>void runNow()} disabled={running}><Flame className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG6</Button>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        <Metric value={stats.open} label="Open"/>
        <Metric value={stats.hot} label="Hot"/>
        <Metric value={stats.warm} label="Warm"/>
        <Metric value={stats.review} label="Human review"/>
        <Metric value={stats.converted} label="Converted"/>
        <Metric value={stats.due} label="Follow-ups due"/>
        <Metric value={stats.avg+"/100"} label="Avg lead score"/>
      </div>

      {stats.due>0&&<div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-amber-500/5 p-3 text-xs"><Clock3 className="h-4 w-4"/><strong>{stats.due} eligible follow-up{stats.due===1?"":"s"} due</strong><span className="text-muted-foreground">The scheduler applies customer-window, WhatsApp preference, marketing-consent and DNC rules before sending.</span></div>}

      <div className="space-y-2">
        {rows.slice(0,20).map((r)=><div key={r.id} className="rounded-2xl border p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={r.converted_at?"default":r.qualification_band==="hot"?"default":"secondary"}>{r.converted_at?<><CheckCircle2 className="mr-1 h-3 w-3"/>Converted</>:label(r.stage)}</Badge>
                <Badge variant="outline">{label(r.normalized_intent||r.intent||"general")}</Badge>
                <Badge variant="outline">{label(r.qualification_band||"cold")}</Badge>
              </div>
              <p className="mt-2 text-sm font-black">{r.next_best_action||"Confirm next action"}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{[r.campus,r.academic_year,r.academic_cycle&&r.academic_cycle!=="unspecified"?label(r.academic_cycle):null,r.academic_period?("Period "+r.academic_period):null,r.study_level&&r.study_level!=="unspecified"?label(r.study_level):null,r.funding].filter(Boolean).join(" · ")||"Qualification in progress"}</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs"><span className="font-bold">Lead score</span><span className="font-black">{Number(r.lead_score||0)}/100</span></div>
              <Progress value={Number(r.lead_score||0)} className="h-2"/>
              <p className="mt-1 text-[10px] text-muted-foreground">{r.next_follow_up_at?("Next follow-up "+new Date(r.next_follow_up_at).toLocaleString("en-ZA")):"No follow-up scheduled"}</p>
            </div>
            <Link to={"/admin/communications?tab=desk&thread="+r.thread_id} className="inline-flex items-center gap-1 text-xs font-bold text-primary">Open chat <ArrowRight className="h-3 w-3"/></Link>
          </div>
        </div>)}
      </div>

      {!rows.length&&!loading&&<p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground"><MessageCircle className="mx-auto mb-2 h-5 w-5"/>New WhatsApp enquiries will appear here as Dimpho qualifies them.</p>}
    </CardContent>
  </Card>;
}

function Metric({value,label}:{value:number|string;label:string}){return <div className="min-w-0 rounded-2xl border bg-muted/20 p-3"><ThermometerSun className="h-3.5 w-3.5 text-primary"/><p className="mt-1 text-xl font-black">{typeof value==="number"?value.toLocaleString("en-ZA"):value}</p><p className="mt-1 truncate text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>;}
