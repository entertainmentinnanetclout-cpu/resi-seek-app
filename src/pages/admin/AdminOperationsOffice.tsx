import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, ClipboardList, Home, Workflow } from "lucide-react";
import { AdminOnboardingHub } from "@/components/admin/onboarding/AdminOnboardingHubContent";
import AutomationQueueContent from "@/components/admin/AutomationQueueContent";
import AdminOSResidenceReadiness from "@/components/admin/AdminOSResidenceReadiness";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminOperationsOffice(){
  return <AdminLayout>
    <SEO noIndex title="Operations Office | ResKonnect Admin" description="Cross-company workflow execution, onboarding, task queues and operational readiness."/>
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap gap-2"><Badge>Operations Office</Badge><Badge variant="outline">Execution · Exceptions · Workflow</Badge></div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Operations Office</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Cross-company execution layer. Operations receives work from departments, handles exceptions and onboarding, clears automation queues and keeps operational readiness moving without becoming the owner of every specialist workflow.</p>
      </header>
      <Tabs defaultValue="tasks">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="tasks" className="gap-2"><ClipboardList className="h-4 w-4"/>Execution Queue</TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-2"><Activity className="h-4 w-4"/>Onboarding & Enquiries</TabsTrigger>
          <TabsTrigger value="automation" className="gap-2"><Workflow className="h-4 w-4"/>Automation Queue</TabsTrigger>
          <TabsTrigger value="readiness" className="gap-2"><Home className="h-4 w-4"/>Residence Readiness</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks"><OperationsTaskQueue/></TabsContent>
        <TabsContent value="onboarding"><AdminOnboardingHub/></TabsContent>
        <TabsContent value="automation"><AutomationQueueContent/></TabsContent>
        <TabsContent value="readiness"><AdminOSResidenceReadiness/></TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
}

function OperationsTaskQueue(){
  const[tasks,setTasks]=useState<any[]>([]);const[loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);const{data,error}=await(supabase as any).from("staff_tasks").select("*").in("status",["open","in_progress","waiting"]).order("priority",{ascending:false}).order("due_at",{ascending:true}).limit(200);if(error)toast.error(error.message||"Could not load staff task queue");setTasks(data||[]);setLoading(false);},[]);
  useEffect(()=>{void load();},[load]);
  const patch=async(id:string,status:string)=>{const{error}=await(supabase as any).from("staff_tasks").update({status,updated_at:new Date().toISOString()}).eq("id",id);if(error)return toast.error(error.message||"Could not update task");await load();};
  return <Card><CardHeader><CardTitle>Cross-department execution queue</CardTitle></CardHeader><CardContent>{loading?<p className="py-8 text-center text-sm text-muted-foreground">Loading execution queue…</p>:tasks.length===0?<p className="py-8 text-center text-sm text-muted-foreground">No operational tasks require action.</p>:<div className="space-y-2">{tasks.map((task)=><div key={task.id} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{task.title}</p><Badge variant={task.priority==="urgent"?"destructive":"outline"}>{task.priority}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{task.description||task.next_action||"Operational action"}{task.due_at?` · Due ${new Date(task.due_at).toLocaleString("en-ZA")}`:""}</p><div className="mt-2 flex flex-wrap gap-1">{(task.tags||[]).map((tag:string)=><Badge key={tag} variant="secondary" className="text-[9px]">{tag}</Badge>)}</div></div><Select value={task.status} onValueChange={(value)=>void patch(task.id,value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="waiting">Waiting</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>)}</div>}</CardContent></Card>;
}
