import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Task={
  id:string;title:string;description:string|null;priority:string;status:string;due_at:string|null;next_action:string|null;
  tags:string[];metadata:Record<string,any>;department_key:string|null;created_at:string;
};

export default function AdminDepartmentTaskQueue({departmentKey,title="Department automation queue"}:{departmentKey:string;title?:string}){
  const[rows,setRows]=useState<Task[]>([]);
  const[loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    const{data,error}=await(supabase as any).from("staff_tasks").select("*").eq("department_key",departmentKey).in("status",["open","in_progress","waiting"]).order("priority",{ascending:false}).order("due_at",{ascending:true}).limit(200);
    if(error)toast.error(error.message||"Could not load department tasks");
    setRows(data||[]);setLoading(false);
  },[departmentKey]);

  useEffect(()=>{void load();},[load]);

  const patch=async(id:string,status:string)=>{
    const{error}=await(supabase as any).from("staff_tasks").update({status,updated_at:new Date().toISOString()}).eq("id",id);
    if(error)return toast.error(error.message||"Could not update task");
    toast.success(status==="completed"?"Task completed":"Task updated");
    await load();
  };

  return <Card className="rounded-[22px]">
    <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary"/>{title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Agent-created exceptions and departmental handoffs only. Routine cases stay automated.</p></div><Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button></div></CardHeader>
    <CardContent>
      {loading?<p className="py-8 text-center text-sm text-muted-foreground">Loading tasks…</p>:rows.length===0?<div className="rounded-2xl border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500"/><p className="mt-2 text-sm font-bold">No open department exceptions</p></div>:<div className="space-y-2">{rows.map((task)=><div key={task.id} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{task.title}</p><Badge variant={task.priority==="urgent"?"destructive":"outline"}>{task.priority}</Badge>{(task.tags||[]).slice(0,3).map((tag)=><Badge key={tag} variant="secondary" className="text-[9px]">{tag}</Badge>)}</div><p className="mt-1 text-xs text-muted-foreground">{task.description||task.next_action||"Department action required"}{task.due_at?" · Due "+new Date(task.due_at).toLocaleString("en-ZA"):""}</p></div><Select value={task.status} onValueChange={(value)=>void patch(task.id,value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="waiting">Waiting</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>)}</div>}
    </CardContent>
  </Card>;
}
