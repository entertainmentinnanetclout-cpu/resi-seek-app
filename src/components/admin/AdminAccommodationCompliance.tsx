import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { COMPLIANCE_REQUIREMENTS, EXTERNAL_STATUS_LABELS, GOVERNANCE_NOTICES, READINESS_STAGES } from "@/lib/compliance/nsfasStandards";
import { CheckCircle2, ExternalLink, FileCheck2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface CaseRow {
  id: string;
  residence_id: string;
  readiness_status: string;
  external_status: string;
  accreditation_authority: string | null;
  submission_reference: string | null;
  submission_date: string | null;
  inspection_reference: string | null;
  inspection_date: string | null;
  official_determination: string | null;
  official_accreditation_reference: string | null;
  accreditation_valid_from: string | null;
  accreditation_valid_until: string | null;
  official_grade: string | null;
  grade_valid_from: string | null;
  grade_valid_until: string | null;
  official_conditions: string | null;
  official_evidence_path: string | null;
  official_verified_at: string | null;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  residence?: { name?: string | null; address?: string | null; campus?: string | null } | null;
}

interface EvidenceRow {
  id: string;
  case_id: string;
  requirement_code: string;
  status: string;
  storage_path: string | null;
  original_name: string | null;
  issuer: string | null;
  document_reference: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  provider_note: string | null;
  reviewer_note: string | null;
  created_at: string;
}

interface RequestRow {
  id: string;
  residence_id: string;
  request_type: string;
  status: string;
  provider_note: string | null;
  created_at: string;
}

const AdminAccommodationCompliance = () => {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Partial<CaseRow>>({});

  const selected = useMemo(() => cases.find((item) => item.id === selectedId) || null, [cases, selectedId]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    const [{ data: caseRows, error: caseError }, { data: requestRows, error: requestError }] = await Promise.all([
      (supabase as any)
        .from("accommodation_compliance_cases")
        .select("*,residence:residences(name,address,campus)")
        .order("updated_at", { ascending: false }),
      (supabase as any)
        .from("accommodation_compliance_requests")
        .select("id,residence_id,request_type,status,provider_note,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (caseError) toast.error(caseError.message || "Could not load compliance cases.");
    if (requestError) toast.error(requestError.message || "Could not load compliance requests.");
    const nextCases = (caseRows || []) as CaseRow[];
    setCases(nextCases);
    setRequests((requestRows || []) as RequestRow[]);
    setSelectedId((current) => current && nextCases.some((item) => item.id === current) ? current : nextCases[0]?.id || null);
    setLoading(false);
  }, []);

  const loadEvidence = useCallback(async (caseId: string | null) => {
    if (!caseId) {
      setEvidence([]);
      return;
    }
    const { data, error } = await (supabase as any)
      .from("accommodation_compliance_evidence")
      .select("id,case_id,requirement_code,status,storage_path,original_name,issuer,document_reference,issue_date,expiry_date,provider_note,reviewer_note,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message || "Could not load case evidence.");
    setEvidence((data || []) as EvidenceRow[]);
  }, []);

  useEffect(() => { void loadCases(); }, [loadCases]);
  useEffect(() => { void loadEvidence(selectedId); }, [selectedId, loadEvidence]);
  useEffect(() => { setForm(selected ? { ...selected } : {}); }, [selected]);

  const filteredCases = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return cases;
    return cases.filter((item) => [item.residence?.name, item.residence?.address, item.residence?.campus, item.external_status, item.readiness_status].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [cases, query]);

  const latestEvidence = useMemo(() => {
    const map = new Map<string, EvidenceRow>();
    for (const row of evidence) if (!map.has(row.requirement_code)) map.set(row.requirement_code, row);
    return map;
  }, [evidence]);

  const saveCase = async (verifyOfficial = false) => {
    if (!selected) return;
    setSaving(true);
    const userResult = verifyOfficial ? await supabase.auth.getUser() : null;
    const patch: Record<string, unknown> = {
      readiness_status: form.readiness_status || selected.readiness_status,
      external_status: form.external_status || selected.external_status,
      accreditation_authority: form.accreditation_authority || null,
      submission_reference: form.submission_reference || null,
      submission_date: form.submission_date || null,
      inspection_reference: form.inspection_reference || null,
      inspection_date: form.inspection_date || null,
      official_determination: form.official_determination || null,
      official_accreditation_reference: form.official_accreditation_reference || null,
      accreditation_valid_from: form.accreditation_valid_from || null,
      accreditation_valid_until: form.accreditation_valid_until || null,
      official_grade: form.official_grade || null,
      grade_valid_from: form.grade_valid_from || null,
      grade_valid_until: form.grade_valid_until || null,
      official_conditions: form.official_conditions || null,
      next_review_at: form.next_review_at || null,
      last_reviewed_at: new Date().toISOString(),
    };
    if (verifyOfficial) {
      patch.official_verified_at = new Date().toISOString();
      patch.official_verified_by = userResult?.data.user?.id || null;
    }
    const { error } = await (supabase as any).from("accommodation_compliance_cases").update(patch).eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not update compliance case.");
      return;
    }
    toast.success(verifyOfficial ? "Official evidence status verified and published to the public-safe status layer." : "Compliance case saved.");
    await loadCases();
  };

  const updateEvidence = async (row: EvidenceRow, status: string) => {
    const user = await supabase.auth.getUser();
    const reviewerNote = window.prompt("Reviewer note (optional)", row.reviewer_note || "") ?? row.reviewer_note;
    const { error } = await (supabase as any)
      .from("accommodation_compliance_evidence")
      .update({ status, reviewer_note: reviewerNote || null, reviewed_by: user.data.user?.id || null, reviewed_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message || "Could not review evidence.");
      return;
    }
    toast.success("Evidence review status updated.");
    await loadEvidence(selectedId);
  };

  const openEvidence = async (row: EvidenceRow) => {
    if (!row.storage_path) return;
    const { data, error } = await supabase.storage.from("property-compliance-evidence").createSignedUrl(row.storage_path, 300);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Could not open evidence.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const updateRequest = async (request: RequestRow, status: string) => {
    const { error } = await (supabase as any).from("accommodation_compliance_requests").update({ status }).eq("id", request.id);
    if (error) {
      toast.error(error.message || "Could not update request.");
      return;
    }
    toast.success("Provider request updated.");
    await loadCases();
  };

  const activeRequests = requests.filter((item) => !["completed", "cancelled"].includes(item.status));

  return (
    <div className="space-y-5">
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Government-partner control boundary</AlertTitle>
        <AlertDescription>{GOVERNANCE_NOTICES.authority} Staff must not publish an official accreditation or grade without authority evidence and a validity period.</AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Open cases</p><p className="mt-2 text-3xl font-black">{cases.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Active requests</p><p className="mt-2 text-3xl font-black">{activeRequests.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Officially verified</p><p className="mt-2 text-3xl font-black">{cases.filter((item) => item.official_verified_at).length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-muted-foreground">Remediation</p><p className="mt-2 text-3xl font-black">{cases.filter((item) => item.readiness_status === "remediation_required").length}</p></CardContent></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Property cases</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search property, campus, status…" className="pl-9" /></div>
            <Button variant="outline" className="w-full" onClick={() => void loadCases()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh cases</Button>
            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {filteredCases.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === item.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <p className="truncate text-sm font-black">{item.residence?.name || "Unnamed property"}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.residence?.campus || item.residence?.address || "Location not recorded"}</p>
                  <div className="mt-2 flex flex-wrap gap-1"><Badge variant="outline">{READINESS_STAGES.find((stage) => stage.key === item.readiness_status)?.label || item.readiness_status}</Badge><Badge variant="secondary">{EXTERNAL_STATUS_LABELS[item.external_status] || item.external_status}</Badge></div>
                </button>
              ))}
              {!loading && filteredCases.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No compliance cases match this search.</p>}
            </div>
          </CardContent>
        </Card>

        {!selected ? (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Select a property compliance case.</CardContent></Card>
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>{selected.residence?.name || "Property compliance case"}</span>{selected.official_verified_at && <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Official evidence verified</Badge>}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div><Label>ResKonnect readiness</Label><Select value={String(form.readiness_status || selected.readiness_status)} onValueChange={(value) => setForm((old) => ({ ...old, readiness_status: value }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{READINESS_STAGES.map((stage) => <SelectItem key={stage.key} value={stage.key}>{stage.label}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>External authority status</Label><Select value={String(form.external_status || selected.external_status)} onValueChange={(value) => setForm((old) => ({ ...old, external_status: value }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EXTERNAL_STATUS_LABELS).filter(([key]) => key !== "unknown").map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
                <Field label="Accreditation authority" value={form.accreditation_authority} onChange={(value) => setForm((old) => ({ ...old, accreditation_authority: value }))} placeholder="NSFAS / institution / authority" />
                <Field label="Submission reference" value={form.submission_reference} onChange={(value) => setForm((old) => ({ ...old, submission_reference: value }))} />
                <DateField label="Submission date" value={form.submission_date} onChange={(value) => setForm((old) => ({ ...old, submission_date: value }))} />
                <Field label="Inspection reference" value={form.inspection_reference} onChange={(value) => setForm((old) => ({ ...old, inspection_reference: value }))} />
                <DateField label="Inspection date" value={form.inspection_date} onChange={(value) => setForm((old) => ({ ...old, inspection_date: value }))} />
                <Field label="Official accreditation reference" value={form.official_accreditation_reference} onChange={(value) => setForm((old) => ({ ...old, official_accreditation_reference: value }))} />
                <DateField label="Accreditation valid from" value={form.accreditation_valid_from} onChange={(value) => setForm((old) => ({ ...old, accreditation_valid_from: value }))} />
                <DateField label="Accreditation valid until" value={form.accreditation_valid_until} onChange={(value) => setForm((old) => ({ ...old, accreditation_valid_until: value }))} />
                <Field label="Official grade" value={form.official_grade} onChange={(value) => setForm((old) => ({ ...old, official_grade: value }))} placeholder="Record exactly as issued" />
                <DateField label="Grade valid from" value={form.grade_valid_from} onChange={(value) => setForm((old) => ({ ...old, grade_valid_from: value }))} />
                <DateField label="Grade valid until" value={form.grade_valid_until} onChange={(value) => setForm((old) => ({ ...old, grade_valid_until: value }))} />
                <DateField label="Next review date" value={form.next_review_at} onChange={(value) => setForm((old) => ({ ...old, next_review_at: value }))} />
                <div className="md:col-span-2 xl:col-span-3"><Label>Official determination / decision wording</Label><Textarea className="mt-1" value={String(form.official_determination || "")} onChange={(event) => setForm((old) => ({ ...old, official_determination: event.target.value }))} /></div>
                <div className="md:col-span-2 xl:col-span-3"><Label>Official conditions / directives</Label><Textarea className="mt-1" value={String(form.official_conditions || "")} onChange={(event) => setForm((old) => ({ ...old, official_conditions: event.target.value }))} /></div>
                <div className="md:col-span-2 xl:col-span-3 flex flex-wrap gap-2"><Button onClick={() => void saveCase(false)} disabled={saving}>Save internal case</Button><Button variant="default" onClick={() => void saveCase(true)} disabled={saving || !form.accreditation_valid_until || !form.accreditation_authority}><ShieldCheck className="mr-2 h-4 w-4" />Verify official evidence & publish safe status</Button></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Evidence review · 13 controlled categories</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {COMPLIANCE_REQUIREMENTS.map((requirement) => {
                  const row = latestEvidence.get(requirement.code);
                  return <div key={requirement.code} className="rounded-xl border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{requirement.title}</p>{requirement.coreGate && <Badge variant="secondary">Core progress set</Badge>}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{row?.original_name || "No evidence uploaded"}{row?.expiry_date ? ` · expires ${row.expiry_date}` : ""}</p>{row?.reviewer_note && <p className="mt-2 text-xs leading-5">Reviewer note: {row.reviewer_note}</p>}</div><div className="flex flex-wrap gap-2">{row?.storage_path && <Button size="sm" variant="outline" onClick={() => void openEvidence(row)}><ExternalLink className="mr-1 h-3.5 w-3.5" />Open</Button>}{row && <Select value={row.status} onValueChange={(value) => void updateEvidence(row, value)}><SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="uploaded_unreviewed">Awaiting review</SelectItem><SelectItem value="validated">Validated</SelectItem><SelectItem value="needs_correction">Needs correction</SelectItem><SelectItem value="expiring">Expiring</SelectItem><SelectItem value="expired">Expired</SelectItem><SelectItem value="not_applicable">Not applicable</SelectItem></SelectContent></Select>}</div></div></div>;
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Provider requests</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {requests.filter((item) => item.residence_id === selected.residence_id).slice(0, 20).map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-black">{request.request_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(request.created_at).toLocaleDateString("en-ZA", { dateStyle: "medium" })}</p>{request.provider_note && <p className="mt-2 text-sm leading-6 text-muted-foreground">{request.provider_note}</p>}</div><Select value={request.status} onValueChange={(value) => void updateRequest(request, value)}><SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="in_review">In review</SelectItem><SelectItem value="waiting_provider">Waiting provider</SelectItem><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div>)}
                {requests.filter((item) => item.residence_id === selected.residence_id).length === 0 && <p className="text-sm text-muted-foreground">No provider requests for this property yet.</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, placeholder }: { label: string; value: unknown; onChange: (value: string) => void; placeholder?: string }) => <div><Label>{label}</Label><Input className="mt-1" value={String(value || "")} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
const DateField = ({ label, value, onChange }: { label: string; value: unknown; onChange: (value: string) => void }) => <div><Label>{label}</Label><Input type="date" className="mt-1" value={String(value || "")} onChange={(event) => onChange(event.target.value)} /></div>;

export default AdminAccommodationCompliance;
