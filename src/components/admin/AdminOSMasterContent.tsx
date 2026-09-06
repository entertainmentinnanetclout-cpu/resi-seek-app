import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleOff,
  ExternalLink,
  FileText,
  Gauge,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Users,
  Workflow,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminOSOpenAIStatus from "@/components/admin/AdminOSOpenAIStatus";
import AdminOSReleaseOneContent from "@/components/admin/AdminOSReleaseOneContent";
import AdminOSReleaseTwoContent from "@/components/admin/AdminOSReleaseTwoContent";
import AdminOSReleaseThreeContent from "@/components/admin/AdminOSReleaseThreeContent";
import AdminOSReleaseFourContent from "@/components/admin/AdminOSReleaseFourContent";

type AnyRow = Record<string, any>;

type PhaseDefinition = {
  phase: number;
  name: string;
  release: number;
  icon: any;
};

const phases: PhaseDefinition[] = [
  { phase: 0, name: "Governance & control", release: 1, icon: ShieldCheck },
  { phase: 1, name: "Unified CRM & identity", release: 1, icon: Users },
  { phase: 2, name: "Workflow engine", release: 1, icon: Workflow },
  { phase: 3, name: "Konnect Agent core", release: 2, icon: Bot },
  { phase: 4, name: "Internal enquiries", release: 2, icon: MessageSquareText },
  { phase: 5, name: "Email Agent", release: 2, icon: Mail },
  { phase: 6, name: "WhatsApp Agent", release: 3, icon: MessageCircle },
  { phase: 7, name: "Follow-up Autopilot", release: 3, icon: TimerReset },
  { phase: 8, name: "Company paperwork", release: 3, icon: FileText },
  { phase: 9, name: "Sales CRM", release: 4, icon: Target },
  { phase: 10, name: "Calls & AI Voice", release: 4, icon: Phone },
  { phase: 11, name: "Executive Agent", release: 4, icon: Sparkles },
];

const releaseViews = [
  { value: "release-1", label: "0–2 · Foundation" },
  { value: "release-2", label: "3–5 · Agent + Email" },
  { value: "release-3", label: "6–8 · Comms + Docs" },
  { value: "release-4", label: "9–11 · Sales + Executive" },
];

const viewForProvider: Record<string, string> = {
  openai: "release-2",
  lovable_ai_gateway: "release-2",
  gmail: "release-2",
  twilio_whatsapp: "release-3",
  twilio_voice: "release-4",
};

const serverSecretsUrl = "https://supabase.com/dashboard/project/mefjzkhobkltlbmhusdh/settings/functions";

