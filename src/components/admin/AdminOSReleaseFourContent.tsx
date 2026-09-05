import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bot, BriefcaseBusiness, CheckCircle2, Flame, Phone, Play, RefreshCw, Search, ShieldCheck, Sparkles, Target, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type AnyRow = Record<string, any>;

export default function AdminOSReleaseFourContent() {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnyRow>({});
  const [prospects, setProspects] = useState<AnyRow[]>([]);
  const [calls, setCalls] = useState<AnyRow[]>([]);
  const [contacts, setContacts] = useState<AnyRow[]>([]);
  const [alerts, setAlerts] = useState<AnyRow[]>([]);
  const [briefs, setBriefs] = useState<AnyRow[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<AnyRow>({ enabled: false, ai_voice_enabled: false, marketing_calls_enabled: false });
  const [voiceHealth, setVoiceHealth] = useState<AnyRow>({});
  const [command, setCommand] = useState("What needs me today?");
  const [commandAnswer, setCommandAnswer] = useState("");
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineStage, setPipelineStage] = useState("all");
  const [callContactId, setCallContactId] = useState("");
  const [callPurpose, setCallPurpose] = useState("service");
  const [callMode, setCallMode] = useState("manual");

  const invoke = async (name: string, body: AnyRow) => {
    const { data, error } = await (supabase.functions as any).invoke(name, { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const run = async (key: string, fn: () => Promise<any>, success?: string | ((data: any) => string)) => {
    setWorking(key);
    try {
      const data = await fn();
      if (success) toast.success(typeof success === "function" ? success(data) : success);
      await load();
      return data;
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
      return null;
    } finally {
      setWorking(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s, q, c, a, b, v] = await Promise.all([
      (supabase as any).from("platform_settings").select("value").eq("key", "adminos_release_progress").maybeSingle(),
      (supabase as any).from("adminos_sales_pipeline_v").select("*").order("score", { ascending: false }).limit(250),
      (supabase as any).from("adminos_call_queue").select("*").order("created_at", { ascending: false }).limit(100),
      (supabase as any).from("adminos_contacts").select("id,full_name,email,phone,campus,status").eq("status", "active").order("updated_at", { ascending: false }).limit(250),
      (supabase as any).from("adminos_executive_alerts").select("*").neq("status", "resolved").order("updated_at", { ascending: false }).limit(100),
      (supabase as any).from("adminos_executive_briefs").select("*").order("created_at", { ascending: false }).limit(10),
      (supabase as any).from("platform_settings").select("value").eq("key", "adminos_voice_settings").maybeSingle(),
    ]);
    const err = p.error || s.error || q.error || c.error || a.error || b.error || v.error;
    if (err) toast.error(err.message || "Could not load AdminOS Release 4");
    setProgress(p.data?.value || {});
    setProspects(s.data || []);
    setCalls(q.data || []);
    setContacts(c.data || []);
    setAlerts(a.data || []);
    setBriefs(b.data || []);
    setVoiceSettings(v.data?.value || { enabled: false, ai_voice_enabled: false, marketing_calls_enabled: false });
    try {
      const vh = await invoke("adminos-voice", { action: "health" });
      setVoiceHealth(vh || {});
    } catch {
      setVoiceHealth({ software_ready: true, provider_configured: false, enabled: false, ai_voice_enabled: false });
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const filteredProspects = useMemo(() => prospects.filter((p) => {
    if (pipelineStage !== "all" && p.stage !== pipelineStage) return false;
    const q = pipelineSearch.trim().toLowerCase();
    if (!q) return true;
    return [p.full_name, p.email, p.phone, p.campus, p.stage].some((x) => String(x || "").toLowerCase().includes(q));
  }), [prospects, pipelineSearch, pipelineStage]);

  const hot = prospects.filter((p) => Number(p.score) >= 80 && !p.do_not_contact).length;
  const overdue = prospects.filter((p) => p.next_action_at && new Date(p.next_action_at).getTime() < Date.now() && !["converted", "onboarded", "lost", "not_interested", "invalid", "do_not_contact"].includes(p.stage)).length;
  const converted = prospects.filter((p) => ["converted", "onboarded"].includes(p.stage)).length;
  const activeCalls = calls.filter((x) => ["queued", "scheduled", "calling"].includes(x.status)).length;

  const updateStage = (prospectId: string, stage: string) => run(`stage:${prospectId}`, () => invoke("adminos-sales", { action: "update_stage", prospect_id: prospectId, stage }), `Prospect moved to ${stage.replaceAll("_", " ")}`);
  const rescoreAll = () => run("rescore", () => invoke("adminos-sales", { action: "rescore_all", limit: 5000 }), (d) => `Re-scored ${d?.result?.processed || 0} prospects`);
  const queueCall = () => run("queue-call", () => invoke("adminos-voice", { action: "queue_call", contact_id: callContactId, purpose: callPurpose, mode: callMode, reason: "Queued from AdminOS Release 4 command centre" }), "Call added to the queue");
  const makeAiCall = (queueId: string) => run(`ai-call:${queueId}`, () => invoke("adminos-voice", { action: "make_ai_call", queue_id: queueId }), "AI voice call started");
  const logManual = (queueId: string, outcome: string) => run(`manual:${queueId}`, () => invoke("adminos-voice", { action: "log_manual", queue_id: queueId, outcome }), `Manual call logged: ${outcome.replaceAll("_", " ")}`);
  const saveVoice = () => run("voice-settings", () => invoke("adminos-voice", { action: "set_voice_enabled", enabled: !!voiceSettings.enabled, ai_voice_enabled: !!voiceSettings.ai_voice_enabled, marketing_calls_enabled: !!voiceSettings.marketing_calls_enabled }), "Voice controls updated");
  const testVoice = () => run("voice-test", () => invoke("adminos-voice", { action: "test_provider" }), "Twilio Voice provider verified");
  const askExecutive = async () => {
    const data = await run("ask", () => invoke("adminos-executive", { action: "ask", command }), undefined);
    if (data?.answer) setCommandAnswer(data.answer);
  };
  const generateBrief = () => run("brief", () => invoke("adminos-executive", { action: "brief" }), "Executive brief generated");
  const acknowledge = (id: string) => run(`ack:${id}`, () => invoke("adminos-executive", { action: "ack_alert", alert_id: id }), "Alert acknowledged");

  return <div className="space-y-5">
    <section className="rounded-3xl border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap gap-2"><Badge className="gap-1"><Bot className="h-3.5 w-3.5"/>ADMINOS</Badge><Badge variant="outline">Final Release</Badge><Badge variant="secondary">Phases 9–11</Badge><Badge variant={progress.release_gate_4 === "complete" ? "default" : "outline"}>{progress.release_gate_4 || "running"}</Badge></div>
          <h2 className="mt-4 text-2xl font-black sm:text-3xl">Sell smarter. Call deliberately. Run by exception.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">The final AdminOS layer converts CRM activity into ranked action, keeps AI Voice disabled unless explicitly enabled, and gives leadership one executive exception queue instead of another admin workload.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""}/>Refresh</Button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-4"><Metric icon={Target} label="Prospects" value={prospects.length}/><Metric icon={Flame} label="Hot prospects" value={hot}/><Metric icon={Phone} label="Active call queue" value={activeCalls}/><Metric icon={ShieldCheck} label="Needs you" value={alerts.length}/></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3"><Phase n={9} status={progress.phase_9}/><Phase n={10} status={progress.phase_10}/><Phase n={11} status={progress.phase_11}/></div>
    </section>

    <Card className="border-primary/30"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/>Executive command</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="What needs me today?" onKeyDown={(e) => { if (e.key === "Enter") void askExecutive(); }}/><Button onClick={() => void askExecutive()} disabled={!command.trim() || working === "ask"}><Search/>Ask</Button><Button variant="outline" onClick={() => void generateBrief()} disabled={working === "brief"}><BriefcaseBusiness/>Generate brief</Button></div>{commandAnswer && <div className="rounded-2xl border bg-muted/30 p-4 text-sm leading-6">{commandAnswer}</div>}</CardContent></Card>

    <Tabs defaultValue="sales" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap gap-1"><TabsTrigger value="sales">Phase 9 · Sales CRM</TabsTrigger><TabsTrigger value="voice">Phase 10 · Calls & Voice</TabsTrigger><TabsTrigger value="executive">Phase 11 · Executive</TabsTrigger></TabsList>

      <TabsContent value="sales" className="space-y-4">
        <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>Prospect pipeline</span><Button size="sm" variant="outline" onClick={() => void rescoreAll()} disabled={working === "rescore"}><Activity/>Re-score all</Button></CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 sm:grid-cols-[1fr_220px]"><Input value={pipelineSearch} onChange={(e) => setPipelineSearch(e.target.value)} placeholder="Search prospect, email, phone or campus"/><Select value={pipelineStage} onValueChange={setPipelineStage}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All stages</SelectItem>{["new","contacted","qualified","interested","application_started","documents_pending","lease_pending","ready","approved","converted","onboarded","follow_up_later","not_interested","lost","do_not_contact"].map((s)=><SelectItem key={s} value={s}>{s.replaceAll("_"," ")}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 sm:grid-cols-3"><Mini label="Overdue next actions" value={overdue}/><Mini label="Converted / onboarded" value={converted}/><Mini label="Automation eligible" value={prospects.filter((p)=>p.automation_state === "eligible").length}/></div></CardContent></Card>
        <Card><CardContent className="p-0">{filteredProspects.length === 0 ? <Empty text="No prospects match this view."/> : <div className="divide-y">{filteredProspects.slice(0,100).map((p) => <div key={p.id} className="p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{p.full_name || p.email || p.phone || "Prospect"}</p><Badge variant={Number(p.score) >= 80 ? "default" : "outline"}>{Math.round(Number(p.score || 0))}/100</Badge><Badge variant="secondary">{p.temperature}</Badge>{p.do_not_contact && <Badge variant="destructive">Do not contact</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{[p.campus,p.email,p.phone,p.next_action].filter(Boolean).join(" · ") || "No contact context"}</p></div><Select value={p.stage} onValueChange={(v) => void updateStage(p.id,v)} disabled={working === `stage:${p.id}`}><SelectTrigger className="w-full lg:w-56"><SelectValue/></SelectTrigger><SelectContent>{["new","contacted","qualified","interested","application_started","documents_pending","lease_pending","ready","approved","converted","onboarded","follow_up_later","not_interested","invalid","lost","do_not_contact"].map((s)=><SelectItem key={s} value={s}>{s.replaceAll("_"," ")}</SelectItem>)}</SelectContent></Select></div></div>)}</div>}</CardContent></Card>
      </TabsContent>

      <TabsContent value="voice" className="space-y-4">
        <Card><CardHeader><CardTitle>Voice control</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Toggle label="Voice module" checked={!!voiceSettings.enabled} onChange={(v)=>setVoiceSettings((x)=>({...x,enabled:v}))}/><Toggle label="AI Voice" checked={!!voiceSettings.ai_voice_enabled} onChange={(v)=>setVoiceSettings((x)=>({...x,ai_voice_enabled:v}))}/><Toggle label="AI marketing calls" checked={!!voiceSettings.marketing_calls_enabled} onChange={(v)=>setVoiceSettings((x)=>({...x,marketing_calls_enabled:v}))}/></div><div className="flex flex-wrap items-center gap-2"><Button onClick={() => void saveVoice()} disabled={working === "voice-settings"}>Save controls</Button><Button variant="outline" onClick={() => void testVoice()} disabled={working === "voice-test"}>Test Twilio Voice</Button><Badge variant={voiceHealth.provider_configured ? "default" : "outline"}>{voiceHealth.provider_configured ? "Provider connected" : "Provider setup required"}</Badge><Badge variant="outline">AI Voice {voiceHealth.ai_voice_enabled ? "ON" : "standby / OFF"}</Badge></div><p className="text-xs text-muted-foreground">Manual calls remain primary. AI calls enforce channel permission, do-not-contact, marketing consent, quiet hours, daily limits and provider readiness before a call can start.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Queue a call</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]"><Select value={callContactId} onValueChange={setCallContactId}><SelectTrigger><SelectValue placeholder="Choose contact"/></SelectTrigger><SelectContent>{contacts.filter((c)=>c.phone).map((c)=><SelectItem key={c.id} value={c.id}>{c.full_name || c.phone}</SelectItem>)}</SelectContent></Select><Select value={callPurpose} onValueChange={setCallPurpose}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="service">Service</SelectItem><SelectItem value="application_followup">Application follow-up</SelectItem><SelectItem value="appointment">Appointment</SelectItem><SelectItem value="marketing">Marketing</SelectItem></SelectContent></Select><Select value={callMode} onValueChange={setCallMode}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="ai_voice">AI Voice</SelectItem></SelectContent></Select><Button onClick={() => void queueCall()} disabled={!callContactId || working === "queue-call"}><Phone/>Queue</Button></CardContent></Card>
        <Card><CardHeader><CardTitle>Call queue</CardTitle></CardHeader><CardContent className="p-0">{calls.length === 0 ? <Empty text="No calls are queued."/> : <div className="divide-y">{calls.map((q)=><div key={q.id} className="p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{q.mode}</Badge><Status value={q.status}/><Badge variant="secondary">{q.purpose.replaceAll("_"," ")}</Badge></div><p className="mt-2 font-semibold">{contactMap.get(q.contact_id)?.full_name || contactMap.get(q.contact_id)?.phone || "Contact"}</p><p className="text-xs text-muted-foreground">{q.recommended_reason || `Attempt ${q.attempt_count}/${q.max_attempts}`}</p></div><div className="flex flex-wrap gap-2">{q.mode === "ai_voice" && ["queued","scheduled"].includes(q.status) && <Button size="sm" onClick={() => void makeAiCall(q.id)} disabled={working===`ai-call:${q.id}`}><Play/>Start AI call</Button>}{q.mode === "manual" && ["queued","scheduled"].includes(q.status) && <><Button size="sm" variant="outline" onClick={()=>void logManual(q.id,"answered")}>Answered</Button><Button size="sm" variant="outline" onClick={()=>void logManual(q.id,"no_answer")}>No answer</Button><Button size="sm" variant="outline" onClick={()=>void logManual(q.id,"interested")}>Interested</Button></>}</div></div></div>)}</div>}</CardContent></Card>
      </TabsContent>

      <TabsContent value="executive" className="space-y-4">
        <Card><CardHeader><CardTitle>Needs Your Attention</CardTitle></CardHeader><CardContent className="p-0">{alerts.length === 0 ? <Empty text="No executive exceptions currently require intervention."/> : <div className="divide-y">{alerts.map((a)=><div key={a.id} className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex gap-2"><Badge variant={a.severity === "critical" || a.severity === "high" ? "destructive" : "outline"}>{a.severity}</Badge><Status value={a.status}/></div><p className="mt-2 font-semibold">{a.title}</p><p className="mt-1 text-sm text-muted-foreground">{a.description}</p></div>{a.status === "open" && <Button size="sm" variant="outline" onClick={() => void acknowledge(a.id)} disabled={working===`ack:${a.id}`}><UserCheck/>Acknowledge</Button>}</div></div>)}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Executive briefs</CardTitle></CardHeader><CardContent className="space-y-3">{briefs.length === 0 ? <Empty text="Generate the first executive brief above."/> : briefs.map((b)=><div key={b.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{b.brief_date}</Badge><Badge variant="secondary">{b.provider}</Badge></div><p className="mt-2 font-semibold">{b.headline}</p><p className="mt-1 text-sm text-muted-foreground">{b.summary}</p>{Array.isArray(b.recommendations) && b.recommendations.length>0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{b.recommendations.map((r:string,i:number)=><li key={i}>{r}</li>)}</ul>}</div>)}</CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:any}){return <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-2xl bg-muted p-2.5"><Icon className="h-5 w-5"/></div><div><p className="text-2xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>}
function Mini({label,value}:{label:string;value:any}){return <div className="rounded-2xl border p-3"><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>}
function Phase({n,status}:{n:number;status?:string}){const done=status==="complete";return <div className={`rounded-2xl border p-3 ${done?"border-primary/30":""}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">Phase {n}</span>{done?<CheckCircle2 className="h-4 w-4"/>:<Badge variant="outline">{status||"running"}</Badge>}</div></div>}
function Status({value}:{value:string}){return <Badge variant={["failed","blocked","critical"].includes(value)?"destructive":"outline"}>{String(value||"unknown").replaceAll("_"," ")}</Badge>}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <div className="flex items-center justify-between rounded-2xl border p-3"><Label>{label}</Label><Switch checked={checked} onCheckedChange={onChange}/></div>}
function Empty({text}:{text:string}){return <div className="p-6 text-center text-sm text-muted-foreground">{text}</div>}
