import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, PlugZap, RefreshCw, ServerCog, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Snapshot={active_crons:number;expected_crons:number;missing_expected_crons:number;agent_runs_24h:number;failed_agent_runs_24h:number;unresolved_agent_errors:number;stuck_agent_runs:number;enabled_integrations:number;unhealthy_enabled_integrations:number;stale_automation_events:number;open_incidents:number;high_incidents:number;platform_health_score:number;snapshot_at:string};
type Incident={id:string;subsystem:string;signal_type:string;severity:string;status:string;current_count:number;auto_fix_supported:boolean;recommended_action:string;evidence:Record<string,any>;last_seen_at:string};
type Expectation={expectation_key:string;expectation_type:string;target_key:string;criticality:string;enabled:boolean;metadata:Record<string,any>};

const label=(v:string)=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
export default function AdminReliabilityAutomation(){
  const[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const[incidents,setIncidents]=useState<Incident[]>([]);
  const[expectations,setExpectations]=useState<Expectation[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const[s,i,e]=await Promise.all([
      (supabase as any).from("adminos_reliability_snapshots").select("*").order("snapshot_at",{ascending:false}).limit(1).maybeSingle(),
      (supabase as any).from("adminos_reliability_incidents").select("*").eq("status","open").order("last_seen_at",{ascending:false}).limit(100),
      (supabase as any).from("adminos_reliability_expectations").select("*").eq("enabled",true).order("criticality",{ascending:false}).limit(100),
    ]);
    if(s.error)console.warn(s.error);if(i.error)toast.error(i.error.message);if(e.error)console.warn(e.error);
    setSnapshot(s.data||null);setIncidents(i.data||[]);setExpectations(e.data||[]);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const run=async()=>{
    setRunning(true);const{data,error}=await(supabase as any).rpc("adminos_run_rg14_now");setRunning(false);
    if(error)return toast.error(error.message||"RG14 cycle failed");
    toast.success(`RG14 complete · platform health ${Number(data?.platform_health_score||0)}/100`);await load();
  };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div>
      <div className="flex flex-wrap gap-2"><Badge>RG14</Badge><Badge variant="outline">Technology & Reliability Agent</Badge><Badge variant="outline">Release-gated remediation</Badge></div>
      <h2 className="mt-3 text-2xl font-black">Reliability Automation</h2>
      <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Monitors critical schedulers, integrations, agent errors, stuck runs and stale automation events. Diagnostics and exception routing are autonomous; production patches, deployments, credential rotation, data deletion and external-service restarts are not.</p>
    </div><div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button><Button onClick={()=>void run()} disabled={running}><Sparkles className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG14</Button></div></div>

    <Card className="rounded-[22px]"><CardContent className="p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Platform reliability score</p><p className="mt-1 text-4xl font-black">{snapshot?.platform_health_score??100}/100</p></div><div className="min-w-[240px] flex-1 md:max-w-xl"><Progress value={snapshot?.platform_health_score??100} className="h-3"/><p className="mt-2 text-xs text-muted-foreground">{snapshot?.open_incidents||0} open incident(s) · {snapshot?.high_incidents||0} high/critical</p></div></div></CardContent></Card>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric icon={ServerCog} label="Active crons" value={snapshot?.active_crons||0}/>
      <Metric icon={ShieldCheck} label="Expected crons" value={snapshot?.expected_crons||0}/>
      <Metric icon={AlertTriangle} label="Missing expected" value={snapshot?.missing_expected_crons||0}/>
      <Metric icon={Activity} label="Agent runs 24h" value={snapshot?.agent_runs_24h||0}/>
      <Metric icon={AlertTriangle} label="Failed runs 24h" value={snapshot?.failed_agent_runs_24h||0}/>
      <Metric icon={AlertTriangle} label="Unresolved errors" value={snapshot?.unresolved_agent_errors||0}/>
      <Metric icon={PlugZap} label="Bad integrations" value={snapshot?.unhealthy_enabled_integrations||0}/>
      <Metric icon={Activity} label="Stale events" value={snapshot?.stale_automation_events||0}/>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="rounded-[22px]"><CardHeader><CardTitle>Reliability incidents</CardTitle></CardHeader><CardContent className="space-y-3">
        {incidents.length===0?<Empty text="No active RG14 reliability incidents."/>:incidents.map(i=><div key={i.id} className="rounded-2xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><Badge variant={i.severity==="critical"?"destructive":"outline"}>{label(i.severity)}</Badge><Badge variant="secondary">{label(i.subsystem)}</Badge><Badge variant="outline">{label(i.signal_type)}</Badge></div><strong>{i.current_count}</strong></div>
          <p className="mt-3 text-sm font-semibold">{i.recommended_action}</p><p className="mt-2 text-[11px] text-muted-foreground">Auto-fix: {i.auto_fix_supported?"supported":"disabled"} · last observed {new Date(i.last_seen_at).toLocaleString("en-ZA")}</p>
        </div>)}
      </CardContent></Card>
      <Card className="rounded-[22px]"><CardHeader><CardTitle>Reliability expectations</CardTitle></CardHeader><CardContent className="space-y-2">
        {expectations.map(e=><div key={e.expectation_key} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-bold">{e.target_key}</p><p className="text-[10px] text-muted-foreground">{label(e.expectation_type)} · {String(e.metadata?.purpose||"required system")}</p></div><Badge variant={e.criticality==="critical"?"default":"outline"}>{label(e.criticality)}</Badge></div>)}
      </CardContent></Card>
    </div>
  </div>;
}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-5 w-5"/>{text}</div>;}
