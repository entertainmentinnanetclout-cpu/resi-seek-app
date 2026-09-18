import { useCallback, useEffect, useState } from "react";
import { Activity, BrainCircuit, Database, RefreshCw, Route, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const fmt=(n:any)=>new Intl.NumberFormat().format(Number(n||0));
const date=(v:any)=>v?new Date(v).toLocaleString():"—";

export default function ResKonnectBrainControl(){
  const [loading,setLoading]=useState(true);
  const [healthBusy,setHealthBusy]=useState(false);
  const [data,setData]=useState<any>(null);
  const [health,setHealth]=useState<any>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const r=await (supabase as any).rpc("rk_brain_overview");
      if(r.error)throw r.error;
      setData(r.data||null);
    }catch(error:any){
      console.error("[ResKonnectBrainControl] load failed",error);
      toast.error(error?.message||"Could not load ResKonnect Brain");
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  const verify=async()=>{
    setHealthBusy(true);
    try{
      const r=await (supabase.functions as any).invoke("reskonnect-brain",{body:{action:"health",agent_key:"luna"}});
      if(r.error)throw r.error;
      setHealth(r.data);
      toast[r.data?.ok?"success":"error"](r.data?.ok?"ResKonnect Brain is healthy":"ResKonnect Brain needs attention");
    }catch(error:any){toast.error(error?.message||"Brain health check failed");}
    finally{setHealthBusy(false);}
  };

  if(loading&&!data)return <div className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin"/>Loading shared intelligence…</div>;

  const agents=Array.isArray(data?.agents)?data.agents:[];
  const intents=Array.isArray(data?.top_intents)?data.top_intents:[];
  const channels=Array.isArray(data?.channels)?data.channels:[];

  return <div className="space-y-4">
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2"><Badge>ResKonnect Brain</Badge><Badge variant="outline">Release {data?.release||1}</Badge><Badge variant={data?.enabled?"default":"destructive"}>{data?.enabled?"Active":"Disabled"}</Badge></div>
          <CardTitle className="mt-3 flex items-center gap-2"><BrainCircuit className="h-5 w-5"/>One intelligence layer, multiple agents</CardTitle>
          <CardDescription className="mt-2 max-w-3xl">Luna, Dimpho, email, voice, AdminOS and future Meta agents now share customer memory, verified knowledge, intent history and governed tools while keeping their own channel identities.</CardDescription>
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button><Button onClick={verify} disabled={healthBusy}><Activity className="mr-2 h-4 w-4"/>{healthBusy?"Checking…":"Health check"}</Button></div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={Users} label="Known customers" value={fmt(data?.known_customers)}/>
          <Metric icon={Database} label="Shared memories" value={fmt(data?.memory_count)}/>
          <Metric icon={Activity} label="Interactions · 24h" value={fmt(data?.interactions_24h)}/>
          <Metric icon={Route} label="Escalations · 24h" value={fmt(data?.escalations_24h)}/>
          <Metric icon={BrainCircuit} label="Knowledge docs" value={fmt(data?.knowledge_documents)}/>
        </div>
        {health&&<div className="mt-4 rounded-2xl border bg-muted/30 p-4 text-sm"><b>Runtime:</b> {health.ok?"Healthy":"Needs attention"} · Provider {health.provider_openai?"OpenAI":health.provider_fallback?"Fallback":"Unavailable"} · {fmt(health.intents)} intents · {fmt(health.knowledge_documents)} knowledge documents.</div>}
      </CardContent>
    </Card>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Agent surfaces</CardTitle><CardDescription>Different personalities, one stored ResKonnect intelligence layer.</CardDescription></CardHeader><CardContent className="space-y-2">{agents.map((a:any)=><div key={a.agent_key} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{a.display_name}</p><p className="text-xs text-muted-foreground">{a.channel} · {a.model} · {a.tools} tools</p></div><Badge variant={a.enabled?"default":"secondary"}>{a.enabled?"Live":"Off"}</Badge></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Intent intelligence</CardTitle><CardDescription>Seeded from existing ResKonnect customer intent and continuously updated by every Brain interaction.</CardDescription></CardHeader><CardContent className="space-y-2">{intents.length?intents.map((x:any)=><div key={x.intent_key} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{x.label}</p><p className="text-xs text-muted-foreground">Last seen {date(x.last_seen_at)}</p></div><Badge variant="outline">{fmt(x.observed_count)}</Badge></div>):<p className="text-sm text-muted-foreground">No intent observations yet.</p>}</CardContent></Card>
    </div>

    {channels.length>0&&<Card><CardHeader><CardTitle className="text-base">Cross-channel activity</CardTitle><CardDescription>The Brain stores channel-specific interaction telemetry while keeping customer memory shared.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{channels.map((c:any)=><div key={c.channel} className="rounded-xl border p-3"><p className="text-sm font-bold">{c.channel}</p><p className="mt-1 text-2xl font-black">{fmt(c.interactions)}</p><p className="text-xs text-muted-foreground">Last {date(c.last_seen_at)}</p></div>)}</CardContent></Card>}
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-2xl border p-4"><Icon className="h-4 w-4 text-muted-foreground"/><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>;}
