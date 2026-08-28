import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileDown,
  Fingerprint,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, EXTERNAL_SUPABASE_ANON_KEY, externalFunctionUrl } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Mode = "strict_handover" | "document_handover" | "pipeline" | "audit";

type IntegrityIssue = {
  severity: "error" | "warning";
  code: string;
  category: string;
  application_id: string;
  user_id: string | null;
  residence_id: string | null;
  field_name: string;
  reason: string;
  suggested_action: string;
  auto_fixable: boolean;
  metadata?: Record<string, unknown>;
};

type ScanResult = {
  ok: boolean;
  policy_version: string;
  mode: Mode;
  integrity_score: number;
  blocking_errors: number;
  warnings: number;
  eligible_rows: number;
  total_students: number;
  excluded_rows: number;
  duplicates_found: number;
  issue_counts: Record<string, number>;
  issues: IntegrityIssue[];
  fingerprint: string;
  generated_at: string;
};

type PreparedExport = {
  ok: boolean;
  run_id?: string;
  fingerprint?: string;
  row_count?: number;
  generated_at?: string;
  validation: ScanResult;
  rows: any[];
};

interface Props {
  residenceId?: string | null;
}

const MODE_COPY: Record<Mode, { label: string; description: string }> = {
  strict_handover: { label: "Approved Handover", description: "Approved + conditionally approved applicants. Core data must be complete." },
  document_handover: { label: "Document Handover", description: "Strict handover plus ID and registration document completeness." },
  pipeline: { label: "Active Pipeline", description: "All active applications except rejected/withdrawn." },
  audit: { label: "Full Audit", description: "Every application, including closed history." },
};

const FUNDING_TYPES = ["nsfas", "private", "bursary", "scholarship", "employer", "family", "other", "undecided"];

