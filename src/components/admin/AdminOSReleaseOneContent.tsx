import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, ExternalLink, GitBranch, Network, RefreshCw, ShieldCheck, Users, Workflow, PlugZap, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Counts = {
  contacts: number;
  prospects: number;
  rules: number;
  jobs: number;
  approvals: number;
  integrations: number;
};

const phases = [
  { phase: 0, name: "Governance & control foundation", status: "complete" },
  { phase: 1, name: "Unified CRM & identity", status: "complete" },
  { phase: 2, name: "Workflow engine", status: "complete" },
  { phase: 3, name: "Konnect Agent core", status: "not_started" },
] as const;

const providerFallbacks = [
  { provider: "openai", name: "OpenAI", phase: 3, setup: "https://platform.openai.com/api-keys", docs: "https://platform.openai.com/docs" },
  { provider: "gmail", name: "Gmail / Google Workspace", phase: 5, setup: "https://console.cloud.google.com/apis/library/gmail.googleapis.com", docs: "https://developers.google.com/workspace/gmail/api/guides" },
  { provider: "twilio_whatsapp", name: "WhatsApp Business via Twilio", phase: 6, setup: "https://console.twilio.com/", docs: "https://www.twilio.com/docs/whatsapp" },
  { provider: "twilio_voice", name: "Twilio Voice", phase: 10, setup: "https://console.twilio.com/", docs: "https://www.twilio.com/docs/voice" },
];

