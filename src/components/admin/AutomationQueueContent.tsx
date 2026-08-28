import { useCallback, useEffect, useMemo, useState } from "react";
import { AlarmClock, CheckCircle2, RefreshCw, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AutomationQueueContent() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [scope, setScope] = useState("all");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    let q=(supabase as any).from("conversion_automation_tasks").select("*").eq("status","pending").order("due_at",{ascending:true,nullsFirst:false}).limit(300);
    if(scope!=="all") q=q.eq("owner_scope",scope);
    const {data,error}=await q; setLoading(false);
    if(error) return toast.error(error.message||"Could not load automation queue");
    setTasks(data||[]);
  },[scope]);
  useEffect(()=>{void load();},[load]);
  const overdue=useMemo(()=>tasks.filter(t=>t.due_at&&new Date(t.due_at).getTime()<Date.now()).length,[tasks]);
  const high=useMemo(()=>tasks.filter(t=>["high","urgent"].includes(t.priority)).length,[tasks]);
  const update=async(id:string,patch:Record<string,unknown>,message:string)=>{const {error}=await (supabase as any).from("conversion_automation_tasks").update(patch).eq("id",id);if(error)return toast.error(error.message);toast.success(message);void load();};
  return <div className="space-y-5">
    <div className="relative overflow-hidden rounded-3xl bg-[#071326] p-6 text-white shadow-xl"><div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#2563EB]/25 blur-3xl"/><div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap gap-2"><Badge className="bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]"><Zap className="mr-1 h-3 w-3"/>AUTOMATION OS</Badge><Badge variant="outline" className="border-white/25 text-white">90/10 exception model</Badge></div><h2 className="mt-4 text-3xl font-black">Human 10% Queue</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">Applications, 2027 reservations, creator assistance and residence quality automatically create and complete workflow tasks. Staff work only overdue, high-priority or verification exceptions.</p></div><div className="flex gap-2"><Select value={scope} onValueChange={setScope}><SelectTrigger className="w-44 border-white/20 bg-white/10 text-white"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All scopes</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="residence">Residence</SelectItem><SelectItem value="creator">Creator</SelectItem></SelectContent></Select><Button variant="hero" onClick={()=>void load()} disabled={loading}><RefreshCw className={loading?"animate-spin":""}/>Refresh</Button></div></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Pending exceptions" value={tasks.length}/><Metric label="Overdue" value={overdue} danger={overdue>0}/><Metric label="High priority" value={high} danger={high>0}/></div>
    <Card><CardHeader><CardTitle>Automation exception queue</CardTitle></CardHeader><CardContent className="p-0">{loading?<div className="p-10 text-center text-sm text-muted-foreground">Loading automated workflow…</div>:tasks.length===0?<div className="p-10 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600"/><p className="mt-3 font-black">No human intervention required</p><p className="mt-1 text-sm text-muted-foreground">The automated flow currently has no matching exceptions.</p></div>:<div className="divide-y">{tasks.map(task=>{const isOverdue=task.due_at&&new Date(task.due_at).getTime()<Date.now();return <div key={task.id} className="grid gap-3 p-4 lg:grid-cols-[1fr,180px,auto] lg:items-center"><div><div className="flex flex-wrap gap-2"><Badge variant={["high","urgent"].includes(task.priority)?"destructive":"outline"}>{String(task.priority).toUpperCase()}</Badge><Badge variant="secondary">{String(task.owner_scope).replaceAll("_"," ")}</Badge></div><p className="mt-2 font-black">{task.summary}</p><p className="mt-1 text-xs text-muted-foreground">{String(task.task_type).replaceAll("_"," ")} · {String(task.source_type).replaceAll("_"," ")}</p></div><div><p className="text-[11px] font-semibold uppercase text-muted-foreground">Due</p><p className={`mt-1 text-sm font-bold ${isOverdue?"text-destructive":""}`}>{task.due_at?new Date(task.due_at).toLocaleString("en-ZA"):"No deadline"}</p></div><div className="flex flex-wrap gap-2 lg:justify-end"><Button size="sm" variant="outline" onClick={()=>void update(task.id,{due_at:new Date(Date.now()+86400000).toISOString()},"Follow-up snoozed 24 hours")}>Snooze</Button><Button size="sm" onClick={()=>void update(task.id,{status:"completed",completed_at:new Date().toISOString()},"Exception completed")}>Mark done</Button></div></div>})}</div>}</CardContent></Card>
  </div>;
}
function Metric({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <Card><CardContent className="flex items-center justify-between p-4"><div><p className={`text-3xl font-black ${danger?"text-destructive":""}`}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div><div className={`rounded-xl p-2.5 ${danger?"bg-destructive/10 text-destructive":"bg-primary/10 text-primary"}`}>{danger?<AlarmClock className="h-5 w-5"/>:<Sparkles className="h-5 w-5"/>}</div></CardContent></Card>}
