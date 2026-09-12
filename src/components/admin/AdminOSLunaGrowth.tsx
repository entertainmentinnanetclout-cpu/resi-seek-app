import { useCallback, useEffect, useState } from "react";
import { Activity, Brain, CheckCircle2, Link2, Radar, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Opportunity={
  campus_key:string;
  campus_name:string;
  campaign_priority:number;
  available_spots:number;
  demand_index:number;
  demand_count:number;
  website_searches:number;
  whatsapp_leads:number;
  applications:number;
  reason:string;
};

type Overview={
  agents:any[];
  latest_snapshot?:{
    id:string;
    generated_at:string;
    summary:string;
    ranked_opportunities:Opportunity[];
    source_counts:Record<string,number>;
    provider:string;
    model:string;
    status:string;
  }|null;
  events_24h:number;
  searches_24h:number;
  campaign_visits_24h:number;
  attributed_applications_30d:number;
  attributed_placements_30d:number;
  growth_campaigns?:{total:number;active:number;draft:number};
};

const fmt=(v:unknown)=>Number(v||0).toLocaleString("en-ZA");

export default function AdminOSLunaGrowth(){
  const[data,setData]=useState<Overview|null>(null);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);
    const {data:overview,error}=await(supabase as any).rpc("luna_growth_overview");
    if(error){toast.error(error.message||"Could not load Luna Growth Intelligence");setLoading(false);return;}
    setData(overview as Overview);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const runCycle=async()=>{
    setRunning(true);
    const {data:result,error}=await supabase.functions.invoke("luna-orchestrator",{body:{action:"demand_cycle",days:30,source:"adminos_manual"}});
    if(error||result?.error)toast.error(result?.detail||result?.error||error?.message||"Demand cycle failed");
    else toast.success(`Luna demand cycle complete · ${result?.ranked_opportunities?.length||0} market signals ranked`);
    setRunning(false);await load();
  };

  const agents=data?.agents||[];
  const lunaCore=agents.find((x:any)=>x.agent_key==="luna_core");
  const lunaDemand=agents.find((x:any)=>x.agent_key==="luna_demand");
  const ranked=data?.latest_snapshot?.ranked_opportunities||[];

  return <section className="min-w-0 space-y-4">
    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge className="rounded-full">Luna AgentOS</Badge><Badge variant="outline" className="rounded-full">RG0–RG2</Badge><Badge variant="outline" className="rounded-full">Publishing OFF</Badge></div><h2 className="mt-3 text-2xl font-black tracking-tight">Autonomous Growth Foundation</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Luna owns website intelligence and demand analysis. Dimpho remains the WhatsApp conversion specialist. Supabase is the source of truth; this release does not create or publish social campaigns yet.</p></div>
      <Button onClick={runCycle} disabled={running||loading} className="shrink-0"><RefreshCw className={`mr-2 h-4 w-4 ${running?"animate-spin":""}`}/>{running?"Running demand cycle…":"Run demand cycle"}</Button>
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <GateCard icon={Brain} gate="RG0" title="Luna / Dimpho split" ok={Boolean(lunaCore?.enabled)} text={lunaCore?.enabled?"Website and in-app intelligence assigned to Luna; Dimpho remains isolated to service/WhatsApp workflows.":"Luna core is disabled."}/>
      <GateCard icon={Link2} gate="RG1" title="Attribution + demand events" ok={!loading} text={`${fmt(data?.events_24h)} demand events · ${fmt(data?.campaign_visits_24h)} campaign visits in 24h · ${fmt(data?.attributed_applications_30d)} attributed applications in 30d.`}/>
      <GateCard icon={Radar} gate="RG2" title="Demand Intelligence" ok={Boolean(lunaDemand?.enabled&&data?.latest_snapshot)} text={data?.latest_snapshot?`Latest verified cycle ${new Date(data.latest_snapshot.generated_at).toLocaleString("en-ZA")}.`:lunaDemand?.enabled?"Luna Demand is enabled; first snapshot is pending.":"Luna Demand is disabled."}/>
    </div>

    <Card className="overflow-hidden rounded-[26px]"><CardHeader className="pb-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/>Latest Luna demand brief</CardTitle><p className="mt-1 text-xs text-muted-foreground">Deterministic ranking; OpenAI narrative refreshes only when the market fingerprint changes or becomes stale.</p></div>{data?.latest_snapshot&&<Badge variant="outline">{data.latest_snapshot.provider} · {data.latest_snapshot.model}</Badge>}</div></CardHeader><CardContent><p className="text-sm leading-6">{loading?"Loading verified demand intelligence…":data?.latest_snapshot?.summary||"No demand snapshot has been generated yet."}</p>{data?.latest_snapshot?.source_counts&&<div className="mt-4 flex flex-wrap gap-2">{Object.entries(data.latest_snapshot.source_counts).map(([key,value])=><Badge key={key} variant="secondary" className="font-medium">{key.replaceAll("_"," ")}: {fmt(value)}</Badge>)}</div>}</CardContent></Card>

    <div className="grid gap-3 xl:grid-cols-2">
      {ranked.slice(0,8).map((item,index)=><Card key={item.campus_key} className="rounded-[22px]"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Badge variant={item.campaign_priority>=70?"default":"secondary"}>#{index+1}</Badge><p className="font-black">{item.campus_name}</p></div><p className="mt-1 text-xs text-muted-foreground">{item.reason}</p></div><div className="text-right"><p className="text-2xl font-black">{item.campaign_priority}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">priority / 100</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Metric value={item.available_spots} label="spots"/><Metric value={item.demand_index} label="demand"/><Metric value={item.website_searches} label="web searches"/><Metric value={item.whatsapp_leads} label="WA leads"/><Metric value={item.applications} label="applications"/></div></CardContent></Card>)}
    </div>

    {!loading&&ranked.length===0&&<div className="rounded-2xl border border-dashed p-6 text-center"><Activity className="mx-auto h-6 w-6 text-muted-foreground"/><p className="mt-2 font-bold">No market with reported available inventory is currently ranked.</p><p className="mt-1 text-xs text-muted-foreground">This is a valid data state, not an AI failure.</p></div>}
  </section>;
}

function GateCard({icon:Icon,gate,title,ok,text}:{icon:any;gate:string;title:string;ok:boolean;text:string}){return <Card className="rounded-[22px]"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted"><Icon className="h-4 w-4"/></div><Badge variant={ok?"default":"secondary"}>{ok?<CheckCircle2 className="mr-1 h-3 w-3"/>:null}{gate}</Badge></div><p className="mt-4 font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></CardContent></Card>}
function Metric({value,label}:{value:unknown;label:string}){return <div className="rounded-xl bg-muted/55 p-2 text-center"><p className="font-black">{fmt(value)}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>}
