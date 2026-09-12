import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ExternalLink, Gauge, RefreshCw, Search, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Snapshot={indexable_pages:number;citation_ready_pages:number;avg_quality_score:number;impressions_28d:number;clicks_28d:number;ctr_28d:number;avg_position_28d:number|null;pending_index_urls:number;stale_index_urls:number;open_growth_signals:number;high_priority_signals:number;generated_at:string};
type Signal={id:string;signal_type:string;path:string|null;priority:number;opportunity_score:number;status:string;automation_state:string;recommended_action:string;evidence:Record<string,any>;last_seen_at:string};
type Integration={status:string;enabled:boolean;setup_step:number;setup_url:string|null;docs_url:string|null;last_success_at:string|null;last_error:string|null;config:Record<string,any>};

const label=(v:string)=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
export default function AdminSeoAeoAutomation(){
  const[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const[signals,setSignals]=useState<Signal[]>([]);
  const[integration,setIntegration]=useState<Integration|null>(null);
  const[queue,setQueue]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const[snapR,signalsR,intR,queueR]=await Promise.all([
      (supabase as any).from("adminos_seo_growth_snapshots").select("*").order("generated_at",{ascending:false}).limit(1).maybeSingle(),
      (supabase as any).from("adminos_seo_growth_signals").select("*").eq("status","open").order("priority",{ascending:false}).order("opportunity_score",{ascending:false}).limit(100),
      (supabase as any).from("adminos_integration_connections").select("status,enabled,setup_step,setup_url,docs_url,last_success_at,last_error,config").eq("provider","google_search_console").maybeSingle(),
      (supabase as any).from("seo_index_queue").select("status").in("status",["pending","processing","failed"]).limit(500),
    ]);
    if(snapR.error)console.warn(snapR.error);if(signalsR.error)toast.error(signalsR.error.message);if(intR.error)console.warn(intR.error);
    setSnapshot(snapR.data||null);setSignals(signalsR.data||[]);setIntegration(intR.data||null);setQueue(queueR.data||[]);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const run=async()=>{
    setRunning(true);
    const{data,error}=await(supabase as any).rpc("adminos_run_rg12_now");
    setRunning(false);
    if(error)return toast.error(error.message||"RG12 cycle failed");
    toast.success(`RG12 complete · ${Number(data?.open_signals||0)} open signal(s)`);
    await load();
  };

  const queueCounts=useMemo(()=>queue.reduce((m:any,r:any)=>(m[r.status]=(m[r.status]||0)+1,m),{}),[queue]);
  const gscReady=integration?.status==="connected"&&integration.enabled;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="flex flex-wrap gap-2"><Badge>RG12</Badge><Badge variant="outline">SEO & AEO Growth Agent</Badge><Badge variant="outline">Mechanical indexing autonomous</Badge></div>
      <h2 className="mt-3 text-2xl font-black">Continuous Search Growth Automation</h2>
      <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Runs safe metadata hygiene, IndexNow freshness, Search Console measurement and query/page opportunity scoring. It does not invent market-superlative claims or autonomously rewrite/publish factual public content.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button><Button onClick={()=>void run()} disabled={running}><Sparkles className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG12</Button></div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric icon={Search} label="Indexable pages" value={snapshot?.indexable_pages||0}/>
      <Metric icon={Bot} label="AI citation ready" value={snapshot?.citation_ready_pages||0}/>
      <Metric icon={Gauge} label="Avg quality" value={Math.round(Number(snapshot?.avg_quality_score||0))}/>
      <Metric icon={Search} label="28d impressions" value={snapshot?.impressions_28d||0}/>
      <Metric icon={Send} label="28d clicks" value={snapshot?.clicks_28d||0}/>
      <Metric icon={AlertTriangle} label="Open signals" value={snapshot?.open_growth_signals||signals.length}/>
      <Metric icon={AlertTriangle} label="High priority" value={snapshot?.high_priority_signals||signals.filter(x=>x.priority>=80).length}/>
      <Metric icon={CheckCircle2} label="Index queue pending" value={(queueCounts.pending||0)+(queueCounts.processing||0)}/>
    </div>

    <Card className="rounded-[22px]"><CardHeader><CardTitle>Google Search Console · read-only demand intelligence</CardTitle></CardHeader><CardContent>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div>
        <div className="flex flex-wrap gap-2"><Badge variant={gscReady?"default":"outline"}>{gscReady?"CONNECTED":label(integration?.status||"not connected")}</Badge><Badge variant="outline">Step {integration?.setup_step||1}/3</Badge><Badge variant="outline">{String(integration?.config?.site_url||"sc-domain:reskonnect.org")}</Badge></div>
        <p className="mt-3 text-sm">{gscReady?"Search query/page metrics are feeding Luna's RG12 opportunity model.":"The connector and daily sync are deployed. A Google Search Console service-account credential must be added to Supabase before first-party Google query metrics can sync."}</p>
        {integration?.last_error&&<p className="mt-2 text-xs text-muted-foreground">Current connector state: {integration.last_error}</p>}
      </div>{integration?.setup_url&&<Button variant="outline" asChild><a href={integration.setup_url} target="_blank" rel="noreferrer">Open Search Console <ExternalLink className="ml-2 h-4 w-4"/></a></Button>}</div>
    </CardContent></Card>

    <Card className="rounded-[22px]"><CardHeader><CardTitle>Search growth exceptions</CardTitle></CardHeader><CardContent className="space-y-3">
      {signals.length===0?<Empty text="No current SEO/AEO exceptions. Indexing and quality controls are healthy."/>:signals.map(s=><div key={s.id} className="rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><Badge variant={s.priority>=90?"destructive":"outline"}>{label(s.signal_type)}</Badge><Badge variant="secondary">{label(s.automation_state)}</Badge>{s.path&&<Badge variant="outline">{s.path}</Badge>}</div><strong>{s.priority}/100</strong></div>
        <p className="mt-3 text-sm font-semibold">{s.recommended_action}</p><p className="mt-2 text-xs text-muted-foreground">Opportunity score {s.opportunity_score}/100 · last observed {new Date(s.last_seen_at).toLocaleString("en-ZA")}</p>
      </div>)}
    </CardContent></Card>
  </div>;
}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">{text}</div>;}
