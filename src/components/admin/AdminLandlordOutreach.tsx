import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Clock3, Megaphone, RefreshCw, Send, ShieldCheck, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Campaign = {
  id:string; name:string; campaign_type:string; status:string; template_key:string; message:string;
  recipient_count:number; eligible_count:number; sent_count:number; failed_count:number; scheduled_at?:string|null; created_at:string;
};
type Recipient = {
  id:string; contact_name?:string|null; phone?:string|null; email?:string|null; eligible:boolean; eligibility_reason?:string|null; status:string; sent_at?:string|null; metadata?:any;
};

const defaultMessage = "We help student-accommodation operators reach verified demand, manage enquiries faster and convert interested students through ResKonnect. We would like to discuss whether your property is a fit for our accommodation network.";

export default function AdminLandlordOutreach(){
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [recipients,setRecipients]=useState<Recipient[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState<string|null>(null);
  const [name,setName]=useState("Landlord partnership outreach");
  const [type,setType]=useState("proposal");
  const [message,setMessage]=useState(defaultMessage);
  const [scheduledAt,setScheduledAt]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const db=supabase as any;

  const selected=useMemo(()=>campaigns.find((c)=>c.id===selectedId)||null,[campaigns,selectedId]);
  const blocked=useMemo(()=>recipients.filter((r)=>!r.eligible).length,[recipients]);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const result=await db.from("adminos_landlord_outreach_campaigns").select("*").order("created_at",{ascending:false}).limit(50);
      if(result.error)throw result.error;
      const rows=(result.data||[]) as Campaign[];setCampaigns(rows);setSelectedId((cur)=>cur&&rows.some((r)=>r.id===cur)?cur:rows[0]?.id||null);
    }catch(error:any){toast.error(error?.message||"Could not load landlord outreach");}finally{setLoading(false);}
  },[]);

  const loadRecipients=useCallback(async(id:string|null)=>{
    if(!id){setRecipients([]);return;}
    const result=await db.from("adminos_landlord_outreach_recipients").select("*").eq("campaign_id",id).order("eligible",{ascending:false}).order("created_at",{ascending:true}).limit(1000);
    if(result.error){toast.error(result.error.message);return;}setRecipients(result.data||[]);
  },[]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{void loadRecipients(selectedId);},[selectedId,loadRecipients]);

  const createCampaign=async()=>{
    if(!name.trim()||!message.trim())return toast.error("Campaign name and proposal message are required");
    setWorking("create");
    try{
      const auth=await supabase.auth.getUser();
      const result=await db.from("adminos_landlord_outreach_campaigns").insert({name:name.trim(),campaign_type:type,message:message.trim(),scheduled_at:scheduledAt?new Date(scheduledAt).toISOString():null,created_by:auth.data.user?.id||null,template_key:"rk_landlord_outreach_v1"}).select("*").single();
      if(result.error)throw result.error;
      setSelectedId(result.data.id);toast.success("Landlord campaign created");await load();
    }catch(error:any){toast.error(error?.message||"Could not create campaign");}finally{setWorking(null);}
  };

  const buildRecipients=async()=>{
    if(!selected)return;
    setWorking("recipients");
    try{
      const result=await db.rpc("adminos_build_landlord_campaign_recipients",{p_campaign_id:selected.id});
      if(result.error)throw result.error;
      toast.success(`${result.data?.eligible_count||0} consented WhatsApp contacts are eligible`);
      await Promise.all([load(),loadRecipients(selected.id)]);
    }catch(error:any){toast.error(error?.message||"Could not build recipient list");}finally{setWorking(null);}
  };

  const queueCampaign=async()=>{
    if(!selected||!confirmed)return toast.error("Confirm the consent-only outreach rule before queueing");
    if(!selected.eligible_count)return toast.error("Build recipients first. Only opted-in landlord contacts can be queued.");
    setWorking("queue");
    try{
      const result=await db.rpc("adminos_queue_landlord_campaign",{p_campaign_id:selected.id});
      if(result.error)throw result.error;
      toast.success(`${Number(result.data||0)} eligible landlord WhatsApp messages queued`);
      setConfirmed(false);await Promise.all([load(),loadRecipients(selected.id)]);
    }catch(error:any){toast.error(error?.message||"Could not queue landlord outreach");}finally{setWorking(null);}
  };

  return <section className="space-y-4 overflow-hidden">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">Landlord Outreach</h2><Badge className="gap-1 rounded-full"><ShieldCheck className="h-3 w-3"/>Consent enforced</Badge></div><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Build prospecting or partnership campaigns from your landlord CRM. WhatsApp sends are automatically restricted to contacts with WhatsApp + marketing permission and are stopped for opted-out contacts.</p></div><Button variant="outline" className="w-full rounded-full sm:w-auto" onClick={()=>void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button></div>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
      <Card className="min-w-0 overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5"/>Create outreach</CardTitle></CardHeader><CardContent className="min-w-0 space-y-3">
        <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Campaign name" className="w-full"/>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2"><Select value={type} onValueChange={setType}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="prospecting">Prospecting</SelectItem><SelectItem value="proposal">Proposal</SelectItem><SelectItem value="follow_up">Follow-up</SelectItem><SelectItem value="partnership">Partnership</SelectItem></SelectContent></Select><Input type="datetime-local" value={scheduledAt} onChange={(e)=>setScheduledAt(e.target.value)} className="w-full"/></div>
        <Textarea value={message} onChange={(e)=>setMessage(e.target.value)} className="min-h-32 resize-y" placeholder="Partnership proposition"/>
        <p className="text-[11px] leading-5 text-muted-foreground">This message becomes the proposal variable inside the approved ResKonnect landlord outreach template. Keep it factual and concise; recipients can reply YES or STOP.</p>
        <Button className="w-full sm:w-auto" onClick={()=>void createCampaign()} disabled={working==="create"}><Building2 className="h-4 w-4"/>Create campaign</Button>
      </CardContent></Card>

      <Card className="min-w-0 overflow-hidden"><CardHeader><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="min-w-0 truncate">Campaign control</CardTitle><Select value={selectedId||"none"} onValueChange={(v)=>setSelectedId(v==="none"?null:v)}><SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select campaign"/></SelectTrigger><SelectContent><SelectItem value="none">Select campaign</SelectItem>{campaigns.map((c)=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div></CardHeader><CardContent className="min-w-0 space-y-4">
        {selected?<><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric value={selected.recipient_count} label="Discovered"/><Metric value={selected.eligible_count} label="Eligible"/><Metric value={selected.sent_count} label="Sent"/><Metric value={selected.failed_count} label="Blocked / failed"/></div>
        <div className="rounded-2xl border bg-muted/25 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black">{selected.name}</p><p className="mt-1 text-xs text-muted-foreground">{selected.campaign_type.replaceAll("_"," ")} · {selected.status}</p></div>{selected.scheduled_at&&<Badge variant="outline" className="gap-1"><Clock3 className="h-3 w-3"/>{new Date(selected.scheduled_at).toLocaleString("en-ZA")}</Badge>}</div><p className="mt-3 break-words text-xs leading-5">{selected.message}</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" className="w-full sm:w-auto" onClick={()=>void buildRecipients()} disabled={working==="recipients"}><UsersRound className="h-4 w-4"/>Build eligible recipients</Button><Button className="w-full sm:w-auto" onClick={()=>void queueCampaign()} disabled={working==="queue"||!confirmed}><Send className="h-4 w-4"/>Queue eligible only</Button></div>
        <label className="flex cursor-pointer items-start gap-2 rounded-2xl border p-3 text-xs leading-5"><input type="checkbox" checked={confirmed} onChange={(e)=>setConfirmed(e.target.checked)} className="mt-1"/><span><strong>Consent-only rule:</strong> I understand that contacts without explicit WhatsApp marketing permission remain blocked and will not receive this prospecting/proposal campaign.</span></label>
        </>:<p className="py-10 text-center text-sm text-muted-foreground">Create or select a landlord campaign.</p>}
      </CardContent></Card>
    </div>

    {selected&&<Card className="min-w-0 overflow-hidden"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Recipient eligibility</CardTitle><div className="flex gap-2"><Badge variant="secondary">{recipients.filter((r)=>r.eligible).length} eligible</Badge><Badge variant="outline">{blocked} blocked</Badge></div></div></CardHeader><CardContent className="p-0"><div className="max-h-[420px] overflow-y-auto"><div className="divide-y">{recipients.length===0?<p className="p-8 text-center text-sm text-muted-foreground">Build recipients to audit your landlord CRM against WhatsApp marketing permissions.</p>:recipients.map((r)=><div key={r.id} className="grid min-w-0 gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-bold">{r.contact_name||r.metadata?.company_name||r.metadata?.property_name||r.phone||"Landlord contact"}</p><p className="mt-1 break-all text-xs text-muted-foreground">{[r.phone,r.metadata?.nearest_campus].filter(Boolean).join(" · ")}</p></div><div className="flex flex-wrap items-center gap-2 sm:justify-end">{r.eligible?<Badge className="gap-1"><CheckCircle2 className="h-3 w-3"/>Eligible</Badge>:<Badge variant="outline">{String(r.eligibility_reason||"blocked").replaceAll("_"," ")}</Badge>}<Badge variant="secondary">{r.status}</Badge></div></div>)}</div></div></CardContent></Card>}
  </section>;
}

function Metric({value,label}:{value:number;label:string}){return <div className="min-w-0 rounded-2xl border bg-background p-3 text-center"><p className="text-lg font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>;}
