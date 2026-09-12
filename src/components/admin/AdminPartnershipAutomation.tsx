import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Clock3, FileSignature, Handshake, RefreshCw, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type LeadIntel={
  id:string;partner_lead_id:string;lead_type:string;source_status:string;lead_score:number;qualification_band:string;
  automation_state:string;next_best_action:string|null;priority:number;stale_days:number;consent_ready:boolean;metadata:Record<string,any>;
};
type Health={
  id:string;partner_id:string;relationship_score:number;health_band:string;automation_state:string;attributed_users:number;
  conversions_30d:number;value_30d:number;days_since_activity:number;next_best_action:string|null;priority:number;metadata:Record<string,any>;
};
type Draft={
  id:string;source_type:string;source_id:string;purpose:string;channel:string;subject:string|null;body:string;risk_level:string;
  requires_executive_approval:boolean;approval_status:string;status:string;metadata:Record<string,any>;updated_at:string;
};

const label=(value:string)=>String(value||"").replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function AdminPartnershipAutomation(){
  const[leads,setLeads]=useState<LeadIntel[]>([]);
  const[health,setHealth]=useState<Health[]>([]);
  const[drafts,setDrafts]=useState<Draft[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);
  const[working,setWorking]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const[l,h,d]=await Promise.all([
      (supabase as any).from("adminos_partnership_lead_intelligence").select("*").order("priority",{ascending:false}).order("lead_score",{ascending:false}).limit(250),
      (supabase as any).from("adminos_partnership_relationship_health").select("*").order("priority",{ascending:false}).order("relationship_score",{ascending:true}).limit(250),
      (supabase as any).from("adminos_partnership_followup_drafts").select("*").order("updated_at",{ascending:false}).limit(250),
    ]);
    if(l.error)toast.error(l.error.message||"Could not load partner lead intelligence");
    if(h.error)toast.error(h.error.message||"Could not load relationship health");
    if(d.error)toast.error(d.error.message||"Could not load partnership drafts");
    setLeads(l.data||[]);setHealth(h.data||[]);setDrafts(d.data||[]);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const runNow=async()=>{
    setRunning(true);
    const{data,error}=await(supabase as any).rpc("adminos_run_rg10_now");
    setRunning(false);
    if(error)return toast.error(error.message||"RG10 cycle failed");
    toast.success("Partnerships cycle complete · "+Number(data?.relationships_refreshed||0)+" relationships refreshed");
    await load();
  };

  const approve=async(id:string,approved:boolean)=>{
    setWorking(id);
    const{error}=await(supabase as any).rpc("adminos_approve_partnership_draft",{p_id:id,p_approve:approved});
    setWorking(null);
    if(error)return toast.error(error.message||"Executive approval could not be applied");
    toast.success(approved?"Draft approved for manual use":"Draft rejected");
    await load();
  };

  const stats=useMemo(()=>({
    leads:leads.length,
    hot:leads.filter((x)=>x.qualification_band==="hot").length,
    relationships:health.length,
    attention:health.filter((x)=>["follow_up","executive_review"].includes(x.automation_state)).length,
    attributed:health.reduce((s,x)=>s+Number(x.attributed_users||0),0),
    conversions:health.reduce((s,x)=>s+Number(x.conversions_30d||0),0),
    pending:drafts.filter((x)=>x.approval_status==="pending").length,
    approved:drafts.filter((x)=>x.approval_status==="approved").length,
  }),[leads,health,drafts]);

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap gap-2"><Badge>RG10</Badge><Badge variant="outline">Partnerships Agent</Badge><Badge variant="outline">No autonomous external send</Badge></div>
        <h2 className="mt-3 text-2xl font-black">Partnership Automation</h2>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Synchronises partner enquiries into the AdminOS contact/prospect graph, measures relationship health and attribution, prepares factual follow-ups, and routes commitments through Executive approval. Contracts, pricing, exclusivity and institutional commitments remain human-only.</p>
      </div>
      <div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button><Button onClick={()=>void runNow()} disabled={running}><Sparkles className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG10</Button></div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric icon={Target} label="Partner leads" value={stats.leads}/>
      <Metric icon={Sparkles} label="Hot leads" value={stats.hot}/>
      <Metric icon={Handshake} label="Relationships" value={stats.relationships}/>
      <Metric icon={Clock3} label="Need attention" value={stats.attention}/>
      <Metric icon={Target} label="Attributed users" value={stats.attributed}/>
      <Metric icon={CheckCircle2} label="30d conversions" value={stats.conversions}/>
      <Metric icon={FileSignature} label="Drafts pending" value={stats.pending}/>
      <Metric icon={ShieldCheck} label="Drafts approved" value={stats.approved}/>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card className="rounded-[22px]"><CardHeader><CardTitle>Relationship health</CardTitle></CardHeader><CardContent className="space-y-3">
        {health.length===0?<Empty text="No partnership relationships are registered."/>:health.map((row)=><div key={row.id} className="rounded-2xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-black">{row.metadata?.partner_name||"Partner"}</p><p className="text-xs text-muted-foreground">{label(row.metadata?.partnership_type||"strategic")} · {row.days_since_activity} day(s) since measured activity</p></div><div className="flex gap-1"><Badge variant={row.health_band==="healthy"?"default":"outline"}>{label(row.health_band)}</Badge><Badge variant="secondary">{row.relationship_score}/100</Badge></div></div>
          <Progress value={row.relationship_score} className="mt-3 h-2"/>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center"><Tiny label="Attributed" value={row.attributed_users}/><Tiny label="30d conversions" value={row.conversions_30d}/><Tiny label="30d value" value={"R"+Number(row.value_30d||0).toLocaleString("en-ZA")}/></div>
          <p className="mt-3 text-xs font-semibold">{row.next_best_action||"Continue monitoring."}</p>
        </div>)}
      </CardContent></Card>

      <Card className="rounded-[22px]"><CardHeader><CardTitle>Partner lead intelligence</CardTitle></CardHeader><CardContent className="space-y-3">
        {leads.length===0?<Empty text="No raw partner leads currently require qualification."/>:leads.map((row)=><div key={row.id} className="rounded-2xl border p-4">
          <div className="flex flex-wrap gap-2"><Badge>{label(row.lead_type)}</Badge><Badge variant="outline">{label(row.source_status)}</Badge><Badge variant={row.qualification_band==="hot"?"default":"secondary"}>{label(row.qualification_band)}</Badge>{row.consent_ready&&<Badge variant="outline">Consent ready</Badge>}</div>
          <div className="mt-3 flex items-end justify-between"><div><p className="text-sm font-black">{row.metadata?.organisation_name||"Partner lead"}</p><p className="text-xs text-muted-foreground">Stale {row.stale_days} day(s)</p></div><strong>{row.lead_score}/100</strong></div>
          <Progress value={row.lead_score} className="mt-2 h-2"/><p className="mt-3 text-xs font-semibold">{row.next_best_action}</p>
        </div>)}
      </CardContent></Card>
    </div>

    <Card className="rounded-[22px]"><CardHeader><CardTitle>Approval-gated partnership drafts</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="rounded-2xl border bg-muted/30 p-3 text-xs text-muted-foreground"><strong className="text-foreground">Control:</strong> RG10 may prepare these drafts but cannot send them. Executive approval changes a draft to ready for manual use; it does not transmit the message or bind ResKonnect.</div>
      {drafts.length===0?<Empty text="No partnership follow-up drafts have been generated."/>:drafts.map((draft)=><div key={draft.id} className="rounded-2xl border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge variant={draft.risk_level==="red"?"destructive":"outline"}>{label(draft.risk_level)} risk</Badge><Badge variant="secondary">{label(draft.approval_status)}</Badge><Badge variant="outline">{label(draft.channel)}</Badge></div><p className="mt-2 font-black">{draft.subject||label(draft.purpose)}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{draft.body}</p></div>
          <div className="flex shrink-0 gap-2">{draft.approval_status==="pending"&&<><Button size="sm" variant="outline" onClick={()=>void approve(draft.id,false)} disabled={working===draft.id}>Reject</Button><Button size="sm" onClick={()=>void approve(draft.id,true)} disabled={working===draft.id}><ShieldCheck className="mr-2 h-4 w-4"/>Executive approve</Button></>}</div>
        </div>
      </div>)}
    </CardContent></Card>
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number|string}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{typeof value==="number"?value.toLocaleString("en-ZA"):value}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Tiny({label,value}:{label:string;value:number|string}){return <div className="rounded-xl bg-muted/40 p-2"><p className="text-sm font-black">{value}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>;}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">{text}</div>;}
