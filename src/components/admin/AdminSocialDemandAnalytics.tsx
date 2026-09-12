import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, CalendarClock, ExternalLink, Eye, MessageCircle, MousePointerClick,
  PlaySquare, RefreshCw, Send, Share2, Sparkles, Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Snapshot={
  id:string;
  network:string;
  period_start:string;
  period_end:string;
  metrics:Record<string,unknown>;
  top_content:any[];
  best_times:any[];
  demand_score:number|string;
  demand_signal:string;
  source:string;
  imported_at:string;
};

type PreparedPost={
  id:string;
  network:string;
  status:string;
  title:string|null;
  caption:string|null;
  payload:Record<string,any>;
  manual_publish_required:boolean;
  demand_snapshot_id:string|null;
  recommended_publish_at:string|null;
  created_at:string;
};

const networkLabel:Record<string,string>={
  tiktok:"TikTok",instagram:"Instagram",facebook:"Facebook",youtube:"YouTube",
  linkedin:"LinkedIn",threads:"Threads",x:"X",pinterest:"Pinterest",google_business:"Google Business"
};

const n=(value:unknown)=>Number(value||0);
const fmt=(value:unknown)=>n(value).toLocaleString("en-ZA");
const compact=(value:unknown)=>new Intl.NumberFormat("en-ZA",{notation:"compact",maximumFractionDigits:1}).format(n(value));
const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function bestWindow(times:any[]){
  if(!Array.isArray(times)||times.length===0)return "No reliable window yet";
  const item=times[0]||{};
  const day=dayNames[Number(item.day_of_week)%7]||`Day ${item.day_of_week??"?"}`;
  const hour=String(Number(item.hour||0)).padStart(2,"0");
  return `${day} · ${hour}:00`;
}

