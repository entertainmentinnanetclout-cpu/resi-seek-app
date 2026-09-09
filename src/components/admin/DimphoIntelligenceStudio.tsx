import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, BookOpen, Bot, CheckCircle2, Database, GitBranch, GraduationCap, Loader2, MessagesSquare, RefreshCw, Rocket, Route, Save, ShieldCheck, Sparkles, Workflow, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const sliderKeys = ["warmth", "professionalism", "confidence", "humour", "conciseness", "proactivity", "empathy"] as const;
type SliderKey = typeof sliderKeys[number];

const defaultSliders: Record<SliderKey, number> = {
  warmth: 82,
  professionalism: 92,
  confidence: 92,
  humour: 24,
  conciseness: 76,
  proactivity: 92,
  empathy: 86,
};

const splitLines = (value: string) => value.split("\n").map((x) => x.trim()).filter(Boolean);
const splitComma = (value: string) => value.split(",").map((x) => x.trim()).filter(Boolean);

export default function DimphoIntelligenceStudio() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [persona, setPersona] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [personaForm, setPersonaForm] = useState({ name: "", template: "", rules: "", forbidden: "", sliders: defaultSliders as Record<SliderKey, number> });
  const [documents, setDocuments] = useState<any[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [newKnowledge, setNewKnowledge] = useState({ title: "", content: "" });
  const [routes, setRoutes] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [syncRuns, setSyncRuns] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [examples, setExamples] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewR, personaR, docsR, routesR, featuresR, workflowsR, syncR, lessonsR, examplesR, datasetsR, settingsR] = await Promise.all([
        (supabase as any).rpc("dimpho_intelligence_overview"),
        (supabase as any).from("dimpho_personas").select("*").eq("persona_key", "dimpho").maybeSingle(),
        (supabase as any).from("dimpho_knowledge_documents").select("id,title,source_type,source_ref,status,sensitivity,confidence,updated_at,metadata").order("updated_at", { ascending: false }).limit(120),
        (supabase as any).from("dimpho_app_routes").select("route_path,feature_key,page_component,access_level,status,canonical_url,last_seen_commit,updated_at").order("route_path").limit(300),
        (supabase as any).from("dimpho_app_features").select("*").order("name").limit(120),
        (supabase as any).from("dimpho_app_workflows").select("*,dimpho_app_workflow_steps(*)").order("name").limit(40),
        (supabase as any).from("dimpho_app_sync_runs").select("*").order("started_at", { ascending: false }).limit(10),
        (supabase as any).from("dimpho_lesson_candidates").select("*").order("last_seen_at", { ascending: false }).limit(80),
        (supabase as any).from("dimpho_training_examples").select("*").eq("active", true).order("quality_score", { ascending: false }).limit(100),
        (supabase as any).from("dimpho_dataset_releases").select("*").order("version", { ascending: false }).limit(20),
        (supabase as any).from("dimpho_intelligence_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (overviewR.error) throw overviewR.error;
      if (personaR.error) throw personaR.error;
      setOverview(overviewR.data);
      setPersona(personaR.data);
      setDocuments(docsR.data || []);
      setRoutes(routesR.data || []);
      setFeatures(featuresR.data || []);
      setWorkflows(workflowsR.data || []);
      setSyncRuns(syncR.data || []);
      setLessons(lessonsR.data || []);
      setExamples(examplesR.data || []);
      setDatasets(datasetsR.data || []);
      setSettings(settingsR.data || null);
      if (personaR.data?.id) {
        const { data: v, error } = await (supabase as any).from("dimpho_persona_versions").select("*").eq("persona_id", personaR.data.id).order("version", { ascending: false });
        if (error) throw error;
        setVersions(v || []);
        const current = (v || []).find((x: any) => x.id === personaR.data.active_version_id) || (v || [])[0];
        if (current && (!selectedVersionId || !(v || []).some((x: any) => x.id === selectedVersionId))) setSelectedVersionId(current.id);
      }
    } catch (error: any) {
      console.error("[DimphoIntelligenceStudio] load failed", error);
      toast.error(error?.message || "Could not load Dimpho Intelligence Studio");
    } finally {
      setLoading(false);
    }
  }, [selectedVersionId]);

  useEffect(() => { void load(); }, [load]);

  const selectedVersion = useMemo(() => versions.find((x) => x.id === selectedVersionId) || null, [versions, selectedVersionId]);
  useEffect(() => {
    if (!selectedVersion) return;
    setPersonaForm({
      name: selectedVersion.name || `Dimpho v${selectedVersion.version}`,
      template: selectedVersion.system_prompt_template || "",
      rules: (selectedVersion.behavioural_rules || []).join("\n"),
      forbidden: (selectedVersion.forbidden_phrases || []).join(", "),
      sliders: { ...defaultSliders, ...(selectedVersion.sliders || {}) },
    });
  }, [selectedVersion]);

  const callWorker = async (action: "knowledge" | "learning" | "app_sync" | "cycle") => {
    const { data, error } = await (supabase.functions as any).invoke("dimpho-intelligence-worker", { body: { action, source: "admin_ui" } });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || `Dimpho ${action} worker failed`);
    return data;
  };

  const savePersona = async () => {
    if (!selectedVersion) return;
    setBusy("save-persona");
    try {
      const { error } = await (supabase as any).from("dimpho_persona_versions").update({
        name: personaForm.name.trim() || selectedVersion.name,
        system_prompt_template: personaForm.template,
        behavioural_rules: splitLines(personaForm.rules),
        forbidden_phrases: splitComma(personaForm.forbidden),
        sliders: personaForm.sliders,
      }).eq("id", selectedVersion.id);
      if (error) throw error;
      toast.success("Dimpho personality draft saved");
      await load();
    } catch (error: any) { toast.error(error?.message || "Could not save personality"); }
    finally { setBusy(null); }
  };

  const newPersonaVersion = async () => {
    if (!persona?.id) return;
    setBusy("new-persona");
    try {
      const base = selectedVersion || versions[0];
      const nextVersion = Math.max(0, ...versions.map((v) => Number(v.version || 0))) + 1;
      const { data, error } = await (supabase as any).from("dimpho_persona_versions").insert({
        persona_id: persona.id,
        version: nextVersion,
        name: `Dimpho Studio v${nextVersion}`,
        identity: base?.identity || { name: "Dimpho", company: "ResKonnect", role: "AI Concierge" },
        tone: base?.tone || {},
        sliders: base?.sliders || defaultSliders,
        behavioural_rules: base?.behavioural_rules || [],
        forbidden_phrases: base?.forbidden_phrases || [],
        channel_overrides: base?.channel_overrides || {},
        system_prompt_template: base?.system_prompt_template || "Be a capable, natural ResKonnect service professional.",
        status: "draft",
        source: "admin",
        created_by: user?.id || null,
      }).select("id").single();
      if (error) throw error;
      setSelectedVersionId(data.id);
      toast.success(`Created Dimpho personality v${nextVersion}`);
      await load();
    } catch (error: any) { toast.error(error?.message || "Could not create personality version"); }
    finally { setBusy(null); }
  };

  const publishPersona = async () => {
    if (!selectedVersion) return;
    if (!window.confirm(`Publish Dimpho personality v${selectedVersion.version} to the live agent?`)) return;
    setBusy("publish-persona");
    try {
      await savePersona();
      const { data, error } = await (supabase as any).rpc("dimpho_publish_persona_version", { p_version_id: selectedVersion.id });
      if (error) throw error;
      toast.success(`Dimpho v${data?.persona_version || selectedVersion.version} published`);
      await load();
    } catch (error: any) { toast.error(error?.message || "Could not publish personality. Verify God Mode 2FA."); }
    finally { setBusy(null); }
  };

  const addKnowledge = async () => {
    if (!newKnowledge.title.trim() || !newKnowledge.content.trim()) return toast.error("Add a title and knowledge content");
    setBusy("add-knowledge");
    try {
      const ref = `admin:${crypto.randomUUID()}`;
      const { error } = await (supabase as any).from("dimpho_knowledge_documents").insert({
        title: newKnowledge.title.trim(), source_type: "admin", source_ref: ref, content: newKnowledge.content.trim(), status: "published", sensitivity: "internal", confidence: 0.98, created_by: user?.id || null,
      });
      if (error) throw error;
      setNewKnowledge({ title: "", content: "" });
      toast.success("Knowledge added and queued for indexing");
      await callWorker("knowledge");
      await load();
    } catch (error: any) { toast.error(error?.message || "Could not add knowledge"); }
    finally { setBusy(null); }
  };

  const reindexKnowledge = async () => {
    setBusy("reindex");
    try {
      const { data, error } = await (supabase as any).rpc("dimpho_queue_full_reindex");
      if (error) throw error;
      const result = await callWorker("knowledge");
      toast.success(`Queued ${data || 0} documents; processed ${result?.knowledge?.processed || 0}`);
      await load();
    } catch (error: any) { toast.error(error?.message || "Knowledge reindex failed"); }
    finally { setBusy(null); }
  };

  const syncApp = async () => {
    setBusy("sync-app");
    try {
      const data = await callWorker("app_sync");
      toast.success(`App intelligence synced: ${data?.app_sync?.routes || 0} routes`);
      await callWorker("knowledge");
      await load();
    } catch (error: any) { toast.error(error?.message || "App intelligence sync failed"); }
    finally { setBusy(null); }
  };

  const runLearning = async () => {
    setBusy("learning");
    try {
      const data = await callWorker("learning");
      toast.success(`Learning cycle processed ${data?.learning?.threads || 0} conversations`);
      await load();
    } catch (error: any) { toast.error(error?.message || "Learning cycle failed"); }
    finally { setBusy(null); }
  };

  const updateSettings = async (patch: Record<string, unknown>) => {
    if (!settings) return;
    const next = { ...settings, ...patch, updated_at: new Date().toISOString(), updated_by: user?.id || null };
    setSettings(next);
    const { error } = await (supabase as any).from("dimpho_intelligence_settings").update({ ...patch, updated_at: next.updated_at, updated_by: next.updated_by }).eq("id", 1);
    if (error) { toast.error(error.message); await load(); }
  };

  const promoteLesson = async (id: string) => {
    setBusy(`lesson:${id}`);
    try {
      const { error } = await (supabase as any).rpc("dimpho_promote_lesson", { p_candidate_id: id });
      if (error) throw error;
      toast.success("Lesson promoted into the Dimpho-RK training set");
      await load();
    } catch (error: any) { toast.error(error?.message || "Could not promote lesson"); }
    finally { setBusy(null); }
  };

  const rejectLesson = async (id: string) => {
    const { error } = await (supabase as any).from("dimpho_lesson_candidates").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user?.id || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Lesson rejected");
    await load();
  };

  const freezeDataset = async () => {
    setBusy("dataset");
    try {
      const { data, error } = await (supabase as any).rpc("dimpho_create_dataset_release", { p_name: null });
      if (error) throw error;
      toast.success(`Frozen Dimpho-RK dataset v${data?.version} with ${data?.example_count || 0} examples`);
      await load();
    } catch (error: any) { toast.error(error?.message || "Could not freeze dataset"); }
    finally { setBusy(null); }
  };

  const filteredDocs = useMemo(() => documents.filter((d) => `${d.title} ${d.source_type} ${d.source_ref || ""}`.toLowerCase().includes(knowledgeSearch.toLowerCase())), [documents, knowledgeSearch]);

  if (loading && !overview) return <div className="grid min-h-60 place-items-center text-sm text-muted-foreground"><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading Dimpho Intelligence Engine…</div></div>;

  return <div className="min-w-0 space-y-5">
    <section className="overflow-hidden rounded-[28px] border bg-gradient-to-br from-violet-500/10 via-background to-cyan-500/10 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge className="rounded-full bg-violet-600">DIMPHO INTELLIGENCE ENGINE</Badge><Badge variant="outline" className="rounded-full">Releases 1–4 active</Badge><Badge variant="outline" className="rounded-full">Autonomous learning enabled</Badge></div><h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Train the intelligence, not a basic bot.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Personality, verified ResKonnect knowledge, production app intelligence and privacy-filtered conversation lessons are now separate governed layers. Dimpho can improve continuously without blindly memorising customers or treating model memory as live backend truth.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={Boolean(busy)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={() => void runLearning()} disabled={Boolean(busy)}><Sparkles className="mr-2 h-4 w-4" />Run learning cycle</Button></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReleaseCard release="1" title="Intelligence Foundation" text="Versioned data, learning queue, training examples and governance." active />
        <ReleaseCard release="2" title="Personality Studio" text={`Live persona v${overview?.persona?.active_version || 1} with AAL2 publishing.`} active />
        <ReleaseCard release="3" title="Knowledge Brain" text={`${overview?.knowledge?.embedded_chunks || 0} embedded chunks across ${overview?.knowledge?.documents || 0} documents.`} active />
        <ReleaseCard release="4" title="App Intelligence" text={`${overview?.app_intelligence?.routes || 0} routes · ${overview?.app_intelligence?.features || 0} features · ${overview?.app_intelligence?.workflows || 0} workflows.`} active />
      </div>
    </section>

    <Tabs defaultValue="personality" className="min-w-0">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl p-1 lg:grid-cols-5"><TabsTrigger value="personality"><Bot className="mr-2 h-4 w-4" />Personality</TabsTrigger><TabsTrigger value="knowledge"><BookOpen className="mr-2 h-4 w-4" />Knowledge</TabsTrigger><TabsTrigger value="app"><Route className="mr-2 h-4 w-4" />App Brain</TabsTrigger><TabsTrigger value="learning"><MessagesSquare className="mr-2 h-4 w-4" />Learning</TabsTrigger><TabsTrigger value="dataset"><GraduationCap className="mr-2 h-4 w-4" />Dimpho-RK</TabsTrigger></TabsList>

      <TabsContent value="personality" className="space-y-4">
        <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Personality Studio</CardTitle><CardDescription>Build, test and publish the exact Dimpho behaviour used by the production agent.</CardDescription></div><div className="flex gap-2"><Button variant="outline" onClick={() => void newPersonaVersion()} disabled={Boolean(busy)}>New version</Button><Button onClick={() => void publishPersona()} disabled={!selectedVersion || Boolean(busy)}><Rocket className="mr-2 h-4 w-4" />Publish live</Button></div></div></CardHeader><CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">{versions.map((v) => <button key={v.id} type="button" onClick={() => setSelectedVersionId(v.id)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selectedVersionId === v.id ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>v{v.version} · {v.status}</button>)}</div>
          {selectedVersion && <><div className="grid gap-4 lg:grid-cols-2"><div><Label>Version name</Label><Input className="mt-2" value={personaForm.name} onChange={(e) => setPersonaForm((p) => ({ ...p, name: e.target.value }))} /></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="font-bold">Live identity</p><p className="mt-1 text-muted-foreground">{persona?.name} · {persona?.role_title}</p><p className="mt-1 text-xs text-muted-foreground">{persona?.mission}</p></div></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{sliderKeys.map((key) => <div key={key} className="rounded-xl border p-3"><div className="mb-3 flex items-center justify-between"><Label className="capitalize">{key}</Label><span className="text-xs font-black">{personaForm.sliders[key]}%</span></div><Slider min={0} max={100} step={1} value={[personaForm.sliders[key]]} onValueChange={([value]) => setPersonaForm((p) => ({ ...p, sliders: { ...p.sliders, [key]: value } }))} /></div>)}</div>
          <div className="grid gap-4 lg:grid-cols-2"><div><Label>Behavioural rules · one per line</Label><Textarea className="mt-2 min-h-56" value={personaForm.rules} onChange={(e) => setPersonaForm((p) => ({ ...p, rules: e.target.value }))} /></div><div><Label>Forbidden / robotic phrases · comma separated</Label><Textarea className="mt-2 min-h-56" value={personaForm.forbidden} onChange={(e) => setPersonaForm((p) => ({ ...p, forbidden: e.target.value }))} /></div></div>
          <div><Label>Persona instruction template</Label><Textarea className="mt-2 min-h-64 font-mono text-xs leading-5" value={personaForm.template} onChange={(e) => setPersonaForm((p) => ({ ...p, template: e.target.value }))} /></div>
          <div className="flex justify-end"><Button variant="outline" onClick={() => void savePersona()} disabled={Boolean(busy)}>{busy === "save-persona" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save draft</Button></div></>}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="knowledge" className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"><Card><CardHeader><CardTitle>Add verified knowledge</CardTitle><CardDescription>New content is chunked and embedded automatically. Live database values should still come from backend tools, not static knowledge.</CardDescription></CardHeader><CardContent className="space-y-3"><div><Label>Title</Label><Input className="mt-2" value={newKnowledge.title} onChange={(e) => setNewKnowledge((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Application document requirements" /></div><div><Label>Verified content</Label><Textarea className="mt-2 min-h-48" value={newKnowledge.content} onChange={(e) => setNewKnowledge((p) => ({ ...p, content: e.target.value }))} /></div><div className="flex flex-wrap gap-2"><Button onClick={() => void addKnowledge()} disabled={Boolean(busy)}><Database className="mr-2 h-4 w-4" />Add & index</Button><Button variant="outline" onClick={() => void reindexKnowledge()} disabled={Boolean(busy)}><RefreshCw className="mr-2 h-4 w-4" />Reindex all</Button></div></CardContent></Card>
        <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Knowledge Brain</CardTitle><CardDescription>{overview?.knowledge?.documents || 0} documents · {overview?.knowledge?.chunks || 0} chunks · {overview?.knowledge?.embedded_chunks || 0} vectorized</CardDescription></div><Input className="sm:w-64" placeholder="Search knowledge…" value={knowledgeSearch} onChange={(e) => setKnowledgeSearch(e.target.value)} /></div></CardHeader><CardContent><div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">{filteredDocs.map((d) => <div key={d.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{d.title}</p><p className="mt-1 text-xs text-muted-foreground">{d.source_type} · confidence {Math.round(Number(d.confidence || 0) * 100)}%</p></div><Badge variant={d.status === "published" ? "default" : "outline"}>{d.status}</Badge></div></div>)}</div></CardContent></Card></div>
      </TabsContent>

      <TabsContent value="app" className="space-y-4">
        <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Production App Intelligence</CardTitle><CardDescription>Dimpho learns current routes and code artifacts from GitHub, while curated workflows explain how users actually complete tasks.</CardDescription></div><Button onClick={() => void syncApp()} disabled={Boolean(busy)}>{busy === "sync-app" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranch className="mr-2 h-4 w-4" />}Sync GitHub now</Button></div></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Route} label="Routes" value={routes.length} /><Metric icon={Sparkles} label="Features" value={features.length} /><Metric icon={Workflow} label="Workflows" value={workflows.length} /><Metric icon={GitBranch} label="Last sync" value={syncRuns[0]?.status || "pending"} /></CardContent></Card>
        <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Routes Dimpho knows</CardTitle></CardHeader><CardContent><div className="max-h-[520px] space-y-2 overflow-y-auto">{routes.map((r) => <div key={r.route_path} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><code className="min-w-0 truncate text-xs font-bold">{r.route_path}</code><Badge variant="outline">{r.access_level}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{r.page_component || r.feature_key || "route"}</p></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle>User journey graph</CardTitle></CardHeader><CardContent className="space-y-3">{workflows.map((w) => <div key={w.id} className="rounded-2xl border p-4"><div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" /><p className="font-black">{w.name}</p></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{w.description}</p><div className="mt-3 space-y-2">{(w.dimpho_app_workflow_steps || []).sort((a: any, b: any) => a.step_order - b.step_order).map((s: any) => <div key={s.id} className="flex gap-3 text-xs"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 font-black text-primary">{s.step_order}</span><div><p className="font-bold">{s.title}</p><p className="text-muted-foreground">{s.instruction}</p></div></div>)}</div></div>)}</CardContent></Card></div>
      </TabsContent>

      <TabsContent value="learning" className="space-y-4">
        <Card><CardHeader><CardTitle>Autonomous Learning Guardrails</CardTitle><CardDescription>Every supported conversation becomes a learning signal. Raw customer messages stay in their governed source tables; only redacted, reusable lessons can enter the training set.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><ToggleSetting label="Conversation learning" description="Queue WhatsApp, in-app and email conversations." checked={Boolean(settings?.learning_enabled)} onCheckedChange={(v) => void updateSettings({ learning_enabled: v })} /><ToggleSetting label="PII redaction" description="Remove identifiable data before lesson storage." checked={Boolean(settings?.pii_redaction_enabled)} onCheckedChange={(v) => void updateSettings({ pii_redaction_enabled: v })} /><ToggleSetting label="Safe auto-promotion" description="Repeated high-quality non-sensitive lessons can train automatically." checked={Boolean(settings?.auto_promote_style_examples)} onCheckedChange={(v) => void updateSettings({ auto_promote_style_examples: v })} /><div className="rounded-xl border p-4"><p className="font-bold">Auto threshold</p><p className="mt-1 text-xs text-muted-foreground">{Math.round(Number(settings?.min_auto_promote_score || 0.94) * 100)}% quality minimum</p><Slider className="mt-4" min={85} max={100} step={1} value={[Math.round(Number(settings?.min_auto_promote_score || 0.94) * 100)]} onValueCommit={([v]) => void updateSettings({ min_auto_promote_score: v / 100 })} /></div></CardContent></Card>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Conversation lessons</CardTitle><CardDescription>{overview?.learning?.lesson_candidates || 0} waiting for review · {overview?.learning?.auto_promoted || 0} auto-promoted</CardDescription></div><Button variant="outline" onClick={() => void runLearning()} disabled={Boolean(busy)}>Process now</Button></div></CardHeader><CardContent><div className="max-h-[620px] space-y-3 overflow-y-auto">{lessons.map((l) => <div key={l.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center gap-2"><Badge>{l.lesson_type}</Badge><Badge variant="outline">{l.category}</Badge><Badge variant="outline">quality {Math.round(Number(l.quality_score || 0) * 100)}%</Badge>{l.auto_promoted && <Badge className="bg-emerald-600">auto-trained</Badge>}{l.sensitive_topic && <Badge variant="destructive">sensitive</Badge>}</div><p className="mt-3 text-sm font-semibold">{l.candidate_text}</p>{l.user_excerpt_redacted && <p className="mt-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">User pattern: {l.user_excerpt_redacted}</p>}<div className="mt-3 flex flex-wrap gap-2">{l.status === "candidate" && <><Button size="sm" onClick={() => void promoteLesson(l.id)} disabled={Boolean(busy) || l.sensitive_topic || l.pii_detected}><CheckCircle2 className="mr-2 h-4 w-4" />Approve lesson</Button><Button size="sm" variant="outline" onClick={() => void rejectLesson(l.id)}><XCircle className="mr-2 h-4 w-4" />Reject</Button></>}</div></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle>Learning telemetry</CardTitle></CardHeader><CardContent className="space-y-3"><Metric icon={MessagesSquare} label="Queued events" value={overview?.learning?.queued_events || 0} /><Metric icon={Brain} label="Training examples" value={examples.length} /><Metric icon={ShieldCheck} label="Auto-promotion" value={settings?.auto_promote_style_examples ? "guarded on" : "off"} /><div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-5 text-muted-foreground"><p className="font-bold text-foreground">Anti-poisoning rule</p>New facts never auto-publish from a customer conversation. Factual gaps enter the verification queue. Only repeated, high-confidence, non-sensitive style/workflow examples can auto-promote.</div></CardContent></Card></div>
      </TabsContent>

      <TabsContent value="dataset" className="space-y-4"><Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Dimpho-RK Training Dataset</CardTitle><CardDescription>This is the clean, versionable dataset you will eventually use to create a ResKonnect-specialized model or adapter. Live knowledge remains external even after fine-tuning.</CardDescription></div><Button onClick={() => void freezeDataset()} disabled={Boolean(busy)}><GraduationCap className="mr-2 h-4 w-4" />Freeze dataset snapshot</Button></div></CardHeader><CardContent className="grid gap-4 lg:grid-cols-3"><Metric icon={Brain} label="Active examples" value={examples.length} /><Metric icon={ShieldCheck} label="PII policy" value="redacted" /><Metric icon={Rocket} label="Frozen datasets" value={datasets.length} /></CardContent></Card>{datasets.length > 0 && <Card><CardHeader><CardTitle>Dataset versions</CardTitle></CardHeader><CardContent className="space-y-2">{datasets.map((d) => <div key={d.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{d.name}</p><p className="text-xs text-muted-foreground">{d.example_count} examples · checksum {String(d.checksum || "").slice(0, 12)}…</p></div><Badge>{d.status}</Badge></div>)}</CardContent></Card>}</TabsContent>
    </Tabs>
  </div>;
}

function ReleaseCard({ release, title, text, active }: { release: string; title: string; text: string; active: boolean }) { return <div className="rounded-2xl border bg-background/80 p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Release {release}</span><Badge className={active ? "bg-emerald-600" : ""}>{active ? "ACTIVE" : "DRAFT"}</Badge></div><p className="mt-3 font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>; }
function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: any }) { return <div className="rounded-xl border p-4"><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-2xl font-black">{value ?? 0}</p><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p></div>; }
function ToggleSetting({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: (value: boolean) => void }) { return <div className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold">{label}</p><Switch checked={checked} onCheckedChange={onCheckedChange} /></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p></div>; }
