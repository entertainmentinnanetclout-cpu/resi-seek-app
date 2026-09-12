import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Health={
  application_id:string;user_id:string|null;score:number;health_band:string;missing_items:any[];components:Record<string,any>;
  stale_days:number;last_activity_at:string|null;next_action_type:string|null;next_action_url:string|null;automation_state:string;last_reminder_at:string|null;calculated_at:string;
};
type App={
  application_id:string;student_name:string|null;student_email:string|null;student_number:string|null;residence_name:string|null;
  residence_campus:string|null;application_status:string;academic_year:number;academic_cycle:string;academic_period:number;study_level:string;student_stage:string;
};
type Task={id:string;source_id:string;task_type:string;status:string;priority:string;summary:string;due_at:string|null;payload:Record<string,any>};

const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function AdminApplicationOperationsPanel(){
  const[health,setHealth]=useState<Health[]>([]);
  const[apps,setApps]=useState<App[]>([]);
  const[tasks,setTasks]=useState<Task[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);
  const[filter,setFilter]=useState("all");

  const load=useCallback(async()=>{
    setLoading(true);
    const[h,a,t]=await Promise.all([
      (supabase as any).from("adminos_application_health_scores").select("*").order("score",{ascending:true}).limit(600),
      (supabase as any).from("admin_applications_safe").select("application_id,student_name,student_email,student_number,residence_name,residence_campus,application_status,academic_year,academic_cycle,academic_period,study_level,student_stage").limit(600),
      (supabase as any).from("conversion_automation_tasks").select("*").eq("source_type","application").in("task_type",["application_human_review","application_stale_review"]).order("due_at",{ascending:true}).limit(300),
    ]);
    if(h.error)toast.error(h.error.message||"Could not load application health");
    if(a.error)toast.error(a.error.message||"Could not load applications");
    if(t.error)toast.error(t.error.message||"Could not load application automation tasks");
    setHealth(h.data||[]);setApps(a.data||[]);setTasks(t.data||[]);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const runNow=async()=>{
    setRunning(true);
    const{data,error}=await(supabase as any).rpc("adminos_run_rg7_now");
    setRunning(false);
    if(error)return toast.error(error.message||"RG7 cycle failed");
    toast.success("Application Operations cycle complete · "+Number(data?.applications_recalculated||0)+" applications recalculated");
    await load();
  };

  const appById=useMemo(()=>Object.fromEntries(apps.map((a)=>[a.application_id,a])),[apps]);
  const taskByApp=useMemo(()=>{
    const out:Record<string,Task[]>={};
    for(const task of tasks){(out[task.source_id] ||= []).push(task);}
    return out;
  },[tasks]);

  const stats=useMemo(()=>({
    total:health.length,
    avg:health.length?Math.round(health.reduce((s,h)=>s+Number(h.score||0),0)/health.length):0,
    ready:health.filter((h)=>h.health_band==="ready").length,
    incomplete:health.filter((h)=>h.health_band==="incomplete").length,
    attention:health.filter((h)=>h.health_band==="attention"||h.automation_state==="staff_attention").length,
    reminders:health.filter((h)=>Boolean(h.last_reminder_at)).length,
    tasks:tasks.filter((t)=>t.status==="pending").length,
  }),[health,tasks]);

  const rows=useMemo(()=>health.filter((h)=>{
    if(filter==="all")return true;
    if(filter==="staff")return h.automation_state==="staff_attention"||h.health_band==="blocked";
    if(filter==="customer")return h.automation_state==="customer_action";
    if(filter==="ready")return h.health_band==="ready";
    return h.health_band===filter;
  }),[health,filter]);

  const completeTask=async(task:Task)=>{
    const{error}=await(supabase as any).from("conversion_automation_tasks").update({status:"completed",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",task.id);
    if(error)return toast.error(error.message||"Could not close task");
    toast.success("Exception task closed");
    await load();
  };

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap gap-2"><Badge>RG7</Badge><Badge variant="outline">Application Operations Agent</Badge><Badge variant="outline">Approvals remain human-only</Badge></div>
        <h2 className="mt-3 text-2xl font-black">Application Health & Automation</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Every accommodation application receives a deterministic 0–100 health score. Customer-action cases get bounded reminders; stale/protected cases become staff exceptions. The agent never approves or rejects an application.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button>
        <Button onClick={()=>void runNow()} disabled={running}><Sparkles className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG7</Button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <Metric icon={FileCheck2} label="Scored" value={stats.total}/>
      <Metric icon={Sparkles} label="Average health" value={stats.avg+"/100"}/>
      <Metric icon={CheckCircle2} label="Ready" value={stats.ready}/>
      <Metric icon={AlertTriangle} label="Incomplete" value={stats.incomplete}/>
      <Metric icon={ShieldAlert} label="Attention" value={stats.attention}/>
      <Metric icon={Clock3} label="Reminded" value={stats.reminders}/>
      <Metric icon={ShieldAlert} label="Open staff tasks" value={stats.tasks}/>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-52"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All health states</SelectItem><SelectItem value="customer">Customer action</SelectItem><SelectItem value="staff">Staff attention</SelectItem><SelectItem value="ready">Ready</SelectItem><SelectItem value="incomplete">Incomplete</SelectItem><SelectItem value="attention">Attention</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select>
      <Badge variant="outline">Reminder batch max 25/cycle</Badge><Badge variant="outline">72h reminder cooldown</Badge>
    </div>

    <div className="space-y-3">
      {rows.slice(0,80).map((h)=>{
        const app=appById[h.application_id];
        const appTasks=(taskByApp[h.application_id]||[]).filter((t)=>t.status==="pending");
        const firstMissing=Array.isArray(h.missing_items)&&h.missing_items.length?h.missing_items[0]:null;
        return <Card key={h.application_id} className="rounded-[22px]">
          <CardContent className="p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px_260px] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Badge variant={h.health_band==="ready"?"default":h.health_band==="blocked"?"destructive":"secondary"}>{label(h.health_band)}</Badge><Badge variant="outline">{label(h.automation_state)}</Badge>{app&&<Badge variant="outline">{app.academic_year} · {label(app.academic_cycle)}{app.academic_period>0?" "+app.academic_period:""}</Badge>}</div>
                <p className="mt-2 truncate font-black">{app?.student_name||"Student"} · {app?.residence_name||"Residence not selected"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{app?.application_status?label(app.application_status):"Unknown status"} · {app?.residence_campus||"Campus not set"} · stale {h.stale_days||0} day(s)</p>
                <p className="mt-2 text-xs font-semibold">{firstMissing?.label||h.next_action_type?label(String(firstMissing?.label||h.next_action_type||"review_application")):"No customer blocker detected"}</p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs"><span>Health score</span><strong>{h.score}/100</strong></div>
                <Progress value={h.score} className="h-2"/>
                <p className="mt-2 text-[10px] text-muted-foreground">Last activity {h.last_activity_at?new Date(h.last_activity_at).toLocaleString("en-ZA"):"unknown"}{h.last_reminder_at?" · reminder "+new Date(h.last_reminder_at).toLocaleDateString("en-ZA"):""}</p>
              </div>
              <div className="space-y-2">
                {appTasks.length===0?<p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">No staff exception task.</p>:appTasks.map((task)=><div key={task.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><Badge variant={task.priority==="urgent"?"destructive":"outline"}>{task.priority}</Badge><Button size="sm" variant="outline" onClick={()=>void completeTask(task)}>Close task</Button></div><p className="mt-2 text-xs font-semibold">{task.summary}</p></div>)}
              </div>
            </div>
          </CardContent>
        </Card>;
      })}
      {!loading&&rows.length===0&&<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No application health records match this filter.</div>}
    </div>
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number|string}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{typeof value==="number"?value.toLocaleString("en-ZA"):value}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
