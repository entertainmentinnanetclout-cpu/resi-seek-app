import { useCallback, useEffect, useState } from "react";
import { Activity, BarChart3, Brain, CheckCircle2, Copy, ExternalLink, Link2, PenLine, Radar, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type SocialDemand={
  id:string;
  network:string;
  period_start:string;
  period_end:string;
  metrics:Record<string,unknown>;
  best_times:unknown[];
  demand_score:number;
  demand_signal:string;
  source:string;
  imported_at:string;
};

type ManualPost={
  id:string;
  network:string;
  status:string;
  title:string|null;
  caption:string|null;
  payload:Record<string,any>;
  recommended_publish_at:string|null;
  manual_publish_required:boolean;
  external_url:string|null;
  created_at:string;
  campaign_code:string|null;
  campus:string|null;
  campaign_name:string|null;
};

type Overview={
  agents:any[];
  latest_snapshot?:{
    id:string;
    academic_year?:number;
    generated_at:string;
    summary:string;
    ranked_opportunities:Opportunity[];
    source_counts:Record<string,number>;
    provider:string;
    model:string;
    status:string;
  }|null;
  social_demand?:SocialDemand[];
  recent_social_posts?:ManualPost[];
  manual_social_queue?:{draft:number;ready:number;published:number};
  publishing_policy?:{
    metricool_analysis:boolean;
    metricool_publishing:boolean;
    manual_publish_required:boolean;
    authority:string;
  };
  events_24h:number;
  searches_24h:number;
  campaign_visits_24h:number;
  attributed_applications_30d:number;
  attributed_placements_30d:number;
  growth_campaigns?:{total:number;active:number;draft:number};
};

const fmt=(v:unknown)=>Number(v||0).toLocaleString("en-ZA");
const currentYear=new Date().getFullYear();
const years=Array.from({length:4},(_,i)=>currentYear+i);

export default function AdminOSLunaGrowth(){
  const[data,setData]=useState<Overview|null>(null);
  const[loading,setLoading]=useState(true);
  const[runningDemand,setRunningDemand]=useState(false);
  const[runningContent,setRunningContent]=useState(false);
  const[academicYear,setAcademicYear]=useState(currentYear);
  const[publishedUrls,setPublishedUrls]=useState<Record<string,string>>({});

  const load=useCallback(async()=>{
    setLoading(true);
    const {data:overview,error}=await(supabase as any).rpc("luna_growth_overview");
    if(error){toast.error(error.message||"Could not load Luna Growth Intelligence");setLoading(false);return;}
    setData(overview as Overview);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const runDemand=async()=>{
    setRunningDemand(true);
    const {data:result,error}=await supabase.functions.invoke("luna-orchestrator",{body:{action:"demand_cycle",days:30,academic_year:academicYear,source:"adminos_manual"}});
    if(error||result?.error)toast.error(result?.detail||result?.error||error?.message||"Demand cycle failed");
    else toast.success(`Luna ${academicYear} demand cycle complete · ${result?.ranked_opportunities?.length||0} market signals ranked`);
    setRunningDemand(false);await load();
  };

  const runContent=async()=>{
    setRunningContent(true);
    const {data:result,error}=await supabase.functions.invoke("luna-orchestrator",{body:{action:"content_cycle",academic_year:academicYear,source:"adminos_manual"}});
    if(error||result?.error)toast.error(result?.detail||result?.error||error?.message||"Content cycle failed");
    else if(result?.skipped)toast.info(result?.reason||"No new content pack was required");
    else toast.success(`Manual content pack prepared · ${result?.campaign_code||"campaign"}`);
    setRunningContent(false);await load();
  };

  const copy=async(value:string,label:string)=>{
    try{await navigator.clipboard.writeText(value);toast.success(`${label} copied`);}catch{toast.error("Could not copy to clipboard");}
  };

  const markPublished=async(post:ManualPost)=>{
    const url=(publishedUrls[post.id]||"").trim();
    if(!url)return toast.error("Paste the live social post URL first.");
    const {error}=await(supabase as any).rpc("luna_mark_social_post_published",{p_social_post_id:post.id,p_external_url:url,p_external_post_id:null,p_published_at:new Date().toISOString()});
    if(error)return toast.error(error.message||"Could not mark post as published");
    toast.success(`${post.network} post marked as manually published`);
    setPublishedUrls((current)=>({...current,[post.id]:""}));await load();
  };

  const agents=data?.agents||[];
  const lunaCore=agents.find((x:any)=>x.agent_key==="luna_core");
  const lunaDemand=agents.find((x:any)=>x.agent_key==="luna_demand");
  const lunaContent=agents.find((x:any)=>x.agent_key==="luna_content");
  const lunaSocial=agents.find((x:any)=>x.agent_key==="luna_social_demand");
  const ranked=data?.latest_snapshot?.ranked_opportunities||[];
  const social=data?.social_demand||[];
  const manualPosts=(data?.recent_social_posts||[]).filter((post)=>post.manual_publish_required);
  const readyPosts=manualPosts.filter((post)=>post.status==="validated"&&!post.external_url);

  return <section className="min-w-0 space-y-5">
    <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full">Luna AgentOS</Badge>
          <Badge variant="outline" className="rounded-full">RG0–RG5</Badge>
          <Badge variant="outline" className="rounded-full">Metricool = Demand Analysis</Badge>
          <Badge variant="outline" className="rounded-full">Posting = Manual</Badge>
        </div>
        <h2 className="mt-3 text-2xl font-black tracking-tight">Growth & Social Demand Intelligence</h2>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
          Luna combines year-isolated accommodation demand with Metricool social analytics, prepares platform-specific posting packs and measures conversions in Supabase. Metricool does not publish unless you explicitly instruct a future publishing action.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={String(academicYear)} onValueChange={(value)=>setAcademicYear(Number(value))}>
          <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
          <SelectContent>{years.map((year)=><SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={runDemand} disabled={runningDemand||loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${runningDemand?"animate-spin":""}`}/>{runningDemand?"Running demand…":"Run demand"}
        </Button>
        <Button onClick={runContent} disabled={runningContent||loading}>
          <PenLine className="mr-2 h-4 w-4"/>{runningContent?"Preparing pack…":"Prepare content pack"}
        </Button>
      </div>
    </div>

    <Card className="rounded-[24px] border-amber-500/25 bg-amber-500/[0.04]">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-black">Founder publishing control is active</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Metricool analytics and best-time signals may run automatically. Luna may create campaigns and copy. No Metricool scheduler/posting action is part of the normal automation path.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Analysis: ON</Badge>
            <Badge variant="outline">Auto-publishing: OFF</Badge>
            <Badge variant="outline">Manual queue: {fmt(data?.manual_social_queue?.ready)} ready</Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <GateCard icon={Brain} gate="RG0" title="Luna / Dimpho split" ok={Boolean(lunaCore?.enabled)} text="Luna owns website/company intelligence; Dimpho remains the WhatsApp conversion specialist."/>
      <GateCard icon={Link2} gate="RG1" title="Attribution" ok={!loading} text={`${fmt(data?.events_24h)} demand events · ${fmt(data?.attributed_applications_30d)} attributed applications in 30d.`}/>
      <GateCard icon={Radar} gate="RG2" title="Year-aware demand" ok={Boolean(lunaDemand?.enabled&&data?.latest_snapshot)} text={data?.latest_snapshot?`Latest ${data.latest_snapshot.academic_year||academicYear} demand cycle: ${new Date(data.latest_snapshot.generated_at).toLocaleString("en-ZA")}.`:"Demand snapshot pending."}/>
      <GateCard icon={PenLine} gate="RG3" title="Content Intelligence" ok={Boolean(lunaContent?.enabled)} text="Luna creates fact-grounded, platform-specific drafts and campaign links; publication remains manual."/>
      <GateCard icon={BarChart3} gate="RG4–5" title="Social demand loop" ok={Boolean(lunaSocial?.enabled)} text="Metricool analyzes social attention; Supabase remains conversion truth and the manual posting queue closes the loop."/>
    </div>

    <Card className="overflow-hidden rounded-[26px]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/>Latest Luna demand brief</CardTitle><p className="mt-1 text-xs text-muted-foreground">Supply is isolated by academic year; narrative refreshes only from verified signals.</p></div>
          {data?.latest_snapshot&&<Badge variant="outline">{data.latest_snapshot.provider} · {data.latest_snapshot.model}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6">{loading?"Loading verified demand intelligence…":data?.latest_snapshot?.summary||"No demand snapshot has been generated yet."}</p>
        {data?.latest_snapshot?.source_counts&&<div className="mt-4 flex flex-wrap gap-2">{Object.entries(data.latest_snapshot.source_counts).map(([key,value])=><Badge key={key} variant="secondary" className="font-medium">{key.replaceAll("_"," ")}: {fmt(value)}</Badge>)}</div>}
      </CardContent>
    </Card>

    <div>
      <div className="mb-3 flex items-center justify-between"><div><h3 className="font-black">Metricool Social Demand</h3><p className="text-xs text-muted-foreground">Attention and intent signals only — not conversion claims.</p></div><Badge variant="outline">Brand 6910625</Badge></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {social.map((row)=><Card key={row.id} className="rounded-[22px]"><CardContent className="p-5">
          <div className="flex items-start justify-between gap-2"><div><p className="font-black capitalize">{row.network}</p><p className="text-[11px] text-muted-foreground">{row.period_start} → {row.period_end}</p></div><Badge variant={row.demand_score>=50?"default":"secondary"}>{Math.round(row.demand_score)}/100</Badge></div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.demand_signal}</p>
          <div className="mt-3 grid grid-cols-2 gap-2"><Metric value={row.metrics?.views} label="views"/><Metric value={row.metrics?.reach} label="reach"/><Metric value={row.metrics?.interactions} label="interactions"/><Metric value={row.metrics?.profile_views} label="profile intent"/></div>
          <p className="mt-3 text-[10px] text-muted-foreground">Source: {row.source.replaceAll("_"," ")} · {new Date(row.imported_at).toLocaleString("en-ZA")}</p>
        </CardContent></Card>)}
        {!loading&&social.length===0&&<Card className="rounded-[22px] border-dashed md:col-span-2 xl:col-span-4"><CardContent className="p-6 text-center text-sm text-muted-foreground">No Metricool demand snapshot has been imported yet.</CardContent></Card>}
      </div>
    </div>

    <div>
      <div className="mb-3"><h3 className="font-black">Manual Posting Queue</h3><p className="text-xs text-muted-foreground">Luna prepares these. You choose what actually gets posted.</p></div>
      <div className="space-y-3">
        {readyPosts.map((post)=><Card key={post.id} className="rounded-[22px]"><CardContent className="p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2"><Badge className="capitalize">{post.network}</Badge><Badge variant="outline">{post.campaign_code||"No campaign code"}</Badge>{post.campus&&<Badge variant="outline">{post.campus}</Badge>}</div>
              <p className="mt-3 font-black">{post.title||post.campaign_name||"Luna content pack"}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{post.caption||"No caption generated."}</p>
              {post.payload?.target_url&&<div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs break-all">{post.payload.target_url}</div>}
              {post.payload?.asset_brief&&<p className="mt-3 text-xs"><span className="font-bold">Asset brief:</span> {post.payload.asset_brief}</p>}
            </div>
            <div className="w-full space-y-2 xl:w-80">
              <Button className="w-full" variant="outline" onClick={()=>void copy(post.caption||"","Caption")}><Copy className="mr-2 h-4 w-4"/>Copy caption</Button>
              {post.payload?.target_url&&<Button className="w-full" variant="outline" onClick={()=>void copy(post.payload.target_url,"Campaign link")}><Link2 className="mr-2 h-4 w-4"/>Copy tracked link</Button>}
              <Input value={publishedUrls[post.id]||""} onChange={(event)=>setPublishedUrls((current)=>({...current,[post.id]:event.target.value}))} placeholder="Paste live post URL after posting"/>
              <Button className="w-full" onClick={()=>void markPublished(post)}><ExternalLink className="mr-2 h-4 w-4"/>Mark manually posted</Button>
            </div>
          </div>
        </CardContent></Card>)}
        {!loading&&readyPosts.length===0&&<div className="rounded-2xl border border-dashed p-6 text-center"><PenLine className="mx-auto h-6 w-6 text-muted-foreground"/><p className="mt-2 font-bold">No validated post is waiting for you.</p><p className="mt-1 text-xs text-muted-foreground">Run a content cycle after demand intelligence is current.</p></div>}
      </div>
    </div>

    <div>
      <div className="mb-3"><h3 className="font-black">Accommodation Demand Ranking</h3><p className="text-xs text-muted-foreground">Inventory-backed markets only.</p></div>
      <div className="grid gap-3 xl:grid-cols-2">
        {ranked.slice(0,8).map((item,index)=><Card key={item.campus_key} className="rounded-[22px]"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Badge variant={item.campaign_priority>=70?"default":"secondary"}>#{index+1}</Badge><p className="font-black">{item.campus_name}</p></div><p className="mt-1 text-xs text-muted-foreground">{item.reason}</p></div><div className="text-right"><p className="text-2xl font-black">{item.campaign_priority}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">priority / 100</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Metric value={item.available_spots} label="spots"/><Metric value={item.demand_index} label="demand"/><Metric value={item.website_searches} label="web searches"/><Metric value={item.whatsapp_leads} label="WA leads"/><Metric value={item.applications} label="applications"/></div></CardContent></Card>)}
      </div>
      {!loading&&ranked.length===0&&<div className="rounded-2xl border border-dashed p-6 text-center"><Activity className="mx-auto h-6 w-6 text-muted-foreground"/><p className="mt-2 font-bold">No market with reported available inventory is currently ranked.</p><p className="mt-1 text-xs text-muted-foreground">This is a valid data state, not an AI failure.</p></div>}
    </div>
  </section>;
}

function GateCard({icon:Icon,gate,title,ok,text}:{icon:any;gate:string;title:string;ok:boolean;text:string}){return <Card className="rounded-[22px]"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted"><Icon className="h-4 w-4"/></div><Badge variant={ok?"default":"secondary"}>{ok?<CheckCircle2 className="mr-1 h-3 w-3"/>:null}{gate}</Badge></div><p className="mt-4 font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></CardContent></Card>}
function Metric({value,label}:{value:unknown;label:string}){return <div className="rounded-xl bg-muted/55 p-2 text-center"><p className="font-black">{fmt(value)}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>}
