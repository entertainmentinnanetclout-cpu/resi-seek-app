import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CalendarClock, CheckCircle2, Filter, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ResidencePortalContext } from "./ResidenceLayout";

const STAGES=["new","contacted","viewing","documents","reserved","lease_pending","placed","lost"] as const;
const pretty=(value:string)=>value.replace(/_/g," ").replace(/\b\w/g,(m)=>m.toUpperCase());

export default function ResidenceCRM(){
  const {residence}=useOutletContext<ResidencePortalContext>();
  const [leads,setLeads]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [stage,setStage]=useState("all");
  const [saving,setSaving]=useState<string|null>(null);

  const load=useCallback(async()=>{if(!residence?.id)return;setLoading(true);const {data,error}=await (supabase as any).from("residence_portal_leads_safe").select("*").eq("residence_id",residence.id).order("created_at",{ascending:false});if(error)toast.error(error.message||"Could not load lead pipeline");else setLeads(data||[]);setLoading(false);},[residence?.id]);
  useEffect(()=>{void load();if(!residence?.id)return;const channel=supabase.channel(`residence-crm-${residence.id}`).on("postgres_changes",{event:"*",schema:"public",table:"residence_leads",filter:`residence_id=eq.${residence.id}`},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel);};},[residence?.id,load]);

  const filtered=useMemo(()=>leads.filter((lead)=>{if(stage!=="all"&&lead.stage!==stage)return false;const haystack=`${lead.contact_name||""} ${lead.funding_type||""} ${lead.room_preference||""} ${lead.academic_year||""}`.toLowerCase();return !query||haystack.includes(query.toLowerCase());}),[leads,query,stage]);
  const counts=useMemo(()=>STAGES.reduce((acc,key)=>({...acc,[key]:leads.filter((l)=>l.stage===key).length}),{} as Record<string,number>),[leads]);

  const updateLead=async(lead:any,patch:Record<string,any>)=>{setSaving(lead.id);const {error}=await (supabase as any).rpc("residence_portal_update_lead",{p_lead_id:lead.id,p_patch:patch});setSaving(null);if(error)return toast.error(error.message||"Could not update lead");toast.success("Lead updated");void load();};
  if(!residence)return <div className="py-16 text-center text-sm text-muted-foreground">Loading residence CRM…</div>;

  return <><SEO noIndex title={`Lead CRM | ${residence.name} | ResKonnect`} description={`Privacy-safe student accommodation lead pipeline for ${residence.name}.`}/><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-primary">Landlord Portal · Privacy-safe CRM</p><h1 className="mt-1 text-3xl font-black">Lead CRM</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Applications, reservations and recruitment demand flow into one operational pipeline without exposing direct student phone or email details.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button></div>
    <Card className="border-emerald-500/20 bg-emerald-500/[0.035]"><CardContent className="flex items-start gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"/><div><p className="text-sm font-bold">Contact privacy enforced server-side</p><p className="mt-1 text-xs leading-5 text-muted-foreground">The residence CRM is backed by a safe database view. Phone numbers and email addresses are not returned to residence portal users, even if the browser client is modified.</p></div></CardContent></Card>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">{STAGES.map((key)=><button key={key} type="button" onClick={()=>setStage(key)} className={`rounded-2xl border p-3 text-left transition ${stage===key?"border-primary bg-primary/5":"bg-card hover:border-primary/30"}`}><p className="text-2xl font-black">{counts[key]||0}</p><p className="mt-1 text-[11px] font-semibold text-muted-foreground">{pretty(key)}</p></button>)}</div>
    <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={(e)=>setQuery(e.target.value)} className="pl-9" placeholder="Search name, funding, room interest or intake…"/></div><Select value={stage} onValueChange={setStage}><SelectTrigger className="md:w-52"><Filter className="mr-2 h-4 w-4"/><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All stages</SelectItem>{STAGES.map((s)=><SelectItem key={s} value={s}>{pretty(s)}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    {loading?<Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading live leads…</CardContent></Card>:filtered.length===0?<Card><CardContent className="py-16 text-center"><Users className="mx-auto h-8 w-8 text-muted-foreground"/><p className="mt-3 font-bold">No leads in this view</p></CardContent></Card>:<div className="grid gap-4 xl:grid-cols-2">{filtered.map((lead)=><Card key={lead.id} className="overflow-hidden"><CardHeader className="border-b bg-muted/20 pb-4"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{lead.contact_name||"Prospective tenant"}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{pretty(lead.source_type||"lead")} · {lead.academic_year||"Current intake"}</p></div><Badge variant={lead.stage==="lost"?"destructive":lead.stage==="placed"?"default":"secondary"}>{pretty(lead.stage)}</Badge></div></CardHeader><CardContent className="space-y-4 p-4"><div className="grid gap-2 text-sm sm:grid-cols-2"><div className="rounded-xl bg-muted/35 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Funding</p><p className="mt-1 font-bold capitalize">{lead.funding_type||"Not specified"}</p></div><div className="rounded-xl bg-muted/35 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Room interest</p><p className="mt-1 font-bold">{lead.room_preference||"Not specified"}</p></div></div>{lead.next_follow_up_at&&<Badge variant="outline" className="gap-1"><CalendarClock className="h-3 w-3"/>{new Date(lead.next_follow_up_at).toLocaleDateString("en-ZA")}</Badge>}<div className="grid gap-3 md:grid-cols-[190px,1fr]"><Select value={lead.stage} onValueChange={(value)=>void updateLead(lead,{stage:value})} disabled={saving===lead.id}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{STAGES.map((s)=><SelectItem key={s} value={s}>{pretty(s)}</SelectItem>)}</SelectContent></Select><Textarea defaultValue={lead.admin_notes||""} placeholder="Internal follow-up note…" rows={2} onBlur={(e)=>{if(e.target.value!==(lead.admin_notes||""))void updateLead(lead,{admin_notes:e.target.value});}}/></div>{lead.stage==="placed"&&<div className="flex items-center gap-2 rounded-xl bg-primary/5 p-3 text-xs font-semibold"><CheckCircle2 className="h-4 w-4 text-primary"/>Placement completed — included in conversion analytics.</div>}</CardContent></Card>)}</div>}
  </div></>;
}