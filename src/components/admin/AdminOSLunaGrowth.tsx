import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Brain, CheckCircle2, FileEdit, Link2, Radar, RefreshCw, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Opportunity={
  campus_key:string;campus_name:string;campaign_priority:number;available_spots:number;demand_index:number;
  demand_count:number;website_searches:number;whatsapp_leads:number;applications:number;reason:string;
};
type Overview={
  agents:any[];
  latest_snapshot?:{id:string;academic_year?:number;generated_at:string;summary:string;ranked_opportunities:Opportunity[];source_counts:Record<string,number>;provider:string;model:string;status:string}|null;
  events_24h:number;searches_24h:number;campaign_visits_24h:number;attributed_applications_30d:number;attributed_placements_30d:number;
  growth_campaigns?:{total:number;active:number;draft:number};
};
type SocialSummary={network:string;demand_score:number|string;demand_signal:string;imported_at:string};
const fmt=(v:unknown)=>Number(v||0).toLocaleString("en-ZA");

export default function AdminOSLunaGrowth(){
  const[data,setData]=useState<Overview|null>(null);
  const[social,setSocial]=useState<SocialSummary[]>([]);
  const[manualDrafts,setManualDrafts]=useState(0);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState<"demand"|"content"|null>(null);
  const[academicYear,setAcademicYear]=useState("2026");

  const load=useCallback(async()=>{
    setLoading(true);
    const[overviewR,socialR,postsR]=await Promise.all([
      (supabase as any).rpc("luna_growth_overview"),
      (supabase as any).from("adminos_social_demand_snapshots").select("network,demand_score,demand_signal,imported_at").order("imported_at",{ascending:false}).limit(40),
      (supabase as any).from("adminos_social_posts").select("id",{count:"exact",head:true}).eq("manual_publish_required",true).in("status",["draft","validated"]),
    ]);
    if(overviewR.error)toast.error(overviewR.error.message||"Could not load Luna Growth Intelligence");
    setData((overviewR.data||null) as Overview|null);
    const seen=new Set<string>();const latest:SocialSummary[]=[];
    for(const row of socialR.data||[]){if(seen.has(row.network))continue;seen.add(row.network);latest.push(row);}
    setSocial(latest);setManualDrafts(postsR.count||0);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const runCycle=async(action:"demand_cycle"|"content_cycle")=>{
    setRunning(action==="demand_cycle"?"demand":"content");
    const{data:result,error}=await supabase.functions.invoke("luna-orchestrator",{body:{action,days:30,academic_year:Number(academicYear),source:"adminos_manual"}});
    if(error||result?.error)toast.error(result?.detail||result?.error||error?.message||"Luna cycle failed");
    else if(result?.skipped)toast.info(result?.reason||"Luna correctly skipped this cycle");
    else toast.success(action==="demand_cycle"?`Demand cycle complete · ${result?.ranked_opportunities?.length||0} markets ranked`:`Founder-ready content pack prepared · quality ${result?.quality_score||0}/100`);
    setRunning(null);await load();
  };

  const agents=data?.agents||[];
  const byKey=(key:string)=>agents.find((x:any)=>x.agent_key===key);
  const ranked=data?.latest_snapshot?.ranked_opportunities||[];
  const strongestSocial=useMemo(()=>[...social].sort((a,b)=>Number(b.demand_score||0)-Number(a.demand_score||0))[0],[social]);

  return <section className="min-w-0 space-y-4">
    <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2"><Badge className="rounded-full">Luna AgentOS</Badge><Badge variant="outline" className="rounded-full">RG0–RG5</Badge><Badge variant="outline" className="rounded-full">Metricool ANALYSIS ONLY</Badge><Badge variant="outline" className="rounded-full">Founder posting</Badge></div>
        <h2 className="mt-3 text-2xl font-black tracking-tight">Demand → Intelligence → Founder-Ready Content</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Luna owns company and demand intelligence. Metricool contributes social performance evidence. Luna can prepare platform-specific content, but cannot schedule or publish social posts unless you explicitly change that policy.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={academicYear} onValueChange={setAcademicYear}><SelectTrigger className="w-28"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select>
        <Button variant="outline" onClick={()=>void runCycle("demand_cycle")} disabled={Boolean(running)||loading}><RefreshCw className={`mr-2 h-4 w-4 ${running==="demand"?"animate-spin":""}`}/>Run demand</Button>
        <Button onClick={()=>void runCycle("content_cycle")} disabled={Boolean(running)||loading}><FileEdit className={`mr-2 h-4 w-4 ${running==="content"?"animate-pulse":""}`}/>Prepare content</Button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <GateCard icon={Brain} gate="RG0" title="Luna / Dimpho boundary" ok={Boolean(byKey("luna_core")?.enabled)} text="Luna = website/company intelligence. Dimpho = WhatsApp conversion and service."/>
      <GateCard icon={Link2} gate="RG1" title="Attribution" ok={!loading} text={`${fmt(data?.campaign_visits_24h)} campaign visits · ${fmt(data?.attributed_applications_30d)} attributed applications in 30d.`}/>
      <GateCard icon={Radar} gate="RG2" title="Demand Intelligence" ok={Boolean(byKey("luna_demand")?.enabled&&data?.latest_snapshot)} text={data?.latest_snapshot?`Latest ranked snapshot: ${new Date(data.latest_snapshot.generated_at).toLocaleString("en-ZA")}.`:"Demand snapshot pending."}/>
      <GateCard icon={Sparkles} gate="RG3–4" title="Content + Social Demand" ok={Boolean(byKey("luna_content")?.enabled||byKey("luna_social_demand")?.enabled||social.length)} text={strongestSocial?`Strongest social signal: ${strongestSocial.network} ${Math.round(Number(strongestSocial.demand_score||0))}/100.`:"Waiting for measurable social performance."}/>
      <GateCard icon={Send} gate="RG5" title="Manual Publishing" ok={true} text={`${manualDrafts} founder-ready draft(s). Metricool publishing remains disabled.`}/>
    </div>

    <Card className="overflow-hidden rounded-[26px]"><CardHeader className="pb-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/>Latest Luna demand brief</CardTitle><p className="mt-1 text-xs text-muted-foreground">Year-scoped deterministic ranking; narrative only summarizes verified internal evidence.</p></div>{data?.latest_snapshot&&<Badge variant="outline">{data.latest_snapshot.provider} · {data.latest_snapshot.model}</Badge>}</div></CardHeader><CardContent><p className="text-sm leading-6">{loading?"Loading verified demand intelligence…":data?.latest_snapshot?.summary||"No demand snapshot has been generated yet."}</p>{data?.latest_snapshot?.source_counts&&<div className="mt-4 flex flex-wrap gap-2">{Object.entries(data.latest_snapshot.source_counts).map(([key,value])=><Badge key={key} variant="secondary" className="font-medium">{key.replaceAll("_"," ")}: {fmt(value)}</Badge>)}</div>}</CardContent></Card>

    <div className="grid gap-3 xl:grid-cols-2">
      {ranked.slice(0,8).map((item,index)=><Card key={item.campus_key} className="rounded-[22px]"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Badge variant={item.campaign_priority>=70?"default":"secondary"}>#{index+1}</Badge><p className="font-black">{item.campus_name}</p></div><p className="mt-1 text-xs text-muted-foreground">{item.reason}</p></div><div className="text-right"><p className="text-2xl font-black">{item.campaign_priority}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">priority / 100</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Metric value={item.available_spots} label="reported spots"/><Metric value={item.demand_index} label="demand"/><Metric value={item.website_searches} label="web searches"/><Metric value={item.whatsapp_leads} label="WA leads"/><Metric value={item.applications} label="applications"/></div></CardContent></Card>)}
    </div>

    {!loading&&ranked.length===0&&<div className="rounded-2xl border border-dashed p-6 text-center"><Activity className="mx-auto h-6 w-6 text-muted-foreground"/><p className="mt-2 font-bold">No inventory-backed market is currently eligible for a demand campaign.</p><p className="mt-1 text-xs text-muted-foreground">Luna treats this as a valid no-action state and does not manufacture content demand.</p></div>}
  </section>;
}

function GateCard({icon:Icon,gate,title,ok,text}:{icon:any;gate:string;title:string;ok:boolean;text:string}){return <Card className="rounded-[22px]"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted"><Icon className="h-4 w-4"/></div><Badge variant={ok?"default":"secondary"}>{ok?<CheckCircle2 className="mr-1 h-3 w-3"/>:null}{gate}</Badge></div><p className="mt-4 font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></CardContent></Card>}
function Metric({value,label}:{value:unknown;label:string}){return <div className="rounded-xl bg-muted/55 p-2 text-center"><p className="font-black">{fmt(value)}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>}
