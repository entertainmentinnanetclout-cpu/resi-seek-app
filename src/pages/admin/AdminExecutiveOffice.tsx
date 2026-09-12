import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, BriefcaseBusiness, ClipboardCheck, Plus, RefreshCw, Sparkles, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Task={id:string;title:string;description?:string|null;priority:string;status:string;assigned_staff_id?:string|null;due_at?:string|null;next_action?:string|null;created_at:string};
type Staff={id:string;full_name:string|null};

export default function AdminExecutiveOffice(){
  const[brief,setBrief]=useState<any>(null);
  const[alerts,setAlerts]=useState<any[]>([]);
  const[approvals,setApprovals]=useState<any[]>([]);
  const[tasks,setTasks]=useState<Task[]>([]);
  const[staff,setStaff]=useState<Staff[]>([]);
  const[loading,setLoading]=useState(true);
  const[open,setOpen]=useState(false);
  const[draft,setDraft]=useState({title:"",description:"",priority:"normal",due_at:"",assigned_staff_id:"unassigned"});

  const load=useCallback(async()=>{
    setLoading(true);
    const [briefR,alertsR,approvalsR,tasksR,profilesR,rolesR]=await Promise.all([
      (supabase as any).from("adminos_executive_briefs").select("*").order("generated_at",{ascending:false}).limit(1).maybeSingle(),
      (supabase as any).from("adminos_executive_alerts").select("*").neq("status","resolved").order("created_at",{ascending:false}).limit(30),
      (supabase as any).from("adminos_approval_requests").select("*").eq("status","pending").order("created_at",{ascending:false}).limit(30),
      (supabase as any).from("staff_tasks").select("*").in("status",["open","in_progress","waiting"]).order("due_at",{ascending:true}).limit(100),
      (supabase as any).from("profiles").select("id,full_name").limit(500),
      (supabase as any).from("user_roles").select("user_id,role"),
    ]);
    if(briefR.error)console.warn(briefR.error);
    if(alertsR.error)console.warn(alertsR.error);
    if(approvalsR.error)console.warn(approvalsR.error);
    if(tasksR.error)console.warn(tasksR.error);
    setBrief(briefR.data||null);setAlerts(alertsR.data||[]);setApprovals(approvalsR.data||[]);setTasks(tasksR.data||[]);
    const staffIds=new Set((rolesR.data||[]).filter((r:any)=>["admin","operations_lead","commerce_lead","growth_lead","system_operator","tvet_lead","support_agent"].includes(String(r.role))).map((r:any)=>r.user_id));
    setStaff((profilesR.data||[]).filter((p:any)=>staffIds.has(p.id)));
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const staffName=(id?:string|null)=>staff.find((s)=>s.id===id)?.full_name||"Unassigned";
  const openTasks=tasks.length;
  const highPriority=tasks.filter((task)=>["high","urgent","critical"].includes(task.priority)).length;

  const createTask=async()=>{
    if(!draft.title.trim())return toast.error("Task title is required");
    const {error}=await(supabase as any).from("staff_tasks").insert({
      title:draft.title.trim(),description:draft.description.trim()||null,priority:draft.priority,status:"open",
      due_at:draft.due_at?new Date(draft.due_at).toISOString():null,
      assigned_staff_id:draft.assigned_staff_id==="unassigned"?null:draft.assigned_staff_id,
      next_action:"Executive delegation",
      tags:["executive","delegated"],
    });
    if(error)return toast.error(error.message||"Could not create task");
    toast.success("Executive task delegated");
    setOpen(false);setDraft({title:"",description:"",priority:"normal",due_at:"",assigned_staff_id:"unassigned"});await load();
  };

  const patchTask=async(id:string,patch:Record<string,unknown>)=>{
    const{error}=await(supabase as any).from("staff_tasks").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);
    if(error)return toast.error(error.message||"Could not update task");
    await load();
  };

  return <AdminLayout>
    <SEO noIndex title="Executive Office | ResKonnect Admin" description="Strategy, planning, delegation, approvals and executive performance."/>
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="flex flex-wrap gap-2"><Badge>Executive Office</Badge><Badge variant="outline">Strategy · Planning · Delegation</Badge></div><h1 className="mt-3 text-3xl font-black tracking-tight">Executive Office</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Company-wide priorities, strategic briefs, approvals, delegated work and exception management. Departments execute; the Executive Office sets direction and resolves escalation.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button>
          <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/>Delegate task</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Executive delegation</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Task</Label><Input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})}/></div><div><Label>Description</Label><Textarea value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})}/></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Priority</Label><Select value={draft.priority} onValueChange={(v)=>setDraft({...draft,priority:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div><div><Label>Assign to</Label><Select value={draft.assigned_staff_id} onValueChange={(v)=>setDraft({...draft,assigned_staff_id:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{staff.map((s)=><SelectItem key={s.id} value={s.id}>{s.full_name||"Staff account"}</SelectItem>)}</SelectContent></Select></div></div><div><Label>Due</Label><Input type="datetime-local" value={draft.due_at} onChange={(e)=>setDraft({...draft,due_at:e.target.value})}/></div></div><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button onClick={()=>void createTask()}>Delegate</Button></DialogFooter></DialogContent></Dialog>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={Target} label="Open priorities" value={openTasks}/>
        <Metric icon={AlertTriangle} label="High-priority tasks" value={highPriority}/>
        <Metric icon={ClipboardCheck} label="Pending approvals" value={approvals.length}/>
        <Metric icon={Sparkles} label="Executive alerts" value={alerts.length}/>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap gap-1"><TabsTrigger value="overview">Strategy brief</TabsTrigger><TabsTrigger value="delegation">Delegation</TabsTrigger><TabsTrigger value="approvals">Approvals</TabsTrigger><TabsTrigger value="alerts">Escalations</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5"/>Latest executive brief</CardTitle></CardHeader><CardContent>{brief?<div className="space-y-3"><div><p className="text-xl font-black">{brief.headline||"Executive brief"}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{brief.summary||"No narrative summary."}</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{brief.brief_date||"Latest"}</Badge><Badge variant="outline">{brief.provider||"system"} · {brief.model||"deterministic"}</Badge></div>{Array.isArray(brief.priorities)&&brief.priorities.length>0&&<div className="grid gap-2 md:grid-cols-2">{brief.priorities.slice(0,8).map((item:any,index:number)=><div key={index} className="rounded-xl border p-3 text-sm">{typeof item==="string"?item:item?.title||item?.summary||JSON.stringify(item)}</div>)}</div>}</div>:<p className="text-sm text-muted-foreground">No executive brief has been generated yet.</p>}</CardContent></Card>
        </TabsContent>
        <TabsContent value="delegation">
          <Card><CardHeader><CardTitle>Department execution queue</CardTitle></CardHeader><CardContent className="space-y-2">{tasks.length===0?<p className="py-8 text-center text-sm text-muted-foreground">No open delegated tasks.</p>:tasks.map((task)=><div key={task.id} className="grid gap-3 rounded-xl border p-3 lg:grid-cols-[minmax(0,1fr)_180px_160px] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{task.title}</p><Badge variant="outline">{task.priority}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{task.description||task.next_action||"No description"} · {task.due_at?new Date(task.due_at).toLocaleString("en-ZA"):"No due date"}</p></div><Select value={task.assigned_staff_id||"unassigned"} onValueChange={(v)=>void patchTask(task.id,{assigned_staff_id:v==="unassigned"?null:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{staff.map((s)=><SelectItem key={s.id} value={s.id}>{s.full_name||"Staff account"}</SelectItem>)}</SelectContent></Select><Select value={task.status} onValueChange={(v)=>void patchTask(task.id,{status:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select><p className="lg:col-span-3 text-[10px] text-muted-foreground">Owner: {staffName(task.assigned_staff_id)}</p></div>)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="approvals"><Card><CardHeader><CardTitle>Founder / executive approvals</CardTitle></CardHeader><CardContent className="space-y-2">{approvals.length===0?<p className="py-8 text-center text-sm text-muted-foreground">No pending approvals.</p>:approvals.map((item:any)=><div key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.summary}</p></div><Badge variant={item.risk_level==="red"?"destructive":"outline"}>{item.risk_level}</Badge></div></div>)}</CardContent></Card></TabsContent>
        <TabsContent value="alerts"><Card><CardHeader><CardTitle>Executive escalations</CardTitle></CardHeader><CardContent className="space-y-2">{alerts.length===0?<p className="py-8 text-center text-sm text-muted-foreground">No unresolved executive alerts.</p>:alerts.map((item:any)=><div key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></div><Badge variant={item.severity==="critical"?"destructive":"outline"}>{item.severity}</Badge></div></div>)}</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-2xl font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
