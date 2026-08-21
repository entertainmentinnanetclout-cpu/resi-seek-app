import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, AlertTriangle, CheckCircle2, Globe2, Bot, Link2, Database, Activity } from "lucide-react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const pct = (a:number,b:number) => b ? Math.round((a/b)*100) : 0;

export default function AdminSEO(){
  const [summary,setSummary]=useState<any>(null);
  const [intents,setIntents]=useState<any[]>([]);
  const [audits,setAudits]=useState<any[]>([]);
  const [queue,setQueue]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const [s,i,a,q]=await Promise.all([
      supabase.rpc("seo_command_center_summary" as any),
      supabase.from("seo_search_intents" as any).select("id,pillar,cluster,intent,query_pattern,priority,target_path,status,updated_at").order("priority").limit(250),
      supabase.from("seo_audit_log" as any).select("id,path,audit_type,severity,message,created_at,resolved_at").is("resolved_at",null).order("created_at",{ascending:false}).limit(30),
      supabase.from("seo_index_queue" as any).select("id,path,action,status,attempts,last_error,queued_at,processed_at").order("queued_at",{ascending:false}).limit(30),
    ]);
    setSummary((s.data as any)||{}); setIntents((i.data as any[])||[]); setAudits((a.data as any[])||[]); setQueue((q.data as any[])||[]); setLoading(false);
  },[]);

  useEffect(()=>{load()},[load]);
  const coverage=useMemo(()=>pct(summary?.intents_covered||0,summary?.intents_total||0),[summary]);
  const submitIndexNow=async()=>{setSubmitting(true);try{await supabase.functions.invoke("seo-indexnow");await load()}finally{setSubmitting(false)}};
  const cards=[
    ["Search territory coverage",`${coverage}%`,Search],
    ["Indexable public pages",String(summary?.pages_indexable??0),Globe2],
    ["Critical intents uncovered",String(summary?.critical_intents_uncovered??0),AlertTriangle],
    ["Pending IndexNow queue",String(summary?.queue_pending??0),Activity],
    ["Published properties",String(summary?.properties_published??0),Database],
    ["Published opportunities",String(summary?.opportunities_published??0),Link2],
    ["Open critical audits",String(summary?.audit_critical_open??0),Bot],
  ];

  return <main className="min-h-screen bg-background p-4 text-foreground md:p-8"><SEO title="SEO Command Centre | ResKonnect Admin" description="Private ResKonnect search infrastructure command centre." noIndex/>
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold tracking-[0.2em] text-primary">GOLDEN SEARCH INFRASTRUCTURE</p><h1 className="mt-2 text-3xl font-black md:text-5xl">SEO Command Centre</h1><p className="mt-3 max-w-3xl text-muted-foreground">Traditional SEO, local search, programmatic coverage, AI-answer visibility, entity authority and indexing health in one operational view.</p></div><div className="flex gap-2"><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button><Button onClick={submitIndexNow} disabled={submitting||!summary?.queue_pending}>{submitting?"Submitting…":"Submit IndexNow queue"}</Button></div></div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="h-5 w-5 text-primary"/></div><p className="mt-3 text-3xl font-black">{value}</p></div>)}</section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Search territory map</h2><p className="mt-1 text-sm text-muted-foreground">Every important query family should resolve to a deliberate public destination.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">Target 100%</span></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-3 pr-4">Pillar</th><th className="pr-4">Search query</th><th className="pr-4">Intent</th><th className="pr-4">Priority</th><th className="pr-4">Target</th><th>Status</th></tr></thead><tbody>{intents.map((x)=><tr key={x.id} className="border-b border-border/60"><td className="py-3 pr-4 font-semibold capitalize">{x.pillar}</td><td className="pr-4">{x.query_pattern}</td><td className="pr-4 capitalize text-muted-foreground">{x.intent}</td><td className="pr-4 uppercase">{x.priority}</td><td className="pr-4 font-mono text-xs">{x.target_path||"—"}</td><td>{x.status==="covered"?<span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4"/>covered</span>:<span className="font-semibold text-amber-600">{x.status}</span>}</td></tr>)}</tbody></table></div></section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Indexing queue</h2><div className="mt-4 space-y-3">{queue.length?queue.map((x)=><div key={x.id} className="rounded-xl border border-border/70 p-4"><div className="flex justify-between gap-4"><code className="break-all text-xs">{x.path}</code><span className="text-xs font-bold uppercase">{x.status}</span></div><p className="mt-2 text-xs text-muted-foreground">{x.action} • attempts {x.attempts}</p>{x.last_error&&<p className="mt-2 text-xs text-destructive">{x.last_error}</p>}</div>):<p className="text-sm text-muted-foreground">No recent indexing events.</p>}</div></section>
      <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Open SEO audits</h2><div className="mt-4 space-y-3">{audits.length?audits.map((x)=><div key={x.id} className="rounded-xl border border-border/70 p-4"><div className="flex justify-between gap-4"><p className="font-semibold">{x.message}</p><span className={`text-xs font-bold uppercase ${x.severity==="critical"?"text-destructive":"text-amber-600"}`}>{x.severity}</span></div><p className="mt-2 text-xs text-muted-foreground">{x.path||"sitewide"} • {x.audit_type}</p></div>):<p className="text-sm text-muted-foreground">No open audit findings in the database.</p>}</div></section></div>
    </div>
  </main>;
}
