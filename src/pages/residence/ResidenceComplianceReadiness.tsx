import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { COMPLIANCE_REQUIREMENTS, EXTERNAL_STATUS_LABELS, GOVERNANCE_NOTICES, READINESS_STAGES } from "@/lib/compliance/nsfasStandards";
import type { ResidencePortalContext } from "./ResidenceLayout";
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, FileUp, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface ComplianceCase {
  id: string;
  residence_id: string;
  readiness_status: string;
  external_status: string;
  accreditation_authority: string | null;
  official_accreditation_reference: string | null;
  accreditation_valid_until: string | null;
  official_grade: string | null;
  grade_valid_until: string | null;
  official_verified_at: string | null;
  last_reviewed_at: string | null;
  next_review_at: string | null;
}

interface EvidenceRow {
  id: string;
  requirement_code: string;
  status: string;
  original_name: string | null;
  issuer: string | null;
  expiry_date: string | null;
  reviewer_note: string | null;
  created_at: string;
}

interface RequestRow {
  id: string;
  request_type: string;
  status: string;
  provider_note: string | null;
  created_at: string;
}

const statusTone: Record<string, string> = {
  validated: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  uploaded_unreviewed: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  needs_correction: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  expiring: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  expired: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  missing: "bg-muted text-muted-foreground",
  not_applicable: "bg-muted text-muted-foreground",
};

const evidenceLabel: Record<string, string> = {
  validated: "Validated",
  uploaded_unreviewed: "Uploaded · awaiting review",
  needs_correction: "Needs correction",
  expiring: "Expiring",
  expired: "Expired",
  missing: "Missing",
  not_applicable: "Not applicable",
};

const requestLabels: Record<string, string> = {
  initial_review: "Initial document review",
  document_review: "Document re-review",
  preinspection: "Property pre-inspection",
  remediation_review: "Remediation review",
  submission_support: "External submission support",
  appeal_support: "Outcome / appeal support",
  renewal_review: "Renewal review",
};

