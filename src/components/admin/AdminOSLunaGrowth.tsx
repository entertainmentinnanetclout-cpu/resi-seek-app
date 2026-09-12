import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Brain, CheckCircle2, Clipboard, Link2, Radar, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Opportunity={campus_key:string;campus_name:string;campaign_priority:number;available_spots:number;demand_index:number;demand_count:number;website_searches:number;whatsapp_leads:number;applications:number;reason:string;};
type SocialDemand={id:string;network:string;period_start:string;period_end:string;demand_score:number;demand_signal:string;metrics:Record<string,number>;best_times:any[];source:string;imported_at:string;};
type ManualPost={id:string;network:string;status:string;title:string|null;caption:string|null;payload:any;recommended_publish_at:string|null;manual_publish_required:boolean;posting_notes:string|null;created_at:string;};
type Overview={agents:any[];latest_snapshot?:{id:string;generated_at:string;summary:string;ranked_opportunities:Opportunity[];source_counts:Record<string,number>;provider:string;model:string;status:string;}|null;events_24h:number;searches_24h:number;campaign_visits_24h:number;attributed_applications_30d:number;attributed_placements_30d:number;growth_campaigns?:{total:number;active:number;draft:number};};

const fmt=(v:unknown)=>Number(v||0).toLocaleString("en-ZA");
const titleCase=(v:string)=>v.replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function AdminOSLunaGrowth(){
  const[data,setData]=useState<Overview|null>(null);
  const[social,setSocial]=useState<SocialDemand[]>([]);
  const[manualPosts,setManualPosts]=useState<ManualPost[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);
  const[contentRunning,setContentRunning]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const [overviewR,socialR,postsR]=await Promise.all([
      (supabase as any).rpc("luna_growth_overview"),
      (supabase as any).from("adminos_social_demand_snapshots").select("id,network,period_start,period_end,demand_score,demand_signal,metrics,best_times,source,imported_at").order("imported_at",{ascending:false}).limit(40),
      (supabase as any).from("adminos_social_posts").select("id,network,status,title,caption,payload,recommended_publish_at,manual_publish_required,posting_notes,created_at").eq("manual_publish_required",true).in("status",["draft","validated"]).order("created_at",{ascending:false}).limit(40),
    ]);
    if(overviewR.error)toast.error(overviewR.error.message||"Could not load Luna Growth Intelligence");
    if(socialR.error)toast.error(socialR.error.message||"Could not load social demand intelligence");
    if(postsR.error)toast.error(postsR.error.message||"Could not load manual post queue");
    setData((overviewR.data||null) as Overview|null);
    const latestByNetwork=new Map<string,SocialDemand>();
    for(const row of socialR.data||[])if(!latestByNetwork.has(row.network))latestByNetwork.set(row.network,row);
    setSocial(Array.from(latestByNetwork.values()).sort((a,b)=>Number(b.demand_score)-Number(a.demand_score)));
    setManualPosts((postsR.data||[]) as ManualPost[]);
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const runCycle=async()=>{
    setRunning(true);
    const {data:result,error}=await supabase.functions.invoke("luna-orchestrator",{body:{action:"demand_cycle",days:30,source:"adminos_manual"}});
    if(error||result?.error)toast.error(result?.detail||result?.error||error?.message||"Demand cycle failed");
    else toast.success(`Luna demand cycle complete · ${result?.ranked_opportunities?.length||0} market signals ranked`);
    setRunning(false);await load();
  };

  const runContentCycle=async()=>{
    setContentRunning(true);
    const {data:result,error}=await supabase.functions.invoke("luna-orchestrator",{body:{action:"content_cycle",source:"adminos_manual"}});
    if(error||result?.error)toast.error(result?.detail||result?.error||error?.message||"Content cycle failed");
    else if(result?.skipped)toast.info(result?.reason||"No new content pack was required");
    else toast.success(`Founder-ready content pack created · ${result?.networks?.length||0} platform variants`);
    setContentRunning(false);await load();
  };

  const copyPost=async(post:ManualPost)=>{
    const text=[post.title,post.caption,post.payload?.hashtags?.join?.(" "),post.payload?.target_url].filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success(`${titleCase(post.network)} post copied`);
  };

  const agents=data?.agents||[];
  const lunaCore=agents.find((x:any)=>x.agent_key==="luna_core");
  const lunaDemand=agents.find((x:any)=>x.agent_key==="luna_demand");
  const lunaContent=agents.find((x:any)=>x.agent_key==="luna_content");
  const lunaSocial=agents.find((x:any)=>x.agent_key==="luna_social_demand");
  const ranked=data?.latest_snapshot?.ranked_opportunities||[];
  const strongestSocial=useMemo(()=>social[0]||null,[social]);

  return <section className="min-w-0 space-y-4">
    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge className="rounded-full">Luna AgentOS</Badge><Badge variant="outline" className="rounded-full">RG0–RG5</Badge><Badge variant="outline" className="rounded-full">Metricool = Demand Only</Badge><Badge variant="outline" className="rounded-full">Founder Posting</Badge></div><h2 className="mt-3 text-2xl font-black tracking-tight">Growth & Social Demand Intelligence</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Luna combines ResKonnect demand, verified inventory and Metricool social analytics. Metricool does not publish automatically. Luna prepares platform-specific content; you decide what to post and publish it manually.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={runCycle} disabled={running||loading}><RefreshCw className={`mr-2 h-4 w-4 ${running?"animate-spin":""}`}/>{running?"Running demand…":"Refresh demand"}</Button><Button onClick={runContentCycle} disabled={contentRunning||loading}><Sparkles className={`mr-2 h-4 w-4 ${contentRunning?"animate-pulse":""}`}/>{contentRunning?"Preparing content…":"Prepare content pack"}</Button></div>
    </div>

    <div className="grid gap-3 md:grid-cols-5">
      <GateCard icon={Brain} gate="RG0" title="Luna / Dimpho split" ok={Boolean(lunaCore?.enabled)} text="Luna owns website/company intelligence; Dimpho remains the WhatsApp conversion specialist."/>
      <GateCard icon={Link2} gate="RG1" title="Attribution" ok={!loading} text={`${fmt(data?.campaign_visits_24h)} campaign visits · ${fmt(data?.attributed_applications_30d)} attributed applications / 30d.`}/>
      <GateCard icon={Radar} gate="RG2" title="Demand Intelligence" ok={Boolean(lunaDemand?.enabled&&data?.latest_snapshot)} text={data?.latest_snapshot?`Latest verified cycle ${new Date(data.latest_snapshot.generated_at).toLocaleString("en-ZA")}.`:"Demand snapshot pending."}/>
      <GateCard icon={Sparkles} gate="RG3" title="Content Intelligence" ok={Boolean(lunaContent?.enabled)} text="Creates fact-grounded platform variants and campaign packs. Publishing remains blocked."/>
      <GateCard icon={TrendingUp} gate="RG4–5" title="Social Demand" ok={Boolean(lunaSocial?.enabled&&social.length)} text={strongestSocial?`${titleCase(strongestSocial.network)} is strongest at ${Math.round(Number(strongestSocial.demand_score))}/100 (${strongestSocial.demand_signal}).`:"Waiting for measurable Metricool social data."}/>
    </div>

    <Card className="rounded-[26px] border-primary/20"><CardHeader className="pb-3"><CardTitle>Metricool Social Demand Engine</CardTitle><p className="text-xs text-muted-foreground">Read-only analytics role. Social reach, views, interaction, retention and best-time signals inform Luna; no scheduling or posting occurs automatically.</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{social.map(row=><div key={row.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between"><p className="font-black">{titleCase(row.network)}</p><Badge variant={Number(row.demand_score)>=70?"default":"secondary"}>{Math.round(Number(row.demand_score))}/100</Badge></div><p className="mt-1 text-xs text-muted-foreground">{titleCase(row.demand_signal)} demand · {row.period_start} → {row.period_end}</p><div className="mt-3 grid grid-cols-3 gap-2"><Metric value={row.metrics?.views} label="views"/><Metric value={row.metrics?.reach} label="reach"/><Metric value={row.metrics?.interactions} label="actions"/></div>{Array.isArray(row.best_times)&&row.best_times[0]&&<p className="mt-3 text-[11px] text-muted-foreground">Strongest activity window: day {row.best_times[0].day_of_week}, {String(row.best_times[0].hour).padStart(2,"0")}:00.</p>}</div>)}</div>{!loading&&social.length===0&&<p className="text-sm text-muted-foreground">No measurable social demand snapshot is available yet. Once you publish and Metricool records performance, Luna will use it automatically.</p>}</CardContent></Card>

    <Card className="rounded-[26px]"><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle>Founder Posting Queue</CardTitle><p className="mt-1 text-xs text-muted-foreground">Luna prepares. You publish. Copy the platform version here, post it yourself, then performance feeds back through Metricool.</p></div><Badge variant="outline">{manualPosts.length} ready</Badge></div></CardHeader><CardContent>{manualPosts.length===0?<p className="text-sm text-muted-foreground">No founder-ready posts yet. Run “Prepare content pack” when a verified demand opportunity exists.</p>:<div className="grid gap-3 xl:grid-cols-2">{manualPosts.map(post=><div key={post.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-2"><div><p className="font-black">{titleCase(post.network)}</p><p className="text-[11px] text-muted-foreground">{titleCase(post.status)} · manual publish required</p></div><Button size="sm" variant="outline" onClick={()=>void copyPost(post)}><Clipboard className="mr-2 h-3.5 w-3.5"/>Copy</Button></div>{post.title&&<p className="mt-3 text-sm font-semibold">{post.title}</p>}<p className="mt-2 line-clamp-5 text-xs leading-5 text-muted-foreground">{post.caption||"No caption generated."}</p>{post.payload?.asset_brief&&<div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs"><span className="font-semibold">Asset:</span> {post.payload.asset_brief}</div>}{post.payload?.target_url&&<p className="mt-2 truncate text-[11px] text-primary">{post.payload.target_url}</p>}</div>)}</div>}</CardContent></Card>

    <Card className="overflow-hidden rounded-[26px]"><CardHeader className="pb-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/>Latest Luna demand brief</CardTitle><p className="mt-1 text-xs text-muted-foreground">Deterministic ranking; OpenAI narrative refreshes only when the market fingerprint changes or becomes stale.</p></div>{data?.latest_snapshot&&<Badge variant="outline">{data.latest_snapshot.provider} · {data.latest_snapshot.model}</Badge>}</div></CardHeader><CardContent><p className="text-sm leading-6">{loading?"Loading verified demand intelligence…":data?.latest_snapshot?.summary||"No demand snapshot has been generated yet."}</p>{data?.latest_snapshot?.source_counts&&<div className="mt-4 flex flex-wrap gap-2">{Object.entries(data.latest_snapshot.source_counts).map(([key,value])=><Badge key={key} variant="secondary" className="font-medium">{key.replaceAll("_"," ")}: {fmt(value)}</Badge>)}</div>}</CardContent></Card>

    <div className="grid gap-3 xl:grid-cols-2">{ranked.slice(0,8).map((item,index)=><Card key={item.campus_key} className="rounded-[22px]"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Badge variant={item.campaign_priority>=70?"default":"secondary"}>#{index+1}</Badge><p className="font-black">{item.campus_name}</p></div><p className="mt-1 text-xs text-muted-foreground">{item.reason}</p></div><div className="text-right"><p className="text-2xl font-black">{item.campaign_priority}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">priority / 100</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Metric value={item.available_spots} label="spots"/><Metric value={item.demand_index} label="demand"/><Metric value={item.website_searches} label="web searches"/><Metric value={item.whatsapp_leads} label="WA leads"/><Metric value={item.applications} label="applications"/></div></CardContent></Card>)}</div>

    {!loading&&ranked.length===0&&<div className="rounded-2xl border border-dashed p-6 text-center"><Activity className="mx-auto h-6 w-6 text-muted-foreground"/><p className="mt-2 font-bold">No market with reported available inventory is currently ranked.</p><p className="mt-1 text-xs text-muted-foreground">This is a valid data state, not an AI failure.</p></div>}
  </section>;
}

function GateCard({icon:Icon,gate,title,ok,text}:{icon:any;gate:string;title:string;ok:boolean;text:string}){return <Card className="rounded-[22px]"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted"><Icon className="h-4 w-4"/></div><Badge variant={ok?"default":"secondary"}>{ok?<CheckCircle2 className="mr-1 h-3 w-3"/>:null}{gate}</Badge></div><p className="mt-4 font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></CardContent></Card>}
function Metric({value,label}:{value:unknown;label:string}){return <div className="rounded-xl bg-muted/55 p-2 text-center"><p className="font-black">{fmt(value)}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>}