export default function AdminOSMasterContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get("adminos_view") || "overview";
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<AnyRow>({});
  const [integrations, setIntegrations] = useState<AnyRow[]>([]);
  const [agents, setAgents] = useState<AnyRow[]>([]);
  const [usage, setUsage] = useState<AnyRow[]>([]);
  const [runs, setRuns] = useState<AnyRow[]>([]);
  const [approvals, setApprovals] = useState<AnyRow[]>([]);
  const [errors, setErrors] = useState<AnyRow[]>([]);
  const [working, setWorking] = useState<string | null>(null);

  const setView = useCallback((value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "adminos");
    next.set("adminos_view", value);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    const [progressRes, integrationRes, agentRes, usageRes, runRes, approvalRes, errorRes] = await Promise.all([
      (supabase as any).from("platform_settings").select("value").eq("key", "adminos_release_progress").maybeSingle(),
      (supabase as any).from("adminos_integration_connections").select("*").order("display_name"),
      (supabase as any).from("adminos_agent_config").select("*").order("agent_key"),
      (supabase as any).from("adminos_agent_usage").select("*").order("created_at", { ascending: false }).limit(30),
      (supabase as any).from("adminos_agent_runs").select("id,agent_key,trigger_type,status,started_at,completed_at").order("started_at", { ascending: false }).limit(30),
      (supabase as any).from("adminos_approval_requests").select("id,title,summary,request_type,risk_level,status,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(30),
      (supabase as any).from("adminos_agent_errors").select("id,error_code,error_message,retryable,resolved,created_at").eq("resolved", false).order("created_at", { ascending: false }).limit(30),
    ]);

    const criticalError = progressRes.error || integrationRes.error || agentRes.error;
    if (criticalError) toast.error(criticalError.message || "Could not load the complete AdminOS control surface");

    setProgress(progressRes.data?.value || {});
    setIntegrations(integrationRes.data || []);
    setAgents(agentRes.data || []);
    setUsage(usageRes.data || []);
    setRuns(runRes.data || []);
    setApprovals(approvalRes.data || []);
    setErrors(errorRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleAgent = async (agent: AnyRow, enabled: boolean) => {
    setWorking(`agent:${agent.id}`);
    try {
      const { error } = await (supabase as any).from("adminos_agent_config").update({ enabled }).eq("id", agent.id);
      if (error) throw error;
      setAgents((current) => current.map((row) => row.id === agent.id ? { ...row, enabled } : row));
      toast.success(`${agent.display_name} ${enabled ? "enabled" : "paused"}`);
    } catch (error: any) {
      toast.error(error?.message || "Could not update agent control");
    } finally {
      setWorking(null);
    }
  };

  const completedPhases = useMemo(
    () => phases.filter((item) => progress?.[`phase_${item.phase}`] === "complete").length,
    [progress],
  );
  const connectedExternal = integrations.filter((row) => row.provider !== "lovable_ai_gateway" && row.status === "connected" && row.enabled).length;
  const externalCount = integrations.filter((row) => row.provider !== "lovable_ai_gateway").length;
  const enabledAgents = agents.filter((row) => row.enabled).length;
  const voiceAgent = agents.find((row) => row.agent_key === "voice_agent");
  const lunaUsage = usage.filter((row) => row.model === "gpt-5.6-luna");
  const latestLuna = lunaUsage[0];
  const lunaCost = lunaUsage.reduce((total, row) => total + Number(row.estimated_cost_usd || 0), 0);

  return (
    <div className="space-y-5">
      <Tabs value={activeView} onValueChange={setView} className="space-y-5">
        <div className="rounded-2xl border bg-card p-1.5">
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
            <TabsTrigger value="overview" className="shrink-0">All 12 phases</TabsTrigger>
            {releaseViews.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="shrink-0">{item.label}</TabsTrigger>
            ))}
            <TabsTrigger value="agents" className="shrink-0">Agents & controls</TabsTrigger>
            <TabsTrigger value="integrations" className="shrink-0">Integrations</TabsTrigger>
            <TabsTrigger value="activity" className="shrink-0">Activity & approvals</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-5">
          <section className="overflow-hidden rounded-3xl border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="gap-1"><Bot className="h-3.5 w-3.5" />ADMINOS MASTER</Badge>
                  <Badge variant="outline">Release Gates 1–4</Badge>
                  <Badge variant={completedPhases === 12 ? "default" : "secondary"}>{completedPhases}/12 phases complete</Badge>
                </div>
                <h2 className="mt-4 text-2xl font-black sm:text-3xl">The full automation operating system</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                  This view restores every AdminOS release instead of showing only Phases 9–11. Use the tabs above for the foundation, AI agent, enquiries, email, WhatsApp, follow-ups, paperwork, sales, voice, executive controls, integrations and operating activity.
                </p>
              </div>
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={loading ? "animate-spin" : ""} />Refresh all
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={CheckCircle2} label="Phases complete" value={`${completedPhases}/12`} />
              <Metric icon={PlugZap} label="External connectors live" value={`${connectedExternal}/${externalCount || 4}`} />
              <Metric icon={Bot} label="Agents enabled" value={`${enabledAgents}/${agents.length || 9}`} />
              <Metric icon={CircleOff} label="AI Voice" value={voiceAgent?.enabled ? "ON" : "Standby"} />
            </div>
          </section>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Phase map · 0 through 11</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Every automation phase is visible here with its current production state.</p>
              </div>
              <Badge variant={progress.release_status === "complete" ? "default" : "outline"}>{progress.release_status || "loading"}</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                {phases.map((item) => <PhaseCard key={item.phase} item={item} status={progress?.[`phase_${item.phase}`]} />)}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
            <div className="space-y-4">
              <AdminOSOpenAIStatus />
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />What OpenAI Luna actually does</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-6">
                  <p>
                    <strong>GPT-5.6 Luna is the routine reasoning engine behind Konnect Agent.</strong> It is not a separate chatbot page. Public ResBot questions can route to it directly; signed-in enquiries pass through the secure enquiry agent; the Email Agent and WhatsApp Agent use the same reasoning core for drafts and replies; AI Voice can use it only when the voice module is deliberately enabled.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Mini label="Default model" value="gpt-5.6-luna" />
                    <Mini label="Complex route" value="gpt-5.6-terra" />
                    <Mini label="Safety" value="Human escalation" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Routine green-risk work stays on Luna for speed and cost control. Complex reasoning can route to Terra. Application approvals/rejections, contract signing, money movement, banking changes and other protected decisions remain outside autonomous authority.
                  </p>
                  {latestLuna && (
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">Luna is producing real AdminOS usage</p>
                          <p className="text-xs text-muted-foreground">Last recorded {new Date(latestLuna.created_at).toLocaleString("en-ZA")}</p>
                        </div>
                        <Badge variant="default">{latestLuna.provider} · {latestLuna.model}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <Mini label="Recent calls" value={String(lunaUsage.length)} />
                        <Mini label="Latest latency" value={`${Number(latestLuna.latency_ms || 0).toLocaleString("en-ZA")} ms`} />
                        <Mini label="Recent tracked cost" value={`$${lunaCost.toFixed(6)}`} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Release gates</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ReleaseJump title="Release 1 · Phases 0–2" text="Governance, unified identity/CRM and workflow engine." onOpen={() => setView("release-1")} />
                <ReleaseJump title="Release 2 · Phases 3–5" text="Konnect Agent, internal enquiries and Email Agent." onOpen={() => setView("release-2")} />
                <ReleaseJump title="Release 3 · Phases 6–8" text="WhatsApp, Follow-up Autopilot and company paperwork." onOpen={() => setView("release-3")} />
                <ReleaseJump title="Release 4 · Phases 9–11" text="Sales CRM, calls/voice and Executive Agent." onOpen={() => setView("release-4")} />
                <ReleaseJump title="Integration centre" text="Provider status, 3-step setup, required server secrets and direct official links." onOpen={() => setView("integrations")} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="release-1"><AdminOSReleaseOneContent /></TabsContent>
        <TabsContent value="release-2"><AdminOSReleaseTwoContent /></TabsContent>
        <TabsContent value="release-3"><AdminOSReleaseThreeContent /></TabsContent>
        <TabsContent value="release-4"><AdminOSReleaseFourContent /></TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />All AdminOS agents</CardTitle>
              <p className="text-sm text-muted-foreground">One place to see which automation brains are active. AI Voice remains intentionally off/standby unless you enable it.</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {agents.map((agent) => (
                  <Card key={agent.id} className={agent.enabled ? "border-primary/20" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{agent.display_name}</CardTitle>
                          <p className="mt-1 text-xs text-muted-foreground">Phase {agent.config?.phase ?? "—"} · Release {agent.config?.release ?? "—"}</p>
                        </div>
                        <Switch
                          checked={!!agent.enabled}
                          disabled={working === `agent:${agent.id}`}
                          onCheckedChange={(value) => void toggleAgent(agent, value)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">State</span><StatusBadge status={agent.enabled ? "enabled" : "standby"} /></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Authority</span><Badge variant="outline">{agent.authority_level}</Badge></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Confidence gate</span><strong>{Math.round(Number(agent.confidence_threshold || 0) * 100)}%</strong></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-5">
          <AdminOSOpenAIStatus />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PlugZap className="h-5 w-5" />Integration centre · 3-step setup</CardTitle>
              <p className="text-sm text-muted-foreground">Each provider now has one visible setup path: create/authorise, connect server credentials, then test and activate from its AdminOS control page.</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <SetupStep number="1" title="Create / authorise" text="Open the provider console from the card. Create the API key, OAuth app, WhatsApp sender or Voice number." />
                <SetupStep number="2" title="Connect securely" text="Add only the required credential names to Supabase Edge Function secrets. Secret values are never rendered back into this browser UI." />
                <SetupStep number="3" title="Test & activate" text="Open the linked AdminOS release controls, run the provider test, then activate only after verification succeeds." />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {integrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} onOpenControls={() => setView(viewForProvider[integration.provider] || "overview")} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={Activity} label="Recent agent runs" value={String(runs.length)} />
            <Metric icon={Gauge} label="Tracked AI usage" value={String(usage.length)} />
            <Metric icon={ListChecks} label="Pending approvals" value={String(approvals.length)} />
            <Metric icon={AlertTriangle} label="Unresolved errors" value={String(errors.length)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Recent agent runs</CardTitle></CardHeader>
              <CardContent className="p-0">
                {runs.length === 0 ? <Empty text="No agent runs recorded yet." /> : <div className="divide-y">{runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between gap-3 p-4">
                    <div><p className="font-semibold">{run.agent_key}</p><p className="text-xs text-muted-foreground">{run.trigger_type} · {new Date(run.started_at).toLocaleString("en-ZA")}</p></div>
                    <StatusBadge status={run.status} />
                  </div>
                ))}</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>AI model usage</CardTitle></CardHeader>
              <CardContent className="p-0">
                {usage.length === 0 ? <Empty text="No tracked model usage yet." /> : <div className="divide-y">{usage.map((row) => (
                  <div key={row.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{row.model}</p><Badge variant="outline">{row.provider}</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground">{row.agent_key} · {Number(row.input_tokens || 0) + Number(row.output_tokens || 0)} tokens · ${Number(row.estimated_cost_usd || 0).toFixed(6)} · {Number(row.latency_ms || 0).toLocaleString("en-ZA")} ms</p>
                  </div>
                ))}</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Pending approvals</CardTitle></CardHeader>
              <CardContent className="p-0">
                {approvals.length === 0 ? <Empty text="Nothing currently needs human approval." /> : <div className="divide-y">{approvals.map((row) => (
                  <div key={row.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{row.title}</p><Badge variant={row.risk_level === "red" ? "destructive" : "outline"}>{row.risk_level}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{row.summary || row.request_type}</p></div>
                ))}</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Unresolved agent errors</CardTitle></CardHeader>
              <CardContent className="p-0">
                {errors.length === 0 ? <Empty text="No unresolved AdminOS agent errors." /> : <div className="divide-y">{errors.map((row) => (
                  <div key={row.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{row.error_code || "Agent error"}</p><Badge variant={row.retryable ? "outline" : "destructive"}>{row.retryable ? "retryable" : "review"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{row.error_message}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("en-ZA")}</p></div>
                ))}</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PhaseCard({ item, status }: { item: PhaseDefinition; status?: string }) {
  const Icon = item.icon;
  const complete = status === "complete";
  return (
    <Card className={complete ? "border-primary/25" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="rounded-xl bg-muted p-2"><Icon className="h-4 w-4" /></div>
          {complete ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Badge variant="outline">{String(status || "unknown").replaceAll("_", " ")}</Badge>}
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Phase {item.phase} · Release {item.release}</p>
        <p className="mt-1 font-semibold leading-5">{item.name}</p>
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><Icon className="mt-0.5 h-4 w-4" /><strong className="text-xl">{value}</strong></div><p className="mt-2 text-xs text-muted-foreground">{label}</p></CardContent></Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words font-semibold">{value}</p></div>;
}

function ReleaseJump({ title, text, onOpen }: { title: string; text: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-2xl border p-4 text-left transition hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div><ExternalLink className="mt-0.5 h-4 w-4 shrink-0" /></div>
    </button>
  );
}

function SetupStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-2xl border p-4"><Badge variant="outline">Step {number}</Badge><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}

function IntegrationCard({ integration, onOpenControls }: { integration: AnyRow; onOpenControls: () => void }) {
  const secrets = Object.values(integration.secret_refs || {}).filter(Boolean) as string[];
  const connected = integration.status === "connected" && integration.enabled;
  const managed = integration.provider === "lovable_ai_gateway";
  return (
    <Card className={connected ? "border-primary/25" : ""}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{integration.display_name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{integration.external_account_label || integration.provider}</p>
          </div>
          <div className="flex flex-wrap gap-2"><StatusBadge status={integration.status} /><Badge variant="outline">Step {integration.setup_step}/3</Badge></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {managed ? (
          <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">Managed fallback is already connected and is used only when the primary AI route is unavailable or deliberately falls back.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <IntegrationStep label="1 · Provider" done={Number(integration.setup_step) >= 1} detail="Create / authorise" />
            <IntegrationStep label="2 · Credentials" done={Number(integration.setup_step) >= 2} detail={secrets.length ? `${secrets.length} server secret${secrets.length === 1 ? "" : "s"}` : "Server connection"} />
            <IntegrationStep label="3 · Test" done={connected && Number(integration.setup_step) >= 3} detail={connected ? "Verified & active" : "Test then activate"} />
          </div>
        )}

        {secrets.length > 0 && (
          <div className="rounded-2xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required server secret names</p>
            <div className="mt-2 flex flex-wrap gap-2">{secrets.map((secret) => <Badge key={secret} variant="secondary" className="font-mono text-[11px]">{secret}</Badge>)}</div>
            <p className="mt-2 text-xs text-muted-foreground">Only secret names are shown here. Secret values stay server-side and are never read back into the browser.</p>
          </div>
        )}

        {integration.last_error && <div className="rounded-xl border p-3 text-sm"><strong>Last error:</strong> {integration.last_error}</div>}
        {integration.last_success_at && <p className="text-xs text-muted-foreground">Last successful provider activity {new Date(integration.last_success_at).toLocaleString("en-ZA")}</p>}

        <div className="flex flex-wrap gap-2">
          {integration.setup_url && <Button asChild variant="outline" size="sm"><a href={integration.setup_url} target="_blank" rel="noreferrer"><ExternalLink />Provider setup</a></Button>}
          {integration.docs_url && <Button asChild variant="outline" size="sm"><a href={integration.docs_url} target="_blank" rel="noreferrer"><ExternalLink />Official guide</a></Button>}
          {!managed && secrets.length > 0 && <Button asChild variant="outline" size="sm"><a href={serverSecretsUrl} target="_blank" rel="noreferrer"><ShieldCheck />Server secrets</a></Button>}
          <Button size="sm" onClick={onOpenControls}><Activity />Open controls / test</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationStep({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return <div className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{label}</p>{done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-muted-foreground" />}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = String(status || "unknown");
  const variant = ["connected", "complete", "completed", "succeeded", "enabled"].includes(normalized)
    ? "default"
    : ["failed", "error", "rejected"].includes(normalized)
      ? "destructive"
      : "outline";
  return <Badge variant={variant as any}>{normalized.replaceAll("_", " ")}</Badge>;
}

function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