export default function AdminSocialDemandAnalytics({compactMode=false}:{compactMode?:boolean}){
  const[snapshots,setSnapshots]=useState<Snapshot[]>([]);
  const[posts,setPosts]=useState<PreparedPost[]>([]);
  const[loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    const [snapshotR,postR]=await Promise.all([
      (supabase as any).from("adminos_social_demand_snapshots")
        .select("id,network,period_start,period_end,metrics,top_content,best_times,demand_score,demand_signal,source,imported_at")
        .order("imported_at",{ascending:false}).limit(80),
      (supabase as any).from("adminos_social_posts")
        .select("id,network,status,title,caption,payload,manual_publish_required,demand_snapshot_id,recommended_publish_at,created_at")
        .eq("manual_publish_required",true).in("status",["draft","validated"])
        .order("created_at",{ascending:false}).limit(40),
    ]);
    if(snapshotR.error)toast.error(snapshotR.error.message||"Could not load social demand intelligence");
    if(postR.error)toast.error(postR.error.message||"Could not load founder posting queue");
    const seen=new Set<string>();const latest:Snapshot[]=[];
    for(const row of snapshotR.data||[]){if(seen.has(row.network))continue;seen.add(row.network);latest.push(row as Snapshot);}
    setSnapshots(latest);setPosts((postR.data||[]) as PreparedPost[]);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const totalViews=useMemo(()=>snapshots.reduce((sum,row)=>sum+n(row.metrics?.views),0),[snapshots]);
  const totalReach=useMemo(()=>snapshots.reduce((sum,row)=>sum+n(row.metrics?.reach),0),[snapshots]);
  const totalInteractions=useMemo(()=>snapshots.reduce((sum,row)=>sum+n(row.metrics?.interactions),0),[snapshots]);
  const strongest=useMemo(()=>[...snapshots].sort((a,b)=>n(b.demand_score)-n(a.demand_score))[0],[snapshots]);

  return <div className="min-w-0 space-y-5">
    {!compactMode&&<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap gap-2"><Badge className="rounded-full">Metricool Demand Engine</Badge><Badge variant="outline" className="rounded-full">ANALYTICS ONLY</Badge><Badge variant="outline" className="rounded-full">Publishing OFF</Badge></div>
        <h2 className="mt-3 text-2xl font-black tracking-tight">Social Demand & Content Intelligence</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Metricool measures what students respond to. Luna converts those signals into content recommendations. Posts remain founder/manual unless you explicitly change that policy.</p>
      </div>
      <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh analytics</Button>
    </div>}

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Metric icon={Eye} label="30d social views" value={compact(totalViews)} />
      <Metric icon={Users} label="30d reach" value={compact(totalReach)} />
      <Metric icon={MousePointerClick} label="Interactions" value={compact(totalInteractions)} />
      <Metric icon={Sparkles} label="Strongest demand" value={strongest?`${networkLabel[strongest.network]||strongest.network} ${Math.round(n(strongest.demand_score))}/100`:"No data"} />
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {snapshots.map((row)=>{
        const score=Math.round(n(row.demand_score));
        const metrics=row.metrics||{};
        return <Card key={row.id} className="overflow-hidden rounded-[22px]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2"><div><p className="font-black">{networkLabel[row.network]||row.network}</p><p className="text-[10px] text-muted-foreground">{row.period_start} → {row.period_end}</p></div><Badge variant={score>=70?"default":"outline"}>{row.demand_signal}</Badge></div>
            <div className="mt-4 flex items-end justify-between"><div><p className="text-3xl font-black">{score}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">demand / 100</p></div><p className="text-xs font-bold text-muted-foreground">{bestWindow(row.best_times)}</p></div>
            <Progress value={score} className="mt-3 h-2"/>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Tiny label="views" value={fmt(metrics.views)}/><Tiny label="reach" value={fmt(metrics.reach)}/><Tiny label="interactions" value={fmt(metrics.interactions)}/>
              <Tiny label="shares" value={fmt(metrics.shares)}/><Tiny label="comments" value={fmt(metrics.comments)}/><Tiny label="followers" value={fmt(metrics.followers)}/>
            </div>
          </CardContent>
        </Card>;
      })}
    </div>

    <Tabs defaultValue="performance">
      <TabsList className="flex h-auto flex-wrap gap-1">
        <TabsTrigger value="performance">Published content performance</TabsTrigger>
        <TabsTrigger value="founder-queue">Founder posting queue</TabsTrigger>
        <TabsTrigger value="timing">Best posting windows</TabsTrigger>
      </TabsList>

      <TabsContent value="performance" className="mt-4 space-y-5">
        {snapshots.map((snapshot)=>{
          const items=Array.isArray(snapshot.top_content)?snapshot.top_content:[];
          if(items.length===0)return null;
          return <section key={snapshot.id}>
            <div className="mb-3 flex items-center justify-between"><div><h3 className="font-black">{networkLabel[snapshot.network]||snapshot.network} content</h3><p className="text-xs text-muted-foreground">Exact content previews where the platform exposes media metadata; otherwise an analytics summary.</p></div><Badge variant="outline">{Math.round(n(snapshot.demand_score))}/100 demand</Badge></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.slice(0,9).map((item:any,index:number)=><PublishedPreview key={item.url||item.post_url||item.video_url||`${snapshot.id}-${index}`} network={snapshot.network} item={item}/>)}
            </div>
          </section>;
        })}
        {!loading&&snapshots.every((row)=>!Array.isArray(row.top_content)||row.top_content.length===0)&&<Empty text="No post-level content is currently available from the connected social analytics sources."/>}
      </TabsContent>

      <TabsContent value="founder-queue" className="mt-4">
        {posts.length===0?<Empty text="Luna has no founder-ready social drafts waiting right now."/>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{posts.map((post)=><PreparedPreview key={post.id} post={post}/>)}</div>}
      </TabsContent>

      <TabsContent value="timing" className="mt-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{snapshots.map((row)=><Card key={row.id}><CardHeader className="pb-2"><CardTitle className="text-base">{networkLabel[row.network]||row.network}</CardTitle></CardHeader><CardContent className="space-y-2">{(row.best_times||[]).slice(0,5).map((time:any,index:number)=><div key={index} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm"><span><CalendarClock className="mr-2 inline h-4 w-4 text-primary"/>{dayNames[Number(time.day_of_week)%7]||`Day ${time.day_of_week}`} · {String(Number(time.hour||0)).padStart(2,"0")}:00</span><Badge variant="outline">{fmt(time.value)}</Badge></div>)}{(!row.best_times||row.best_times.length===0)&&<p className="text-xs text-muted-foreground">Not enough timing data yet.</p>}</CardContent></Card>)}</div>
      </TabsContent>
    </Tabs>
  </div>;
}

