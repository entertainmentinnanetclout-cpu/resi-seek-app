import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bot, CheckCircle2, ExternalLink, Inbox, Mail, RefreshCw, ShieldCheck, Sparkles, UserRoundCheck, Workflow, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Counts = { runs: number; enquiries: number; emailMessages: number; outbox: number; approvals: number; errors: number };
const phaseNames: Record<number, string> = {
  0: "Governance & control foundation",
  1: "Unified CRM & identity",
  2: "Workflow engine",
  3: "Konnect Agent core",
  4: "Internal enquiries",
  5: "Email agent",
};

export default function AdminOSReleaseTwoContent() {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>({ runs: 0, enquiries: 0, emailMessages: 0, outbox: 0, approvals: 0, errors: 0 });
  const [progress, setProgress] = useState<any>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [emailThreads, setEmailThreads] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [progressRes, agentRes, runRes, enquiryRes, emailRes, outboxRes, approvalRes, integrationRes] = await Promise.all([
      (supabase as any).from("platform_settings").select("value").eq("key", "adminos_release_progress").maybeSingle(),
      (supabase as any).from("adminos_agent_config").select("*").in("agent_key", ["konnect_agent", "internal_enquiries", "email_agent"]).order("agent_key"),
      (supabase as any).from("adminos_agent_runs").select("*").eq("agent_key", "konnect_agent").order("started_at", { ascending: false }).limit(30),
      (supabase as any).from("adminos_enquiry_threads").select("*").order("last_message_at", { ascending: false }).limit(30),
      (supabase as any).from("adminos_email_threads").select("*").order("last_message_at", { ascending: false }).limit(30),
      (supabase as any).from("adminos_email_outbox").select("*").order("created_at", { ascending: false }).limit(30),
      (supabase as any).from("adminos_approval_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(30),
      (supabase as any).from("adminos_integration_connections").select("*").in("provider", ["openai", "lovable_ai_gateway", "gmail"]).order("display_name"),
    ]);
    const error = progressRes.error || agentRes.error || runRes.error || enquiryRes.error || emailRes.error || outboxRes.error || approvalRes.error || integrationRes.error;
    if (error) toast.error(error.message || "Could not load AdminOS Release 2");
    setProgress(progressRes.data?.value || {});
    setAgents(agentRes.data || []);
    setRuns(runRes.data || []);
    setEnquiries(enquiryRes.data || []);
    setEmailThreads(emailRes.data || []);
    setOutbox(outboxRes.data || []);
    setApprovals(approvalRes.data || []);
    setIntegrations(integrationRes.data || []);

    const [runCount, enquiryCount, emailCount, outboxCount, approvalCount, errorCount] = await Promise.all([
      (supabase as any).from("adminos_agent_runs").select("id", { count: "exact", head: true }).eq("agent_key", "konnect_agent"),
      (supabase as any).from("adminos_enquiry_threads").select("id", { count: "exact", head: true }),
      (supabase as any).from("adminos_email_messages").select("id", { count: "exact", head: true }),
      (supabase as any).from("adminos_email_outbox").select("id", { count: "exact", head: true }),
      (supabase as any).from("adminos_approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      (supabase as any).from("adminos_agent_errors").select("id", { count: "exact", head: true }).eq("resolved", false),
    ]);
    setCounts({
      runs: runCount.count || 0,
      enquiries: enquiryCount.count || 0,
      emailMessages: emailCount.count || 0,
      outbox: outboxCount.count || 0,
      approvals: approvalCount.count || 0,
      errors: errorCount.count || 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invoke = async (name: string, body: any) => {
    const { data, error } = await (supabase.functions as any).invoke(name, { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const runAction = async (key: string, action: () => Promise<any>, success: (data: any) => string) => {
    setWorking(key);
    try {
      const data = await action();
      toast.success(success(data));
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Action failed");
    } finally { setWorking(null); }
  };

  const toggleAgent = async (agent: any, enabled: boolean) => {
    const { error } = await (supabase as any).from("adminos_agent_config").update({ enabled }).eq("id", agent.id);
    if (error) return toast.error(error.message);
    setAgents((prev) => prev.map((x) => x.id === agent.id ? { ...x, enabled } : x));
    toast.success(`${agent.display_name} ${enabled ? "enabled" : "paused"}`);
  };

  const decideApproval = async (id: string, decision: "approved" | "rejected") => {
    await runAction(`approval:${id}:${decision}`, async () => {
      const { data, error } = await (supabase as any).rpc("adminos_decide_approval", { p_approval_id: id, p_decision: decision, p_note: `Decision from AdminOS Release 2 command centre` });
      if (error) throw error;
      return data;
    }, () => `Approval ${decision}`);
  };

  const completed = useMemo(() => [0,1,2,3,4,5].filter((p) => progress?.[`phase_${p}`] === "complete").length, [progress]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1"><Bot className="h-3.5 w-3.5" />RESKONNECT ADMINOS</Badge>
              <Badge variant="outline">Release Gate 2</Badge>
              <Badge variant="secondary">Phases 3–5</Badge>
              <Badge variant={progress?.release_status === "complete" ? "default" : "outline"}>{progress?.release_status || "loading"}</Badge>
            </div>
            <h2 className="mt-4 text-2xl font-black sm:text-3xl">Reason. Answer. Email. Escalate safely.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Release 2 activates the controlled Konnect reasoning core, authenticated in-app enquiries and the Gmail email agent while preserving human approval for sensitive communications. WhatsApp and voice remain outside this gate.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void runAction("agent-health", () => invoke("adminos-agent", { action: "health" }), (d) => `Agent healthy via ${d.primary || d.fallback || "configured provider"}`)} disabled={working === "agent-health"}><Sparkles />Test AI</Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[0,1,2,3,4,5].map((phase) => <PhaseCard key={phase} phase={phase} name={phaseNames[phase]} status={progress?.[`phase_${phase}`] || (phase < 3 ? "complete" : "gate_running")} />)}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={Sparkles} label="Agent runs" value={counts.runs} />
        <Metric icon={Inbox} label="Enquiry threads" value={counts.enquiries} />
        <Metric icon={Mail} label="Email messages" value={counts.emailMessages} />
        <Metric icon={Workflow} label="Email outbox" value={counts.outbox} />
        <Metric icon={ShieldCheck} label="Pending approvals" value={counts.approvals} danger={counts.approvals > 0} />
        <Metric icon={AlertTriangle} label="Agent errors" value={counts.errors} danger={counts.errors > 0} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agent">Agent Core</TabsTrigger>
          <TabsTrigger value="enquiries">Enquiries</TabsTrigger>
          <TabsTrigger value="email">Email Agent</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <ReleaseCard icon={Sparkles} title="Phase 3 of 11" text="Konnect Agent uses a versioned prompt/policy layer, trusted database context, knowledge entries, model routing, token/cost telemetry, risk grading and automatic human escalation." />
            <ReleaseCard icon={UserRoundCheck} title="Phase 4 of 11" text="ResBot now authenticates account-specific questions, stores enquiry history, prevents cross-user access, answers green-risk questions automatically and generates staff tasks for uncertain/sensitive cases." />
            <ReleaseCard icon={Mail} title="Phase 5 of 11" text="Gmail sync maps senders to CRM contacts, imports threads, drafts AI replies, auto-sends green-risk replies when connected, and routes amber/red drafts through the approval queue." />
          </div>
          <Card><CardHeader><CardTitle>Release boundary</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
            <Boundary ok title="Enabled in Release 2" items={["Konnect reasoning core", "OpenAI Luna/Terra routing with managed AI fallback", "Authenticated internal enquiries", "Enquiry escalation tasks", "Gmail read/send/sync engine", "Email AI drafting", "Green-risk email auto-send", "Amber/red approval gate", "Agent usage and cost telemetry"]} />
            <Boundary title="Still blocked" items={["WhatsApp automation — Phase 6", "Follow-up Autopilot — Phase 7", "Company document automation — Phase 8", "Prospect CRM/Sales agent — Phase 9", "AI voice calling — Phase 10", "Application approval/rejection by AI", "Financial or legal commitments by AI"]} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="agent" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">{agents.map((agent) => (
            <Card key={agent.id}><CardHeader><CardTitle className="flex items-center justify-between gap-3 text-base"><span>{agent.display_name}</span><Switch checked={!!agent.enabled} onCheckedChange={(v) => void toggleAgent(agent, v)} /></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Authority</span><Badge variant="outline">{agent.authority_level}</Badge></div><div className="flex justify-between"><span className="text-muted-foreground">Confidence gate</span><strong>{Math.round(Number(agent.confidence_threshold || 0) * 100)}%</strong></div><p className="text-xs text-muted-foreground">Phase {agent.config?.phase} · Release {agent.config?.release}</p></CardContent></Card>
          ))}</div>
          <Card><CardHeader><CardTitle>Recent Konnect Agent runs</CardTitle></CardHeader><CardContent className="p-0">{runs.length === 0 ? <Empty text="No agent runs yet." /> : <div className="divide-y">{runs.map((run) => <div key={run.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{run.trigger_type}</p><p className="text-xs text-muted-foreground">{new Date(run.started_at).toLocaleString("en-ZA")}</p></div><StatusBadge status={run.status} /></div>)}</div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="enquiries">
          <Card><CardHeader><CardTitle>Internal enquiry queue</CardTitle></CardHeader><CardContent className="p-0">{enquiries.length === 0 ? <Empty text="No Release 2 enquiry threads yet." /> : <div className="divide-y">{enquiries.map((thread) => <div key={thread.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{thread.subject || "ResKonnect enquiry"}</p><p className="mt-1 text-xs text-muted-foreground">{thread.application_id ? `Application ${thread.application_id.slice(0,8)}` : "General support"} · {new Date(thread.last_message_at).toLocaleString("en-ZA")}</p></div><div className="flex gap-2"><Badge variant="outline">{thread.priority}</Badge><StatusBadge status={thread.status} /></div></div></div>)}</div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-3"><span>Gmail control</span><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void runAction("gmail-test", () => invoke("adminos-email-agent", { action: "test" }), (d) => `Gmail connected: ${d.email}`)} disabled={working === "gmail-test"}>Test mailbox</Button><Button size="sm" onClick={() => void runAction("gmail-sync", () => invoke("adminos-email-agent", { action: "sync", max_results: 15 }), (d) => `Synced ${d.imported} new messages; ${d.auto_sent} auto-replies sent`)} disabled={working === "gmail-sync"}>Sync & process</Button></div></CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">When Gmail credentials are connected, sync imports recent mail, resolves CRM identities, creates AI drafts, sends green-risk routine replies automatically and routes sensitive replies to Approvals.</p></CardContent></Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Recent email threads</CardTitle></CardHeader><CardContent className="p-0">{emailThreads.length === 0 ? <Empty text="No Gmail threads imported yet." /> : <div className="divide-y">{emailThreads.map((thread) => <div key={thread.id} className="p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{thread.subject || "(no subject)"}</p><p className="mt-1 text-xs text-muted-foreground">{thread.last_message_at ? new Date(thread.last_message_at).toLocaleString("en-ZA") : "No timestamp"}</p></div><StatusBadge status={thread.status} /></div></div>)}</div>}</CardContent></Card>
            <Card><CardHeader><CardTitle>AI email outbox</CardTitle></CardHeader><CardContent className="p-0">{outbox.length === 0 ? <Empty text="No AI email drafts yet." /> : <div className="divide-y">{outbox.map((item) => <div key={item.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold truncate">{item.subject}</p><p className="mt-1 text-xs text-muted-foreground">To {item.to_email} · {item.risk_level} · confidence {item.confidence == null ? "—" : `${Math.round(Number(item.confidence) * 100)}%`}</p></div><div className="flex items-center gap-2"><StatusBadge status={item.status} />{item.status === "draft" && <Button size="sm" onClick={() => void runAction(`send:${item.id}`, () => invoke("adminos-email-agent", { action: "send_outbox", outbox_id: item.id }), () => "Email sent")}>Send</Button>}</div></div></div>)}</div>}</CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          <Card><CardHeader><CardTitle>Human approval queue</CardTitle></CardHeader><CardContent className="p-0">{approvals.length === 0 ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto h-9 w-9" /><p className="mt-3 font-bold">No pending approvals</p><p className="mt-1 text-sm text-muted-foreground">Green-risk actions can continue automatically; sensitive actions remain blocked until approved.</p></div> : <div className="divide-y">{approvals.map((a) => <div key={a.id} className="p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap gap-2"><Badge variant={a.risk_level === "red" ? "destructive" : "outline"}>{a.risk_level}</Badge><Badge variant="secondary">{a.request_type}</Badge></div><p className="mt-2 font-bold">{a.title}</p><p className="mt-1 text-sm text-muted-foreground">{a.summary}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void decideApproval(a.id, "rejected")} disabled={working?.startsWith(`approval:${a.id}`)}><XCircle />Reject</Button><Button onClick={() => void decideApproval(a.id, "approved")} disabled={working?.startsWith(`approval:${a.id}`)}><CheckCircle2 />Approve</Button></div></div></div>)}</div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card><CardHeader><CardTitle>3-step secure API setup</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-3"><SetupStep n="1" title="Create / authorise" text="Open the official provider console from AdminOS." /><SetupStep n="2" title="Add server secrets" text="Store credentials as Supabase Edge Function secrets; never in browser storage or public tables." /><SetupStep n="3" title="Test & activate" text="Use the production health/test action; AdminOS records connection health and account identity." /></div></CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-3">{integrations.map((item) => <Card key={item.id}><CardHeader><CardTitle className="text-base">{item.display_name}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between"><StatusBadge status={item.status} /><Badge variant="outline">Step {item.setup_step}/3</Badge></div>{item.external_account_label && <p className="text-sm font-medium">{item.external_account_label}</p>}<p className="text-xs text-muted-foreground">Phase {item.config?.phase} · Release {item.config?.release || 2}</p><div className="flex flex-wrap gap-2">{item.setup_url && <Button size="sm" variant="outline" asChild><a href={item.setup_url} target="_blank" rel="noreferrer">Setup <ExternalLink /></a></Button>}{item.docs_url && <Button size="sm" variant="ghost" asChild><a href={item.docs_url} target="_blank" rel="noreferrer">Guide <ExternalLink /></a></Button>}</div></CardContent></Card>)}</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PhaseCard({ phase, name, status }: { phase: number; name: string; status: string }) {
  const done = status === "complete";
  return <Card className={done ? "border-primary/30" : ""}><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><Badge variant="outline">{phase}/11</Badge>{done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Activity className="h-4 w-4 text-muted-foreground" />}</div><p className="mt-3 text-sm font-bold">{name}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{String(status).replaceAll("_", " ")}</p></CardContent></Card>;
}
function Metric({ icon: Icon, label, value, danger }: { icon: any; label: string; value: number; danger?: boolean }) {
  return <Card><CardContent className="p-4"><div className="flex items-center justify-between"><Icon className="h-4 w-4" /><span className={danger ? "text-destructive text-xl font-black" : "text-xl font-black"}>{value}</span></div><p className="mt-3 text-xs text-muted-foreground">{label}</p></CardContent></Card>;
}
function ReleaseCard({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>;
}
function Boundary({ ok, title, items }: { ok?: boolean; title: string; items: string[] }) {
  return <div className="rounded-2xl border p-4"><div className="flex items-center gap-2 font-bold">{ok ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{title}</div><div className="mt-3 space-y-2">{items.map((x) => <p key={x} className="text-sm text-muted-foreground">• {x}</p>)}</div></div>;
}
function SetupStep({ n, title, text }: { n: string; title: string; text: string }) {
  return <div className="rounded-2xl border p-4"><Badge>{n}</Badge><p className="mt-3 font-bold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>;
}
function StatusBadge({ status }: { status: string }) {
  const destructive = ["failed", "error", "blocked", "red"].includes(status);
  return <Badge variant={destructive ? "destructive" : status === "succeeded" || status === "connected" || status === "resolved" || status === "sent" ? "default" : "outline"}>{String(status || "unknown").replaceAll("_", " ")}</Badge>;
}
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>; }