export default function HandoverExportPanel({ residenceId = null }: Props) {
  const [mode, setMode] = useState<Mode>("strict_handover");
  const [residences, setResidences] = useState<Array<{ id: string; name: string }>>([]);
  const [scope, setScope] = useState(residenceId || "all");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [running, setRunning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [packExporting, setPackExporting] = useState(false);
  const [issueFilter, setIssueFilter] = useState("all");
  const [issueSearch, setIssueSearch] = useState("");
  const [selectedFundingApps, setSelectedFundingApps] = useState<Set<string>>(new Set());
  const [bulkFunding, setBulkFunding] = useState("nsfas");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any).from("residences").select("id,name").order("name");
      setResidences(data || []);
    })();
  }, []);

  useEffect(() => {
    setScan(null);
    setSelectedFundingApps(new Set());
  }, [scope, mode]);

  const scopeId = scope === "all" ? null : scope;

  const runScan = async () => {
    setRunning(true);
    const { data, error } = await (supabase as any).rpc("handover_integrity_scan", {
      _residence_id: scopeId,
      _mode: mode,
    });
    setRunning(false);
    if (error) return toast.error(error.message || "Integrity scan failed");
    setScan(data as ScanResult);
    toast[data?.ok ? "success" : "error"](data?.ok ? "Integrity gate passed" : `${data?.blocking_errors || 0} blocking issue(s) found`);
  };

  const safeRepair = async () => {
    setRepairing(true);
    const { data, error } = await (supabase as any).rpc("handover_safe_auto_repair", { _residence_id: scopeId });
    setRepairing(false);
    if (error) return toast.error(error.message || "Safe auto-repair failed");
    toast.success(`Safe repair complete: ${data?.duplicate_rows_quarantined || 0} duplicate row(s) quarantined`);
    await runScan();
  };

  const prepareVerifiedExport = async (): Promise<PreparedExport | null> => {
    const { data, error } = await (supabase as any).rpc("prepare_handover_export", {
      _residence_id: scopeId,
      _mode: mode,
    });
    if (error) {
      toast.error(error.message || "Verified export preparation failed");
      return null;
    }
    const prepared = data as PreparedExport;
    if (!prepared?.ok) {
      setScan(prepared.validation);
      toast.error("Export blocked. Resolve all blocking integrity errors first.");
      return null;
    }
    setScan(prepared.validation);
    return prepared;
  };

  const exportCsv = async () => {
    setExporting(true);
    const prepared = await prepareVerifiedExport();
    setExporting(false);
    if (!prepared) return;
    downloadVerifiedCsv(prepared);
    downloadJson(prepared, `reskonnect-handover-verification-${shortHash(prepared.fingerprint)}.json`);
    toast.success(`Verified export created: ${prepared.row_count || prepared.rows.length} row(s)`);
  };

  const exportVerifiedPack = async () => {
    if (!scopeId) return toast.error("Choose one residence before generating a residence handover pack.");
    if (mode !== "strict_handover" && mode !== "document_handover") return toast.error("Choose Approved Handover or Document Handover mode for a residence pack.");
    setPackExporting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your admin session has expired.");
      const response = await fetch(externalFunctionUrl("download-handover-pack"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: EXTERNAL_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ residence_id: scopeId, mode }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.validation) setScan(payload.validation);
        throw new Error(payload?.error || `Handover pack blocked (${response.status})`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      downloadBlob(blob, match?.[1] || `ResKonnect_Verified_Handover_${new Date().toISOString().slice(0, 10)}.html`);
      toast.success("Verified residence handover pack generated");
    } catch (error: any) {
      toast.error(error?.message || "Could not generate verified handover pack");
    } finally {
      setPackExporting(false);
    }
  };

  const openEditor = async (applicationId: string) => {
    setEditingId(applicationId);
    setEditOpen(true);
    setEditLoading(true);
    const { data, error } = await (supabase as any).rpc("handover_get_record", { _application_id: applicationId });
    setEditLoading(false);
    if (error) {
      toast.error(error.message || "Could not load applicant record");
      setEditOpen(false);
      return;
    }
    setEditRecord(data);
  };

  const saveCorrection = async () => {
    if (!editingId || !editRecord) return;
    setEditSaving(true);
    const patch = {
      full_name: editRecord.full_name || "",
      surname: editRecord.student_surname || "",
      student_number: editRecord.student_number || "",
      identity_number: editRecord.identity_number || "",
      funding_type: editRecord.funding_source || "",
      email: editRecord.email || "",
      phone: editRecord.phone || "",
      campus: editRecord.campus || "",
      course: editRecord.course || "",
    };
    const { error } = await (supabase as any).rpc("handover_update_record", { _application_id: editingId, _patch: patch });
    setEditSaving(false);
    if (error) return toast.error(error.message || "Could not save correction");
    toast.success("Applicant source record corrected and audit logged");
    setEditOpen(false);
    await runScan();
  };

  const missingFundingIssues = useMemo(() => scan?.issues.filter((i) => i.code === "missing_funding") || [], [scan]);
  const filteredIssues = useMemo(() => {
    const q = issueSearch.trim().toLowerCase();
    return (scan?.issues || []).filter((issue) => {
      const matchFilter = issueFilter === "all" || issue.severity === issueFilter || issue.category === issueFilter || issue.code === issueFilter;
      const matchSearch = !q || `${issue.code} ${issue.reason} ${issue.application_id} ${issue.field_name}`.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [scan, issueFilter, issueSearch]);

  const applyBulkFunding = async () => {
    if (!selectedFundingApps.size) return toast.error("Select the applications whose funding you have verified.");
    setBulkSaving(true);
    const { data, error } = await (supabase as any).rpc("handover_bulk_set_funding", {
      _application_ids: Array.from(selectedFundingApps),
      _funding_type: bulkFunding,
    });
    setBulkSaving(false);
    if (error) return toast.error(error.message || "Bulk funding update failed");
    toast.success(`${data?.updated || selectedFundingApps.size} application(s) updated to ${bulkFunding.toUpperCase()}`);
    setSelectedFundingApps(new Set());
    await runScan();
  };

  const criticalIssueCodes = useMemo(() => Object.entries(scan?.issue_counts || {}).filter(([code]) => ["missing_funding", "missing_surname", "missing_identity", "missing_phone", "missing_email", "missing_campus", "duplicate_application", "duplicate_student_number", "duplicate_identity_number"].includes(code)).sort((a, b) => b[1] - a[1]), [scan]);

  return (
    <>
      <Card className="overflow-hidden border-0 shadow-xl ring-1 ring-border">
        <div className="relative overflow-hidden bg-[#071326] px-5 py-6 text-white sm:px-7">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#F5B32F]"><Sparkles className="mr-1 h-3 w-3" /> GOD MODE OS</Badge>
                <Badge variant="outline" className="border-white/20 text-white">Atomic export snapshot</Badge>
                <Badge variant="outline" className="border-white/20 text-white">No validation bypass</Badge>
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Handover Integrity & Export Command Centre</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">The exporter now treats handover data like a controlled release: scan, repair safe defects, resolve verified source data, then generate an immutable fingerprinted export. Duplicate rows are quarantined, never silently deleted.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:w-[520px]">
              <Select value={scope} onValueChange={setScope}><SelectTrigger className="border-white/15 bg-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All residences · master integrity</SelectItem>{residences.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}><SelectTrigger className="border-white/15 bg-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(MODE_COPY) as Mode[]).map((key) => <SelectItem key={key} value={key}>{MODE_COPY[key].label}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
        </div>

        <CardContent className="space-y-5 p-5 sm:p-7">
          <div className="rounded-2xl border bg-muted/25 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="font-bold">{MODE_COPY[mode].label}</p><p className="text-xs text-muted-foreground">{MODE_COPY[mode].description}</p></div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void runScan()} disabled={running} className="gap-2">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Deep Integrity Scan</Button>
                <Button variant="outline" onClick={() => void safeRepair()} disabled={repairing} className="gap-2">{repairing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}Safe Auto-Repair</Button>
                <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting} className="gap-2">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Verified CSV + Receipt</Button>
                <Button onClick={() => void exportVerifiedPack()} disabled={!scopeId || packExporting || !["strict_handover", "document_handover"].includes(mode)} className="gap-2 bg-[#071326] text-white hover:bg-[#10284a]">{packExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Verified Residence Pack</Button>
              </div>
            </div>
          </div>

          {!scan ? <div className="rounded-2xl border border-dashed p-10 text-center"><Database className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-4 text-lg font-black">Run the integrity engine before handover</p><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">The engine checks identity, names, funding, contacts, residence links, workflow state, duplicate applications, cross-account identity collisions and document readiness. Export is impossible when a blocking defect exists.</p></div> : <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Integrity score" value={`${scan.integrity_score}%`} icon={Activity} tone={scan.ok ? "good" : "bad"} />
              <Metric label="Eligible rows" value={scan.eligible_rows} icon={Database} />
              <Metric label="Blocking errors" value={scan.blocking_errors} icon={ShieldAlert} tone={scan.blocking_errors ? "bad" : "good"} />
              <Metric label="Warnings" value={scan.warnings} icon={AlertTriangle} tone={scan.warnings ? "warn" : "good"} />
              <Metric label="Duplicates" value={scan.duplicates_found} icon={Fingerprint} tone={scan.duplicates_found ? "bad" : "good"} />
              <Metric label="Quarantined rows" value={scan.excluded_rows} icon={LockKeyhole} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr,.6fr]">
              <div className={`rounded-2xl border p-5 ${scan.ok ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-destructive/30 bg-destructive/[0.04]"}`}>
                <div className="flex items-start gap-3">{scan.ok ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" /> : <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />}<div className="min-w-0 flex-1"><p className="font-black">{scan.ok ? "Release gate passed" : "Release gate locked"}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{scan.ok ? "The current dataset can be exported through the atomic verified exporter. A new validation still runs inside the export transaction." : `${scan.blocking_errors} blocking issue(s) must be resolved. The system will not create a handover export while these remain.`}</p><Progress value={scan.integrity_score} className="mt-4 h-2" /></div></div>
              </div>
              <div className="rounded-2xl border p-5"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">SHA-256 dataset fingerprint</p><p className="mt-2 break-all font-mono text-[11px] leading-5">{scan.fingerprint}</p><p className="mt-2 text-[11px] text-muted-foreground">Policy {scan.policy_version} · {new Date(scan.generated_at).toLocaleString("en-ZA")}</p></div>
            </div>

            {criticalIssueCodes.length > 0 && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{criticalIssueCodes.slice(0, 10).map(([code, count]) => <button type="button" key={code} onClick={() => setIssueFilter(code)} className="rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-muted/40"><p className="text-xs font-semibold text-muted-foreground">{prettyCode(code)}</p><p className={`mt-1 text-2xl font-black ${Number(count) > 0 ? "text-destructive" : ""}`}>{count}</p></button>)}</div>}

            {missingFundingIssues.length > 0 && <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div><p className="font-black">Funding Resolver</p><p className="mt-1 text-xs text-muted-foreground">Funding is never guessed. Select only applicants whose funding you have verified, then apply the confirmed value in bulk.</p></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => setSelectedFundingApps(new Set(missingFundingIssues.map((i) => i.application_id)))}>Select all {missingFundingIssues.length}</Button><Select value={bulkFunding} onValueChange={setBulkFunding}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{FUNDING_TYPES.map((f) => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}</SelectContent></Select><Button size="sm" disabled={!selectedFundingApps.size || bulkSaving} onClick={() => void applyBulkFunding()}>{bulkSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply to {selectedFundingApps.size}</Button></div></div></div>}

            <div className="rounded-2xl border">
              <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-black">Integrity issue queue</p><p className="text-xs text-muted-foreground">Every blocking defect points back to its source application. Corrections are audit logged.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={issueSearch} onChange={(e) => setIssueSearch(e.target.value)} placeholder="Search issue or application" className="pl-9 sm:w-64" /></div><Select value={issueFilter} onValueChange={setIssueFilter}><SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All issues</SelectItem><SelectItem value="error">Blocking errors</SelectItem><SelectItem value="warning">Warnings</SelectItem><SelectItem value="duplicate">Duplicates</SelectItem><SelectItem value="identity">Identity</SelectItem><SelectItem value="funding">Funding</SelectItem><SelectItem value="contact">Contact</SelectItem><SelectItem value="documents">Documents</SelectItem></SelectContent></Select></div></div>
              <div className="max-h-[520px] overflow-auto p-3">
                {filteredIssues.length === 0 ? <div className="p-10 text-center"><FileCheck2 className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 font-black">No matching integrity issues</p></div> : <div className="space-y-2">{filteredIssues.map((issue, index) => {
                  const selected = selectedFundingApps.has(issue.application_id);
                  return <div key={`${issue.code}-${issue.application_id}-${index}`} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-start gap-3">{issue.code === "missing_funding" && <Checkbox checked={selected} onCheckedChange={() => setSelectedFundingApps((prev) => toggleSet(prev, issue.application_id))} className="mt-1" />}<Badge variant={issue.severity === "error" ? "destructive" : "secondary"} className="shrink-0">{issue.severity === "error" ? "BLOCK" : "WARN"}</Badge><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{prettyCode(issue.code)}</p><Badge variant="outline">{issue.category}</Badge>{issue.auto_fixable && <Badge variant="outline" className="border-emerald-500/30 text-emerald-700">safe auto-fix</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{issue.reason}</p><p className="mt-1 text-xs text-muted-foreground">{issue.suggested_action}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">App {issue.application_id}</p></div></div><Button size="sm" variant="outline" onClick={() => void openEditor(issue.application_id)}>Fix source record</Button></div>;
                })}</div>}
              </div>
            </div>
          </>}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>GOD MODE · Correct Source Record</DialogTitle><DialogDescription>Changes write back to the canonical profile/application and create a before/after integrity audit record.</DialogDescription></DialogHeader>
          {editLoading ? <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : editRecord && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full legal name"><Input value={editRecord.full_name || ""} onChange={(e) => setEditRecord({ ...editRecord, full_name: e.target.value })} /></Field>
            <Field label="Surname"><Input value={editRecord.student_surname || ""} onChange={(e) => setEditRecord({ ...editRecord, student_surname: e.target.value })} /></Field>
            <Field label="Student number"><Input value={editRecord.student_number || ""} onChange={(e) => setEditRecord({ ...editRecord, student_number: e.target.value })} placeholder="Leave blank when ID is the valid identifier" /></Field>
            <Field label="South African ID"><Input inputMode="numeric" value={editRecord.identity_number || ""} onChange={(e) => setEditRecord({ ...editRecord, identity_number: e.target.value })} placeholder="13-digit ID for TVET/matric/private applicants" /></Field>
            <Field label="Funding"><Select value={editRecord.funding_source || ""} onValueChange={(value) => setEditRecord({ ...editRecord, funding_source: value })}><SelectTrigger><SelectValue placeholder="Select verified funding" /></SelectTrigger><SelectContent>{FUNDING_TYPES.map((f) => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Phone / WhatsApp"><Input value={editRecord.phone || ""} onChange={(e) => setEditRecord({ ...editRecord, phone: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={editRecord.email || ""} onChange={(e) => setEditRecord({ ...editRecord, email: e.target.value })} /></Field>
            <Field label="Campus / institution"><Input value={editRecord.campus || ""} onChange={(e) => setEditRecord({ ...editRecord, campus: e.target.value })} /></Field>
            <Field label="Course / qualification" className="sm:col-span-2"><Input value={editRecord.course || ""} onChange={(e) => setEditRecord({ ...editRecord, course: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void saveCorrection()} disabled={editSaving}>{editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save correction & rescan</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone?: "good" | "bad" | "warn" }) {
  const toneClass = tone === "good" ? "text-emerald-600 bg-emerald-500/10" : tone === "bad" ? "text-destructive bg-destructive/10" : tone === "warn" ? "text-amber-700 bg-amber-500/10" : "text-primary bg-primary/10";
  return <div className="rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div><div className={`rounded-xl p-2 ${toneClass}`}><Icon className="h-4 w-4" /></div></div></div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className}`}><Label>{label}</Label>{children}</div>;
}

function prettyCode(code: string) {
  return code.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function toggleSet(previous: Set<string>, value: string) {
  const next = new Set(previous);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

function shortHash(value?: string) {
  return value?.slice(0, 12) || "unverified";
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadVerifiedCsv(prepared: PreparedExport) {
  const headers = ["Integrity Run", "SHA-256 Fingerprint", "Ref", "Residence", "Full Legal Name", "Surname", "Student Number", "South African ID", "Applicant Stage", "Funding", "Phone", "Email", "Campus", "Course / Qualification", "Status", "Application Date", "Move-in Date", "Moved In"];
  const rows = prepared.rows.map((r) => [prepared.run_id, prepared.fingerprint, r.ref_code, r.residence_name, r.full_name, r.student_surname, r.student_number, r.identity_number, r.applicant_stage, r.funding_source, r.phone, r.email, r.campus, r.course, r.status, r.application_date, r.move_in_date, r.moved_in ? "Yes" : "No"].map(csvEscape).join(","));
  const csv = [headers.map(csvEscape).join(","), ...rows].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `reskonnect-verified-handover-${new Date().toISOString().slice(0, 10)}-${shortHash(prepared.fingerprint)}.csv`);
}

function downloadJson(data: unknown, filename: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }), filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