export default function AdminOSReleaseOneContent() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>({ contacts: 0, prospects: 0, rules: 0, jobs: 0, approvals: 0, integrations: 0 });
  const [contacts, setContacts] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [contactsRes, prospectsRes, rulesRes, jobsRes, approvalsRes, integrationsRes] = await Promise.all([
      (supabase as any).from("adminos_contact_360").select("*").order("updated_at", { ascending: false }).limit(40),
      (supabase as any).from("adminos_prospects").select("*, adminos_contacts(full_name,email,phone)").order("updated_at", { ascending: false }).limit(40),
      (supabase as any).from("adminos_automation_rules").select("*").order("priority", { ascending: true }),
      (supabase as any).from("adminos_automation_jobs").select("*").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("adminos_approval_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("adminos_integration_connections").select("*").order("display_name", { ascending: true }),
    ]);
    const error = contactsRes.error || prospectsRes.error || rulesRes.error || jobsRes.error || approvalsRes.error || integrationsRes.error;
    setLoading(false);
    if (error) return toast.error(error.message || "Could not load AdminOS Release 1");
    const c = contactsRes.data || [];
    const p = prospectsRes.data || [];
    const r = rulesRes.data || [];
    const j = jobsRes.data || [];
    const a = approvalsRes.data || [];
    const i = integrationsRes.data || [];
    setContacts(c); setProspects(p); setRules(r); setJobs(j); setApprovals(a); setIntegrations(i);
    const [contactCount, prospectCount, ruleCount, jobCount, approvalCount, integrationCount] = await Promise.all([
      (supabase as any).from("adminos_contacts").select("id", { count: "exact", head: true }),
      (supabase as any).from("adminos_prospects").select("id", { count: "exact", head: true }),
      (supabase as any).from("adminos_automation_rules").select("id", { count: "exact", head: true }),
      (supabase as any).from("adminos_automation_jobs").select("id", { count: "exact", head: true }),
      (supabase as any).from("adminos_approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      (supabase as any).from("adminos_integration_connections").select("id", { count: "exact", head: true }),
    ]);
    setCounts({
      contacts: contactCount.count || 0,
      prospects: prospectCount.count || 0,
      rules: ruleCount.count || 0,
      jobs: jobCount.count || 0,
      approvals: approvalCount.count || 0,
      integrations: integrationCount.count || 0,
    });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleRule = async (id: string, enabled: boolean) => {
    const { error } = await (supabase as any).from("adminos_automation_rules").update({ enabled }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(enabled ? "Workflow enabled" : "Workflow paused");
    setRules((prev) => prev.map((rule) => rule.id === id ? { ...rule, enabled } : rule));
  };

  const completed = useMemo(() => phases.filter((p) => p.status === "complete").length, []);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1"><Bot className="h-3.5 w-3.5" />RESKONNECT ADMINOS</Badge>
              <Badge variant="outline">Release 1</Badge>
              <Badge variant="secondary">{completed} foundational phases complete</Badge>
            </div>
            <h2 className="mt-4 text-2xl font-black sm:text-3xl">90% automation foundation</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Release 1 establishes the control plane, one master CRM identity graph and an auditable event-to-workflow engine. No external AI, email, WhatsApp or voice communication is enabled yet.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {phases.map((item) => <PhaseCard key={item.phase} {...item} />)}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={Users} label="Master contacts" value={counts.contacts} />
        <Metric icon={Network} label="Prospects unified" value={counts.prospects} />
        <Metric icon={Workflow} label="Workflow rules" value={counts.rules} />
        <Metric icon={Activity} label="Workflow jobs" value={counts.jobs} />
        <Metric icon={ShieldCheck} label="Pending approvals" value={counts.approvals} danger={counts.approvals > 0} />
        <Metric icon={PlugZap} label="API connectors staged" value={counts.integrations} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <ReleaseCard icon={ShieldCheck} title="Phase 0 of 11 — COMPLETE" text="Staff-only RLS, audit records, approval queue, integration registry, knowledge source structure, agent activity/error tables and automation kill-switch configuration foundation are in production." />
            <ReleaseCard icon={Users} title="Phase 1 of 11 — COMPLETE" text="Existing student profiles, partner leads and residence leads are resolved into a single contact identity graph without replacing the existing operational source tables." />
            <ReleaseCard icon={GitBranch} title="Phase 2 of 11 — COMPLETE" text="Application/prospect events dispatch through versioned rules into idempotent jobs. Safe internal tasks execute immediately; external actions remain blocked for later releases." />
          </div>
          <Card>
            <CardHeader><CardTitle>Release boundary</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <Boundary ok title="Enabled now" lines={["CRM identity resolution", "Profile/lead backfill", "Application event ingestion", "Prospect event ingestion", "Workflow rules and jobs", "Internal task creation", "Approval and audit infrastructure"]} />
              <Boundary title="Deliberately not enabled" lines={["OpenAI agent reasoning (Phase 3)", "Autonomous app replies (Phase 4)", "Gmail sending/reading (Phase 5)", "WhatsApp automation (Phase 6)", "External follow-up execution (Phase 7)", "AI voice calls (Phase 10)"]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crm">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Unified contacts</CardTitle></CardHeader><CardContent className="p-0">{loading ? <Loading /> : contacts.length === 0 ? <Empty text="No contacts resolved yet." /> : <div className="divide-y">{contacts.map((c) => <div key={c.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{c.full_name || "Unnamed contact"}</p><p className="mt-1 text-xs text-muted-foreground">{c.email || c.phone || "No primary channel"}</p></div><Badge variant="outline">{String(c.contact_type || "person")}</Badge></div><div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{c.application_count || 0} applications</span><span>{c.prospect_count || 0} prospect records</span>{c.campus && <span>{c.campus}</span>}</div></div>)}</div>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Prospect pipeline</CardTitle></CardHeader><CardContent className="p-0">{loading ? <Loading /> : prospects.length === 0 ? <Empty text="No prospects unified yet." /> : <div className="divide-y">{prospects.map((p) => <div key={p.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{p.adminos_contacts?.full_name || "Prospect"}</p><p className="mt-1 text-xs text-muted-foreground">{p.pipeline} · {p.source_type || "direct"}</p></div><Badge variant="secondary">{p.stage}</Badge></div><div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>Score {Number(p.score || 0)}</span><span>Priority {p.priority}</span>{p.next_action_at && <span>Next {new Date(p.next_action_at).toLocaleString("en-ZA")}</span>}</div></div>)}</div>}</CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <Card><CardHeader><CardTitle>Workflow rules</CardTitle></CardHeader><CardContent className="p-0">{loading ? <Loading /> : <div className="divide-y">{rules.map((rule) => <div key={rule.id} className="grid gap-3 p-4 lg:grid-cols-[1fr,160px,auto] lg:items-center"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{rule.trigger_type}</Badge><Badge variant="secondary">v{rule.version}</Badge></div><p className="mt-2 font-bold">{rule.name}</p><p className="mt-1 text-sm text-muted-foreground">{rule.description}</p></div><div className="text-xs text-muted-foreground">Priority {rule.priority}</div><div className="flex items-center gap-2"><span className="text-xs font-semibold">{rule.enabled ? "Active" : "Paused"}</span><Switch checked={!!rule.enabled} onCheckedChange={(value) => void toggleRule(rule.id, value)} /></div></div>)}</div>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Recent jobs</CardTitle></CardHeader><CardContent className="p-0">{jobs.length === 0 ? <Empty text="No workflow jobs have been generated yet." /> : <div className="divide-y">{jobs.map((job) => <div key={job.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{job.action_type}</p><p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString("en-ZA")} · attempts {job.attempts}/{job.max_attempts}</p></div><JobBadge status={job.status} /></div>)}</div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card><CardHeader><CardTitle>Human approval queue</CardTitle></CardHeader><CardContent className="p-0">{approvals.length === 0 ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto h-9 w-9" /><p className="mt-3 font-bold">Nothing requires approval</p><p className="mt-1 text-sm text-muted-foreground">Release 1 is running within its safe internal-action boundary.</p></div> : <div className="divide-y">{approvals.map((a) => <div key={a.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{a.title}</p><Badge variant={a.risk_level === "red" ? "destructive" : "outline"}>{a.risk_level}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{a.summary || a.request_type}</p></div>)}</div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card><CardHeader><CardTitle>3-step API setup standard</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-3"><SetupStep number="1" title="Create / Authorise" text="Open the official provider page directly from AdminOS." /><SetupStep number="2" title="Connect" text="OAuth or server-side secret entry. Secrets never live in the browser." /><SetupStep number="3" title="Test & Activate" text="AdminOS verifies credentials, permissions, webhooks and a controlled test before activation." /></div></CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-2">{providerFallbacks.map((fallback) => { const db = integrations.find((i) => i.provider === fallback.provider); const setupUrl = db?.setup_url || fallback.setup; const docsUrl = db?.docs_url || fallback.docs; return <Card key={fallback.provider}><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle>{db?.display_name || fallback.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Required in Phase {fallback.phase} of 11</p></div><Badge variant={db?.status === "connected" ? "default" : "outline"}>{db?.status || "not_connected"}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 sm:grid-cols-3"><MiniStep n="1" label="Provider" active /><MiniStep n="2" label="Connect" active={false} /><MiniStep n="3" label="Test" active={false} /></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><a href={setupUrl} target="_blank" rel="noreferrer">Official setup <ExternalLink className="h-3.5 w-3.5" /></a></Button><Button asChild variant="ghost" size="sm"><a href={docsUrl} target="_blank" rel="noreferrer">Guide <ExternalLink className="h-3.5 w-3.5" /></a></Button></div><p className="text-xs text-muted-foreground">Connection controls unlock in the phase that owns this provider; Release 1 only establishes the secure integration registry and guided setup contract.</p></CardContent></Card>; })}</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PhaseCard({ phase, name, status }: { phase: number; name: string; status: "complete" | "not_started" }) {
  const complete = status === "complete";
  return <div className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-wide">Phase {phase} of 11</span>{complete ? <CheckCircle2 className="h-5 w-5" /> : <Activity className="h-5 w-5 text-muted-foreground" />}</div><p className="mt-3 font-bold">{name}</p><Badge className="mt-3" variant={complete ? "default" : "outline"}>{complete ? "COMPLETE" : "NOT STARTED"}</Badge></div>;
}
function Metric({ icon: Icon, label, value, danger = false }: { icon: any; label: string; value: number; danger?: boolean }) { return <Card><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className={"text-2xl font-black " + (danger ? "text-destructive" : "")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div><Icon className={"h-5 w-5 " + (danger ? "text-destructive" : "text-muted-foreground")} /></CardContent></Card>; }
function ReleaseCard({ icon: Icon, title, text }: { icon: any; title: string; text: string }) { return <Card><CardContent className="p-5"><Icon className="h-6 w-6" /><p className="mt-4 text-sm font-black">{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>; }
function Boundary({ ok = false, title, lines }: { ok?: boolean; title: string; lines: string[] }) { return <div className="rounded-2xl border p-4"><div className="flex items-center gap-2 font-bold">{ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{title}</div><ul className="mt-3 space-y-1.5 text-muted-foreground">{lines.map((line) => <li key={line}>• {line}</li>)}</ul></div>; }
function Loading() { return <div className="p-10 text-center text-sm text-muted-foreground">Loading AdminOS…</div>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-muted-foreground">{text}</div>; }
function JobBadge({ status }: { status: string }) { const variant = status === "succeeded" ? "default" : status === "failed" ? "destructive" : "outline"; return <Badge variant={variant as any}>{String(status).replaceAll("_", " ")}</Badge>; }
function SetupStep({ number, title, text }: { number: string; title: string; text: string }) { return <div className="rounded-2xl border p-4"><div className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black">{number}</div><p className="mt-3 font-bold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>; }
function MiniStep({ n, label, active }: { n: string; label: string; active: boolean }) { return <div className={"rounded-xl border p-2 text-xs font-semibold " + (active ? "bg-muted" : "text-muted-foreground")}><span className="mr-1">{n}.</span>{label}</div>; }