function PublishedPreview({network,item}:{network:string;item:any}){
  const url=item.url||item.post_url||item.video_url||item.shareurl||null;
  const image=item.thumbnail_url||item.thumbnail||item.cover_image||item.coverimageurl||item.image_url||null;
  const text=item.description||item.caption||item.content||item.topic||item.title||"Published social content";
  return <Card className="overflow-hidden rounded-[22px]">
    {image&&<div className="aspect-[4/3] overflow-hidden bg-muted"><img src={image} alt="" className="h-full w-full object-cover" loading="lazy"/></div>}
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-2"><Badge variant="outline">{networkLabel[network]||network}</Badge><span className="text-[10px] text-muted-foreground">{item.date||item.published_at||""}</span></div>
      <p className="mt-3 line-clamp-4 text-sm font-semibold leading-5">{text}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Tiny label="views" value={fmt(item.views)}/><Tiny label="likes" value={fmt(item.likes)}/><Tiny label="shares" value={fmt(item.shares)}/><Tiny label="reach" value={fmt(item.reach)}/><Tiny label="comments" value={fmt(item.comments)}/><Tiny label="saves" value={fmt(item.saves)}/></div>
      {url&&<Button variant="outline" size="sm" className="mt-4 w-full" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4"/>Open exact post</a></Button>}
    </CardContent>
  </Card>;
}

function PreparedPreview({post}:{post:PreparedPost}){
  const hashtags=Array.isArray(post.payload?.hashtags)?post.payload.hashtags.join(" "):"";
  return <Card className="rounded-[22px]">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2"><div><Badge>{networkLabel[post.network]||post.network}</Badge><Badge variant="outline" className="ml-1">{post.status}</Badge></div><Badge variant="secondary">Manual</Badge></div>
      <h3 className="mt-3 font-black">{post.title||"Untitled draft"}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{post.caption||"No caption generated."}</p>
      {hashtags&&<p className="mt-3 text-xs font-semibold text-primary">{hashtags}</p>}
      {post.payload?.asset_brief&&<div className="mt-4 rounded-xl bg-muted/45 p-3"><p className="text-[10px] font-black uppercase tracking-wide">Asset brief</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{post.payload.asset_brief}</p></div>}
      <div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline"><Send className="mr-1 h-3 w-3"/>Founder posts</Badge>{post.payload?.metricool_demand_score!==undefined&&<Badge variant="outline"><BarChart3 className="mr-1 h-3 w-3"/>{Math.round(n(post.payload.metricool_demand_score))}/100 social demand</Badge>}</div>
      {post.payload?.target_url&&<Button variant="outline" size="sm" className="mt-4 w-full" asChild><a href={post.payload.target_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4"/>Open tracked destination</a></Button>}
    </CardContent>
  </Card>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Tiny({label,value}:{label:string;value:string}){return <div className="rounded-lg bg-muted/45 p-2"><p className="text-sm font-black">{value}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>;}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed p-8 text-center"><PlaySquare className="mx-auto h-6 w-6 text-muted-foreground"/><p className="mt-2 text-sm font-semibold">{text}</p></div>;}
