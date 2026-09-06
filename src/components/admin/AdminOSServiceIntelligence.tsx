import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Bot, Building2, CheckCircle2, Clock3, FileCheck2, Globe2, HeartHandshake, MessageCircle, RefreshCw, Search, Sparkles, UserRound, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SystemCard={n:number;title:string;description:string;icon:any;value:string;sub:string;state?:"good"|"attention"|"neutral"};
const fmt=(v:any)=>Number(v||0).toLocaleString("en-ZA");

export default function AdminOSServiceIntelligence(){
  const[loading,setLoading]=useState(true);const[data,setData]=useState<any>({});
  const load=useCallback(async()=>{setLoading(true);try{
    const [timeline,health,actions,events,quality,brief,recovery,metrics,languages]=await Promise.all([
      (supabase as any).from("adminos_customer_events").select("id",{count:"exact",head:true}),
      (supabase as any).from("adminos_application_health_scores").select("score,health_band").limit(5000),
      (supabase as any).from("adminos_next_best_actions").select("id,priority,title,action_type,action_url,rationale,generated_at").eq("active",true).is("completed_at",null).order("priority",{ascending:false}).limit(100),
      (supabase as any).from("adminos_whatsapp_site_events").select("id,event_type,status,created_at,last_error").or("event_type.like.proactive_%,event_type.eq.csat_request,event_type.eq.service_recovery_ack").order("created_at",{ascending:false}).limit(300),
      (supabase as any).from("adminos_residence_quality_v").select("id,data_quality_score,service_ready,premium_eligible,quality_block_reason").limit(5000),
      (supabase as any).from("adminos_executive_briefs").select("*").order("brief_date",{ascending:false}).limit(1).maybeSingle(),
      (supabase as any).from("adminos_service_recovery_items").select("id,status,priority,issue_type,last_detected_at").in("status",["open","in_progress"]).order("priority",{ascending:false}).limit(100),
      (supabase as any).from("adminos_service_metrics_daily").select("*").order("metric_date",{ascending:false}).limit(1).maybeSingle(),
      (supabase as any).from("adminos_contact_languages").select("language_code").limit(10000),
    ]);
    const err=[timeline,health,actions,events,quality,brief,recovery,metrics,languages].find((r:any)=>r.error)?.error;if(err)throw err;
    setData({timelineCount:timeline.count||0,health:health.data||[],actions:actions.data||[],events:events.data||[],quality:quality.data||[],brief:brief.data||null,recovery:recovery.data||[],metrics:metrics.data||null,languages:languages.data||[]});
  }catch(e:any){toast.error(e?.message||"Could not load Service Intelligence");}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  const healthAvg=data.health?.length?Math.round(data.health.reduce((s:number,x:any)=>s+Number(x.score||0),0)/data.health.length):0;
  const healthAttention=(data.health||[]).filter((x:any)=>["attention","incomplete","blocked"].includes(x.health_band)).length;
  const ready=(data.quality||[]).filter((x:any)=>x.service_ready).length,premium=(data.quality||[]).filter((x:any)=>x.premium_eligible).length;
  const pendingEvents=(data.events||[]).filter((x:any)=>["pending","processing","waiting_template","failed"].includes(x.status)).length;
  const languages=useMemo(()=>{const m:Record<string,number>={};for(const x of data.languages||[])m[x.language_code]=(m[x.language_code]||0)+1;return m;},[data.languages]);
  const metric=data.metrics||{};const briefMetrics=data.brief?.metrics||{};const priorities=Array.isArray(data.brief?.attention)?data.brief.attention:Array.isArray(data.brief?.priorities)?data.brief.priorities:[];
  const cards:SystemCard[]=[
    {n:1,title:"Universal Customer Timeline",description:"Applications, WIL, reservations, documents, support and WhatsApp in one operational ledger.",icon:UserRound,value:fmt(data.timelineCount),sub:"timeline events",state:"good"},
    {n:2,title:"Application Health Score",description:"Deterministic 0–100 readiness scoring identifies exactly what blocks progress.",icon:FileCheck2,value:`${healthAvg}%`,sub:`${healthAttention} need attention`,state:healthAttention?"attention":"good"},
    {n:3,title:"Next Best Action",description:"Database-ranked next steps keep customers progressing without an AI decision call.",icon:Sparkles,value:fmt(data.actions?.length),sub:"active actions",state:"good"},
    {n:4,title:"Proactive WhatsApp",description:"Applications, reservations, missing actions, recovery and CSAT flow into Twilio automatically.",icon:MessageCircle,value:fmt(pendingEvents),sub:"currently queued / waiting",state:pendingEvents?"attention":"good"},
    {n:5,title:"Residence Readiness",description:"Live quality gates keep images, rent, location, availability and public links service-ready.",icon:Building2,value:`${ready}/${fmt(data.quality?.length)}`,sub:`${premium} premium eligible`,state:ready===data.quality?.length?"good":"attention"},
    {n:6,title:"Dimpho Morning Brief",description:"Executive priorities are generated from SQL metrics every morning without model tokens.",icon:Bot,value:data.brief?"Live":"Waiting",sub:"0 routine AI calls",state:data.brief?"good":"attention"},
    {n:7,title:"Service Recovery Queue",description:"Finds unanswered messages, delivery failures and stalled workflows before customers are abandoned.",icon:HeartHandshake,value:fmt(data.recovery?.length),sub:"open recovery items",state:data.recovery?.length?"attention":"good"},
    {n:8,title:"CSAT + Service Speed",description:"Measures first response, delivery, resolution and customer satisfaction with production evidence.",icon:BarChart3,value:metric.csat_average?`${Number(metric.csat_average).toFixed(1)}/5`:"—",sub:metric.avg_first_response_seconds!=null?`${Number(metric.avg_first_response_seconds).toFixed(1)}s avg first response`:"collecting response data",state:"good"},
    {n:9,title:"Multilingual Dimpho",description:"Language detection and fixed service phrases run deterministically across seven South African language options.",icon:Globe2,value:`${Object.keys(languages).length}/7`,sub:"languages currently represented",state:"good"},
    {n:10,title:"Global AdminOS Search",description:"Cmd/Ctrl + K searches customers, phones, student numbers, residences, applications, WIL and WhatsApp.",icon:Search,value:"⌘K",sub:"zero-AI operational search",state:"good"},
  ];
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[32px] border bg-gradient-to-br from-background via-background to-violet-500/[.07] p-5 shadow-sm sm:p-6"><div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl"/><div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap gap-2"><Badge className="rounded-full gap-1"><Zap className="h-3.5 w-3.5"/>Service Intelligence</Badge><Badge variant="outline" className="rounded-full">10/10 systems</Badge><Badge variant="outline" className="rounded-full">Deterministic first</Badge></div><h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Dimpho service operating layer</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">The routine operating system runs on Supabase rules, triggers, cron and Twilio. OpenAI is reserved for customer language reasoning that structured service logic cannot resolve.</p></div><Button variant="outline" className="w-fit rounded-full" onClick={()=>void load()} disabled={loading}><RefreshCw className={cn("h-4 w-4",loading&&"animate-spin")}/>Refresh</Button></div></section>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{cards.map(c=><System key={c.n} {...c}/>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="rounded-[28px]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5"/>Dimpho executive brief</CardTitle></CardHeader><CardContent>{data.brief?<><div className="rounded-2xl bg-muted/30 p-4"><p className="font-black">{data.brief.headline}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{data.brief.summary||"Generated from live operational metrics."}</p></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini label="Unread" value={briefMetrics.whatsapp_unread}/><Mini label="Escalated" value={briefMetrics.whatsapp_escalated}/><Mini label="App attention" value={briefMetrics.applications_attention}/><Mini label="Residence gaps" value={briefMetrics.residences_needs_data}/></div>{priorities.length>0&&<div className="mt-4 space-y-2">{priorities.slice(0,6).map((p:any,i:number)=><div key={i} className="flex items-start gap-3 rounded-2xl border p-3"><Activity className="mt-0.5 h-4 w-4 text-amber-600"/><div><p className="text-sm font-bold">{p.title||p.message||"Priority"}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{p.area||p.type||"operations"}</p></div></div>)}</div>}</>:<p className="text-sm text-muted-foreground">The first deterministic brief will appear after the scheduled refresh.</p>}</CardContent></Card>
      <Card className="rounded-[28px]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5"/>Service-speed evidence</CardTitle></CardHeader><CardContent className="space-y-3"><Metric label="Average first response" value={metric.avg_first_response_seconds!=null?`${Number(metric.avg_first_response_seconds).toFixed(1)} sec`:"—"}/><Metric label="P90 first response" value={metric.p90_first_response_seconds!=null?`${Number(metric.p90_first_response_seconds).toFixed(1)} sec`:"—"}/><Metric label="Answered within 60 sec" value={metric.response_under_60s_pct!=null?`${Number(metric.response_under_60s_pct).toFixed(1)}%`:"—"}/><Metric label="CSAT" value={metric.csat_average?`${Number(metric.csat_average).toFixed(2)}/5 (${fmt(metric.csat_count)})`:"Collecting"}/><Metric label="Open service recovery" value={fmt(data.recovery?.length)}/><div className="rounded-2xl border bg-emerald-500/[.04] p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Cost control:</strong> these metrics, scores, searches, reminders and watchdogs consume no OpenAI requests. Dimpho calls the model only for natural-language service reasoning after deterministic routing.</div></CardContent></Card>
    </div>
  </div>;
}
function System(c:SystemCard){return <div className="rounded-[24px] border bg-background p-4 shadow-sm"><div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted"><c.icon className="h-4 w-4"/></div><Badge variant="outline" className={cn("rounded-full text-[9px]",c.state==="good"&&"border-emerald-500/25 text-emerald-700",c.state==="attention"&&"border-amber-500/25 text-amber-700")}>{c.n}/10</Badge></div><p className="mt-4 text-lg font-black">{c.value}</p><p className="mt-1 text-sm font-black">{c.title}</p><p className="mt-1 text-[10px] font-semibold text-muted-foreground">{c.sub}</p><p className="mt-3 text-[11px] leading-5 text-muted-foreground">{c.description}</p></div>;}
function Mini({label,value}:{label:string;value:any}){return <div className="rounded-2xl border p-3"><p className="text-lg font-black">{fmt(value)}</p><p className="text-[9px] text-muted-foreground">{label}</p></div>;}
function Metric({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between gap-3 rounded-2xl border p-3"><span className="text-xs text-muted-foreground">{label}</span><strong className="text-sm">{value}</strong></div>;}
