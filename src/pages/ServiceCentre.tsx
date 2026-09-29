import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, Clock3, Headphones, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const requestTypes=[
  ["living","Living / accommodation"],
  ["application","Applications / study"],
  ["opportunity","Bursary / WIL / opportunity"],
  ["account","My account / profile"],
  ["technical","Technical problem"],
  ["other","Other ResKonnect service"],
] as const;
const label=(value:string)=>String(value||"").replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function ServiceCentre(){
  const[data,setData]=useState<any>({open_count:0,requests:[]});
  const[loading,setLoading]=useState(true);
  const[submitting,setSubmitting]=useState(false);
  const[loadError,setLoadError]=useState<string|null>(null);
  const[type,setType]=useState("living");
  const[subject,setSubject]=useState("");
  const[description,setDescription]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    setLoadError(null);
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    try{
      const{data:payload,error}=await(supabase as any).rpc("my_reskonnect_service_centre").abortSignal(controller.signal);
      if(error)throw error;
      setData(payload||{open_count:0,requests:[]});
    }catch(error:any){
      const message=controller.signal.aborted
        ?"Service Centre took too long to load. Check your connection and retry."
        :(error?.message||"Could not load Service Centre");
      setLoadError(message);
    }finally{
      window.clearTimeout(timeout);
      setLoading(false);
    }
  },[]);
  useEffect(()=>{
    void load();
    const reconnect=()=>void load();
    window.addEventListener("rk-reconnected",reconnect);
    return()=>window.removeEventListener("rk-reconnected",reconnect);
  },[load]);

  const submit=async()=>{
    if(subject.trim().length<4||description.trim().length<8)return toast.error("Add a clear subject and description.");
    setSubmitting(true);
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    try{
      const{error}=await(supabase as any).rpc("create_my_reskonnect_request",{
        p_request_type:type,p_subject:subject.trim(),p_description:description.trim(),
        p_related_entity_type:null,p_related_entity_id:null,p_source_surface:"service_centre",
      }).abortSignal(controller.signal);
      if(error)throw error;
      toast.success("Request submitted. You can track every status change here.");
      setSubject("");setDescription("");
      await load();
    }catch(error:any){
      toast.error(controller.signal.aborted?"Request timed out. Check your connection and try again.":(error?.message||"Could not submit request"));
    }finally{
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  };

  const rows=Array.isArray(data?.requests)?data.requests:[];

  return <DashboardLayout>
    <SEO noIndex title="My ResKonnect Service Centre" description="Create and track ResKonnect service requests with verified statuses and a visible activity history."/>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[30px] border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><Headphones className="h-5 w-5 text-primary"/><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">MY RESKONNECT SERVICE CENTRE</p></div><h1 className="mt-2 text-3xl font-black">Ask. Track. Resolve.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Submit one request and follow its real ResKonnect status instead of repeating the same issue across channels.</p></div><div className="rounded-2xl border bg-card px-5 py-3 text-center"><p className="text-2xl font-black">{Number(data?.open_count||0)}</p><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Open requests</p></div></div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary"/>Create a service request</CardTitle></CardHeader><CardContent className="space-y-4">
          <div><label className="text-xs font-bold">What do you need help with?</label><Select value={type} onValueChange={setType}><SelectTrigger className="mt-1.5"><SelectValue/></SelectTrigger><SelectContent>{requestTypes.map(([value,text])=><SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs font-bold">Subject</label><Input className="mt-1.5" value={subject} onChange={(e)=>setSubject(e.target.value)} maxLength={160} placeholder="e.g. I need help with my accommodation application"/></div>
          <div><label className="text-xs font-bold">Details</label><Textarea className="mt-1.5 min-h-32" value={description} onChange={(e)=>setDescription(e.target.value)} maxLength={4000} placeholder="Explain what happened, what you need, and any useful reference details."/></div>
          <Button className="w-full" onClick={()=>void submit()} disabled={submitting}>{submitting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Send className="mr-2 h-4 w-4"/>}Submit to ResKonnect</Button>
          <p className="text-[11px] leading-5 text-muted-foreground">ResKonnect routes the request to the responsible department. Internal review targets are operational targets, not guaranteed resolution times.</p>
        </CardContent></Card>

        <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Your requests</CardTitle><Button size="sm" variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button></div></CardHeader><CardContent>
          {loadError&&<div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"/><div><p className="text-sm font-bold">Service Centre needs a connection refresh</p><p className="mt-1 text-xs text-muted-foreground">{loadError}</p></div></div><Button size="sm" variant="outline" onClick={()=>void load()} disabled={loading}>Try again</Button></div>}
          {loading?<div className="grid min-h-52 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>:rows.length===0?<div className="rounded-2xl border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500"/><p className="mt-2 font-bold">No service requests yet</p><p className="mt-1 text-sm text-muted-foreground">When you need help, create one request here and track it from submission to resolution.</p></div>:<div className="space-y-3">{rows.map((row:any)=><div key={row.id} className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap gap-2"><Badge>{label(row.request_type)}</Badge><Badge variant={["resolved","closed","completed"].includes(String(row.status).toLowerCase())?"secondary":"outline"}>{label(row.status)}</Badge></div><h3 className="mt-2 font-black">{row.subject||"ResKonnect service request"}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{row.description}</p></div><p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(row.updated_at),{addSuffix:true})}</p></div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground"><span>Department: {label(row.department_key)}</span>{row.resolution_summary&&<span className="font-semibold text-foreground">Resolution: {row.resolution_summary}</span>}</div>
            {Array.isArray(row.timeline)&&row.timeline.length>0&&<div className="mt-4 border-t pt-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground">Activity</p><div className="space-y-2">{row.timeline.slice(0,5).map((event:any)=><div key={event.id} className="flex gap-2 text-xs"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"/><div><p className="font-semibold">{event.note||label(event.event_type)}</p><p className="text-[10px] text-muted-foreground">{new Date(event.created_at).toLocaleString("en-ZA")}</p></div></div>)}</div></div>}
          </div>)}</div>}
        </CardContent></Card>
      </div>
    </div>
  </DashboardLayout>;
}
