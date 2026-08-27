import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { BarChart3, Link2, RefreshCw, Sparkles, Users } from "lucide-react";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ResidencePortalContext } from "./ResidenceLayout";

export default function ResidenceRecruitment() {
  const { residence } = useOutletContext<ResidencePortalContext>();
  const [program,setProgram] = useState<any>(null);
  const [summary,setSummary] = useState<any>({ recruiters:0,clicks:0,applications:0,placements:0 });
  const [message,setMessage] = useState("");
  const [saving,setSaving] = useState(false);
  const [loading,setLoading] = useState(true);

  const load = useCallback(async()=>{
    if(!residence?.id) return;
    setLoading(true);
    const [{data:p},{data:s}] = await Promise.all([
      (supabase as any).from("residence_recruitment_programs").select("*").eq("residence_id",residence.id).maybeSingle(),
      (supabase as any).rpc("residence_recruitment_summary",{p_residence_id:residence.id,p_days:30}),
    ]);
    setProgram(p || { enabled:false,commission_amount:200,bonus_target:10,bonus_amount:3000 });
    setMessage(p?.residence_message || "");
    setSummary(s || { recruiters:0,clicks:0,applications:0,placements:0 });
    setLoading(false);
  },[residence?.id]);

  useEffect(()=>{void load();},[load]);

  const setEnabled = async (enabled:boolean) => {
    if(!residence?.id) return;
    setSaving(true);
    const {error}=await (supabase as any).rpc("residence_portal_set_recruitment",{p_residence_id:residence.id,p_enabled:enabled,p_message:message || null});
    setSaving(false);
    if(error) return toast.error(error.message || "Could not update recruitment channel");
    toast.success(enabled ? "Residence opened to approved recruiters" : "Residence recruitment paused");
    await load();
  };

  const saveMessage = async()=>{
    if(!residence?.id) return;
    setSaving(true);
    const {error}=await (supabase as any).rpc("residence_portal_set_recruitment",{p_residence_id:residence.id,p_enabled:Boolean(program?.enabled),p_message:message || null});
    setSaving(false);
    if(error) return toast.error(error.message || "Could not save recruiter note");
    toast.success("Recruiter instructions saved");
    await load();
  };

  if(!residence || loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading recruitment channel…</div>;

  return <>
    <SEO noIndex title={`Recruitment Channel | ${residence.name} | ResKonnect`} description="Control approved recruiter access to this residence."/>
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-primary">Landlord Portal · Conversion Network</p><h1 className="mt-1 text-3xl font-black">Recruitment Channel</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Let approved ResKonnect recruiters choose this accommodation, receive a residence-specific tracked link and send qualified demand into the platform funnel. Student phone numbers and email addresses are not exposed here.</p></div><Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>

      <Card className={program?.enabled ? "border-primary/30 bg-primary/[0.025]" : ""}><CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/><p className="font-black">Approved recruiter marketplace</p>{program?.enabled ? <Badge>Live</Badge> : <Badge variant="secondary">Paused</Badge>}</div><p className="mt-2 max-w-2xl text-sm text-muted-foreground">When live, approved recruiters can select {residence.name} from their dashboard and generate a unique residence-specific recruitment link.</p></div><Switch checked={Boolean(program?.enabled)} disabled={saving} onCheckedChange={(v)=>void setEnabled(v)}/></CardContent></Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Users} label="Linked recruiters" value={summary?.recruiters || 0}/>
        <Metric icon={Link2} label="Tracked clicks · 30d" value={summary?.clicks || 0}/>
        <Metric icon={BarChart3} label="Applications · 30d" value={summary?.applications || 0}/>
        <Metric icon={Sparkles} label="Placements · 30d" value={summary?.placements || 0}/>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card><CardHeader><CardTitle>Recruiter briefing</CardTitle></CardHeader><CardContent className="space-y-3"><Label>What should recruiters know about this residence?</Label><Textarea rows={7} value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Example: Focus on 2027 first-years near Pretoria West. Singles are limited; sharing rooms have better availability."/><Button onClick={()=>void saveMessage()} disabled={saving}>{saving?"Saving…":"Save briefing"}</Button></CardContent></Card>
        <Card><CardHeader><CardTitle>Commercial rules</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex items-center justify-between rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Per verified placement</span><strong>R{Number(program?.commission_amount || 0).toLocaleString("en-ZA")}</strong></div><div className="flex items-center justify-between rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Bonus target</span><strong>{program?.bonus_target || 0} placements</strong></div><div className="flex items-center justify-between rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Bonus</span><strong>R{Number(program?.bonus_amount || 0).toLocaleString("en-ZA")}</strong></div><p className="text-xs leading-5 text-muted-foreground">Commercial amounts are platform-controlled. Residence portal users can enable/disable recruitment and publish operational guidance, but cannot alter recruiter payout rules.</p></CardContent></Card>
      </div>
    </div>
  </>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number}) {
  return <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4"/><span className="text-xs font-semibold">{label}</span></div><p className="mt-2 text-3xl font-black">{Number(value).toLocaleString("en-ZA")}</p></CardContent></Card>;
}