const ResidenceComplianceReadiness = () => {
  const { residence } = useOutletContext<ResidencePortalContext>();
  const [complianceCase, setComplianceCase] = useState<ComplianceCase | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestType, setRequestType] = useState("initial_review");
  const [requestNote, setRequestNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [uploadingCode, setUploadingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!residence?.id) return;
    setLoading(true);
    const [{ data: caseRows, error: caseError }, { data: requestRows, error: requestError }] = await Promise.all([
      (supabase as any).from("accommodation_compliance_cases").select("id,residence_id,readiness_status,external_status,accreditation_authority,official_accreditation_reference,accreditation_valid_until,official_grade,grade_valid_until,official_verified_at,last_reviewed_at,next_review_at").eq("residence_id", residence.id).limit(1),
      (supabase as any).from("accommodation_compliance_requests").select("id,request_type,status,provider_note,created_at").eq("residence_id", residence.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (caseError) console.error(caseError);
    if (requestError) console.error(requestError);
    const nextCase = (caseRows?.[0] || null) as ComplianceCase | null;
    setComplianceCase(nextCase);
    setRequests((requestRows || []) as RequestRow[]);
    if (nextCase) {
      const { data: evidenceRows, error: evidenceError } = await (supabase as any).from("accommodation_compliance_evidence")
        .select("id,requirement_code,status,original_name,issuer,expiry_date,reviewer_note,created_at")
        .eq("case_id", nextCase.id)
        .order("created_at", { ascending: false });
      if (evidenceError) console.error(evidenceError);
      setEvidence((evidenceRows || []) as EvidenceRow[]);
    } else {
      setEvidence([]);
    }
    setLoading(false);
  }, [residence?.id]);

  useEffect(() => { void load(); }, [load]);

  const latestByRequirement = useMemo(() => {
    const map = new Map<string, EvidenceRow>();
    for (const row of evidence) if (!map.has(row.requirement_code)) map.set(row.requirement_code, row);
    return map;
  }, [evidence]);

  const validated = COMPLIANCE_REQUIREMENTS.filter((item) => latestByRequirement.get(item.code)?.status === "validated").length;
  const uploaded = COMPLIANCE_REQUIREMENTS.filter((item) => latestByRequirement.has(item.code)).length;
  const readinessProgress = Math.round((validated / COMPLIANCE_REQUIREMENTS.length) * 100);
  const currentReadiness = READINESS_STAGES.find((stage) => stage.key === complianceCase?.readiness_status);
  const activeRequest = requests.find((request) => !["completed", "cancelled"].includes(request.status));

  const submitRequest = async () => {
    if (!residence?.id || requesting) return;
    setRequesting(true);
    const { error } = await (supabase as any).from("accommodation_compliance_requests").insert({
      residence_id: residence.id,
      request_type: requestType,
      provider_note: requestNote.trim() || null,
    });
    setRequesting(false);
    if (error) {
      toast.error(error.message || "Could not submit compliance request.");
      return;
    }
    toast.success("Compliance request submitted. Your case is now in the controlled workflow.");
    setRequestNote("");
    await load();
  };

  const uploadEvidence = async (code: string, file: File | null) => {
    if (!file || !residence?.id) return;
    if (!complianceCase?.id) {
      toast.error("Start a compliance review first so the evidence can be linked to a controlled case.");
      return;
    }
    const max = 15 * 1024 * 1024;
    if (file.size > max) {
      toast.error("File exceeds the 15 MB compliance-evidence limit.");
      return;
    }
    setUploadingCode(code);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
    const storagePath = `${residence.id}/${complianceCase.id}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from("property-compliance-evidence").upload(storagePath, file, { upsert: false });
    if (upload.error) {
      setUploadingCode(null);
      toast.error(upload.error.message || "Could not upload evidence.");
      return;
    }
    const { error } = await (supabase as any).from("accommodation_compliance_evidence").insert({
      case_id: complianceCase.id,
      requirement_code: code,
      storage_path: storagePath,
      original_name: file.name,
    });
    if (error) {
      await supabase.storage.from("property-compliance-evidence").remove([storagePath]);
      setUploadingCode(null);
      toast.error(error.message || "Could not register the uploaded evidence.");
      return;
    }
    setUploadingCode(null);
    toast.success("Evidence uploaded for ResKonnect review.");
    await load();
  };

  if (!residence) return <div className="py-20 text-center text-sm text-muted-foreground">Loading property…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Property OS · Compliance</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Accreditation Readiness</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">A controlled property file for documents, readiness, external status, evidence and the next ResKonnect-guided step.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Readiness is not accreditation</AlertTitle>
        <AlertDescription>{GOVERNANCE_NOTICES.authority}</AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">ResKonnect status</p><p className="mt-2 font-black">{currentReadiness?.label || (complianceCase ? complianceCase.readiness_status : "No case yet")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{currentReadiness?.description || "Start a review to open the controlled readiness case."}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">External status</p><p className="mt-2 font-black">{complianceCase ? EXTERNAL_STATUS_LABELS[complianceCase.external_status] || complianceCase.external_status : "Not recorded"}</p><p className="mt-1 text-xs text-muted-foreground">{complianceCase?.official_verified_at ? "Official evidence verified by ResKonnect" : "No verified authority decision on record"}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Evidence file</p><p className="mt-2 text-2xl font-black">{uploaded}/13</p><p className="mt-1 text-xs text-muted-foreground">categories with at least one upload</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Validated</p><p className="mt-2 text-2xl font-black">{validated}/13</p><Progress value={readinessProgress} className="mt-3 h-2" /></CardContent></Card>
      </div>

      {complianceCase?.official_verified_at && (
        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Verified official evidence</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Authority</p><p className="mt-1 font-bold">{complianceCase.accreditation_authority || "Recorded authority"}</p></div>
            <div><p className="text-xs text-muted-foreground">Reference</p><p className="mt-1 font-bold">{complianceCase.official_accreditation_reference || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Accreditation validity</p><p className="mt-1 font-bold">{complianceCase.accreditation_valid_until || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Official grade / period</p><p className="mt-1 font-bold">{complianceCase.official_grade ? `Grade ${complianceCase.official_grade}` : "Not recorded"}{complianceCase.grade_valid_until ? ` · to ${complianceCase.grade_valid_until}` : ""}</p></div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-black">Property compliance evidence</h2><p className="mt-1 text-sm text-muted-foreground">Upload what you currently have. “Uploaded” does not mean “validated”.</p></div><Badge variant="outline">Private vault</Badge></div>
          <div className="space-y-3">
            {COMPLIANCE_REQUIREMENTS.map((requirement, index) => {
              const row = latestByRequirement.get(requirement.code);
              const status = row?.status || "missing";
              return (
                <Card key={requirement.code}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-black">{String(index + 1).padStart(2, "0")}</div>
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{requirement.title}</h3>{requirement.coreGate && <Badge variant="secondary">Core progress set</Badge>}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{requirement.summary}</p>{row?.original_name && <p className="mt-2 truncate text-xs font-semibold">Latest: {row.original_name}</p>}{row?.reviewer_note && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">Reviewer: {row.reviewer_note}</p>}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[status] || statusTone.missing}`}>{evidenceLabel[status] || status}</span>
                        <Label className="cursor-pointer"><Input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" disabled={!complianceCase || uploadingCode === requirement.code} onChange={(event) => void uploadEvidence(requirement.code, event.target.files?.[0] || null)} /><span className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-xs font-bold hover:bg-muted"><FileUp className="mr-2 h-4 w-4" />{uploadingCode === requirement.code ? "Uploading…" : row ? "Upload new version" : "Upload evidence"}</span></Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <aside className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-lg">Request the next step</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {activeRequest && <Alert><Clock3 className="h-4 w-4" /><AlertTitle>Request already active</AlertTitle><AlertDescription>{requestLabels[activeRequest.request_type] || activeRequest.request_type} · {activeRequest.status.replaceAll("_", " ")}</AlertDescription></Alert>}
              <div><Label>Request type</Label><Select value={requestType} onValueChange={setRequestType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(requestLabels).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Provider note</Label><Textarea value={requestNote} onChange={(event) => setRequestNote(event.target.value)} placeholder="What changed, what is missing, or what do you need ResKonnect to review?" className="mt-1 min-h-28" /></div>
              <Button className="w-full" disabled={requesting} onClick={() => void submitRequest()}>{requesting ? "Submitting…" : "Submit request"}</Button>
              <p className="text-xs leading-5 text-muted-foreground">A first request automatically opens the controlled property case. ResKonnect targets initial document-audit feedback within 3 working days after a complete upload set.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Recent requests</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {requests.length === 0 ? <p className="text-sm text-muted-foreground">No requests yet.</p> : requests.slice(0,6).map((request) => <div key={request.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold">{requestLabels[request.request_type] || request.request_type}</p><Badge variant="outline">{request.status.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{new Date(request.created_at).toLocaleDateString("en-ZA", { dateStyle: "medium" })}</p>{request.provider_note && <p className="mt-2 text-xs leading-5 text-muted-foreground">{request.provider_note}</p>}</div>)}
            </CardContent>
          </Card>

          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Keep originals and expiry dates</AlertTitle>
            <AlertDescription>Do not alter certificates to make a category appear complete. ResKonnect may request replacements, current issuer evidence or a site visit before the case progresses.</AlertDescription>
          </Alert>
        </aside>
      </div>
    </div>
  );
};

export default ResidenceComplianceReadiness;
