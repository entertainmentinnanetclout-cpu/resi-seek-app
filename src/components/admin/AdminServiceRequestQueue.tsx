import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Headphones, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const label=(value:string)=>String(value||"").replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function AdminServiceRequestQueue({title="My ResKonnect service requests"}:{title?:string}){
  const[rows,setRows]=useState<any[]>([]);const[loading,setLoading]=useState(true);const[resolution,setResolution]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{setLoading(true);const{data,error}=await(supabase as any).from("student_requests").select("*").order("updated_at",{ascending:false}).limit(200);if(error)toast.error(error.message||"Could not load service requests");setRows(data||[]);setLoading(false);},[]);
  useEffect(()=>{void load();},[load]);

  const update=async(row:any,status:string)=>{
    const patch:any={status};
    const note=(resolution[row.id]||"").trim();
    if(note)patch.resolution_summary=note;
    const{error}=await(supabase as any).from("student_requests").update(patch).eq("id",row.id);
    if(error)return toast.error(error.message||"Could not update request");
    toast.success("Customer-visible request status updated");await load();
  };

  return <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Headphones className="h-5 w-5 text-primary"/>{title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Status changes are written to the student's Service Centre timeline and notification stream.</p></div><Button size="sm" variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button></div></CardHeader><CardContent>
    {loading?<div className="grid min-h-44 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>:rows.length===0?<div className="rounded-2xl border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500"/><p className="mt-2 font-bold">No service requests in your access scope</p></div>:<div className="space-y-3">{rows.map((row)=><div key={row.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Badge>{label(row.request_type)}</Badge><Badge variant="outline">{label(row.department_key)}</Badge><Badge variant={["resolved","completed","closed"].includes(String(row.status).toLowerCase())?"secondary":"default"}>{label(row.status)}</Badge></div><p className="mt-2 font-black">{row.subject||"Service request"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{row.description}</p></div><div className="text-right text-[10px] text-muted-foreground"><p>Created {new Date(row.created_at).toLocaleString("en-ZA")}</p>{row.due_at&&<p>Internal review target {new Date(row.due_at).toLocaleString("en-ZA")}</p>}</div></div><div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px]"><Input placeholder="Resolution / customer-facing note" value={resolution[row.id]??row.resolution_summary??""} onChange={(e)=>setResolution({...resolution,[row.id]:e.target.value})}/><Select value={row.status} onValueChange={(value)=>void update(row,value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="submitted">Submitted</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="waiting_customer">Waiting for customer</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div></div>)}</div>}
  </CardContent></Card>;
}
