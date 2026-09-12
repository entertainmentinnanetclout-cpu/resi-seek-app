import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileWarning, Gauge, RefreshCw, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Signal={
  id:string;source_type:string;category:string;sentiment:string;severity:number;status:string;summary:string;
  public_risk:boolean;requires_executive_approval:boolean;first_seen_at:string;last_seen_at:string;
};
type Brief={
  id:string;brief_key:string;brief_type:string;risk_level:string;headline:string;summary:string;signal_count:number;
  recommended_action:string;public_statement_recommended:boolean;requires_executive_approval:boolean;status:string;generated_at:string;
};
type Draft={
  id:string;brief_id:string|null;draft_key:string;draft_type:string;title:string;body:string;risk_level:string;
  intended_audience:string;manual_publish_required:boolean;requires_executive_approval:boolean;approval_status:string;status:string;updated_at:string;
};

const label=(value:string)=>String(value||"").replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function AdminCorporateAffairsAutomation(){
  const[signals,setSignals]=useState<Signal[]>([]);
  const[briefs,setBriefs]=useState<Brief[]>([]);
  const[drafts,setDrafts]=useState<Draft[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);
  const[working,setWorking]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const[s,b,d]=await Promise.all([
      (supabase as any).from("adminos_reputation_signals").select("*").order("severity",{ascending:false}).order("last_seen_at",{ascending:false}).limit(250),
      (supabase as any).from("adminos_corporate_affairs_briefs").select("*").order("generated_at",{ascending:false}).limit(100),
      (supabase as any).from("adminos_corporate_affairs_drafts").select("*").order("updated_at",{ascending:false}).limit(100),
    ]);
    if(s.error)toast.error(s.error.message||"Could not load reputation signals");
    if(b.error)toast.error(b.error.message||"Could not load Corporate Affairs briefs");
    if(d.error)toast.error(d.error.message||"Could not load PR drafts");
    setSignals(s.data||[]);setBriefs(b.data||[]);setDrafts(d.data||[]);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const runNow=async()=>{
    setRunning(true);
    const{data,error}=await(supabase as any).rpc("adminos_run_rg11_now");
    setRunning(false);
    if(error)return toast.error(error.message||"RG11 cycle failed");
    toast.success("Reputation cycle complete · "+Number(data?.signals_refreshed||0)+" signals refreshed");
    await load();
  };

  const approve=async(id:string,approved:boolean)=>{
    setWorking(id);
    const{error}=await(supabase as any).rpc("adminos_approve_corporate_affairs_draft",{p_id:id,p_approve:approved});
    setWorking(null);
    if(error)return toast.error(error.message||"Executive approval could not be applied");
    toast.success(approved?"Draft approved for manual publishing workflow":"Draft rejected");
    await load();
  };

  const stats=useMemo(()=>({
    signals:signals.length,
    open:signals.filter((x)=>x.status==="open").length,
    critical:signals.filter((x)=>x.status==="open"&&x.severity>=90).length,
    negative:signals.filter((x)=>x.sentiment==="negative").length,
    risks:signals.filter((x)=>x.public_risk&&x.status!=="resolved").length,
    briefs:briefs.filter((x)=>x.status==="open").length,
    red:briefs.filter((x)=>x.status==="open"&&x.risk_level==="red").length,
    pending:drafts.filter((x)=>x.approval_status==="pending").length,
  }),[signals,briefs,drafts]);

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap gap-2"><Badge>RG11</Badge><Badge variant="outline">Corporate Affairs & Reputation Agent</Badge><Badge variant="outline">Manual publishing only</Badge></div>
        <h2 className="mt-3 text-2xl font-black">Reputation & Corporate Affairs Automation</h2>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Converts first-party service failures, customer feedback, complaints and reviews into evidence-based reputation signals, internal briefs and approval-gated response drafts. It does not infer external social sentiment from engagement counts and cannot publish statements.</p>
      </div>
      <div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button><Button onClick={()=>void runNow()} disabled={running}><Sparkles className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG11</Button></div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric icon={Gauge} label="Signals" value={stats.signals}/>
      <Metric icon={AlertTriangle} label="Open signals" value={stats.open}/>
      <Metric icon={ShieldAlert} label="Critical open" value={stats.critical}/>
      <Metric icon={FileWarning} label="Negative feedback" value={stats.negative}/>
      <Metric icon={AlertTriangle} label="Public-risk signals" value={stats.risks}/>
      <Metric icon={ShieldCheck} label="Open briefs" value={stats.briefs}/>
      <Metric icon={ShieldAlert} label="Red briefs" value={stats.red}/>
      <Metric icon={FileWarning} label="Drafts pending" value={stats.pending}/>
    </div>

    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <Card className="rounded-[22px]"><CardHeader><CardTitle>Corporate Affairs briefs</CardTitle></CardHeader><CardContent className="space-y-3">
        {briefs.length===0?<Empty text="No reputation briefs generated."/>:briefs.map((brief)=><div key={brief.id} className="rounded-2xl border p-4">
          <div className="flex flex-wrap items-center gap-2"><Badge variant={brief.risk_level==="red"?"destructive":brief.risk_level==="amber"?"default":"secondary"}>{label(brief.risk_level)}</Badge><Badge variant="outline">{label(brief.brief_type)}</Badge><Badge variant="secondary">{brief.signal_count} signal(s)</Badge>{brief.public_statement_recommended&&<Badge variant="outline">Statement may be needed</Badge>}</div>
          <p className="mt-3 font-black">{brief.headline}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{brief.summary}</p>
          <div className="mt-3 rounded-xl bg-muted/40 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Recommended action</p><p className="mt-1 text-xs">{brief.recommended_action}</p></div>
        </div>)}
      </CardContent></Card>

      <Card className="rounded-[22px]"><CardHeader><CardTitle>Reputation signal radar</CardTitle></CardHeader><CardContent className="space-y-2">
        {signals.length===0?<Empty text="No reputation signals."/>:signals.slice(0,80).map((signal)=><div key={signal.id} className="grid gap-3 rounded-2xl border p-3 md:grid-cols-[minmax(0,1fr)_120px] md:items-center">
          <div><div className="flex flex-wrap gap-2"><Badge variant={signal.severity>=90?"destructive":"outline"}>{label(signal.category)}</Badge><Badge variant="secondary">{label(signal.source_type)}</Badge>{signal.public_risk&&<Badge variant="outline">Public risk</Badge>}</div><p className="mt-2 text-xs font-semibold">{signal.summary}</p><p className="mt-1 text-[10px] text-muted-foreground">{label(signal.sentiment)} · {label(signal.status)} · last seen {new Date(signal.last_seen_at).toLocaleString("en-ZA")}</p></div>
          <div className="rounded-xl bg-muted/40 p-3 text-center"><p className="text-2xl font-black">{signal.severity}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">severity / 100</p></div>
        </div>)}
      </CardContent></Card>
    </div>

    <Card className="rounded-[22px]"><CardHeader><CardTitle>Approval-gated public response drafts</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="rounded-2xl border bg-muted/30 p-3 text-xs text-muted-foreground"><strong className="text-foreground">Control:</strong> approval only marks a draft ready for the manual publishing workflow. RG11 never posts to social media, activates a public notice, or makes a legal/institutional commitment on its own.</div>
      {drafts.length===0?<Empty text="No public-response drafts are required right now."/>:drafts.map((draft)=><div key={draft.id} className="rounded-2xl border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge variant={draft.risk_level==="red"?"destructive":"outline"}>{label(draft.risk_level)}</Badge><Badge variant="secondary">{label(draft.approval_status)}</Badge><Badge variant="outline">{label(draft.draft_type)}</Badge><Badge variant="outline">Manual publish</Badge></div><p className="mt-3 font-black">{draft.title}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{draft.body}</p></div>
          {draft.approval_status==="pending"&&<div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={()=>void approve(draft.id,false)} disabled={working===draft.id}>Reject</Button><Button size="sm" onClick={()=>void approve(draft.id,true)} disabled={working===draft.id}><ShieldCheck className="mr-2 h-4 w-4"/>Executive approve</Button></div>}
        </div>
      </div>)}
    </CardContent></Card>
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number|string}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{typeof value==="number"?value.toLocaleString("en-ZA"):value}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-5 w-5"/>{text}</div>;}
