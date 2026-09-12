import { useEffect, useMemo, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import HandoverExportPanel from "@/components/admin/HandoverExportPanel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Check, X, CheckCheck, XCircle, Clock, FileQuestion, Calendar, Users, MessageSquare, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage/signedUrl";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/utils";

interface UserDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

interface Application {
  application_id: string;
  user_id: string;
  residence_id: string;
  application_status: string;
  application_date: string;
  created_at: string;
  residence_name: string;
  student_name: string;
  student_email: string;
  student_phone: string | null;
  student_number: string | null;
  institution_type: string | null;
  academic_year: number;
  academic_cycle: "unspecified" | "annual" | "semester" | "trimester";
  academic_period: number;
  study_level: "unspecified" | "undergraduate" | "postgraduate" | "advanced" | "other";
  student_stage: "unspecified" | "first_time" | "continuing" | "returning" | "advanced" | "graduating" | "other";
  notes: string | null;
}

const currentAcademicYear = new Date().getFullYear();
const academicYears = Array.from({ length: 5 }, (_, index) => currentAcademicYear - 1 + index);
const academicLabel = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase());

const applicationStatuses = [
  { value: "submitted", label: "Submitted", icon: FileQuestion },
  { value: "under_review", label: "Under Review", icon: Eye },
  { value: "documents_required", label: "Documents Required", icon: FileQuestion },
  { value: "interview_scheduled", label: "Interview Scheduled", icon: Calendar },
  { value: "waitlisted", label: "Waitlisted", icon: Users },
  { value: "conditionally_approved", label: "Conditionally Approved", icon: Clock },
  { value: "approved", label: "Approved", icon: Check },
  { value: "rejected", label: "Rejected", icon: X },
  { value: "withdrawn", label: "Withdrawn", icon: XCircle },
] as const;

export const AdminApplicationsContent = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [institutionFilter, setInstitutionFilter] = useState<"all" | "university" | "tvet" | "private" | "other">("all");
  const [academicYearFilter, setAcademicYearFilter] = useState("all");
  const [academicCycleFilter, setAcademicCycleFilter] = useState("all");
  const [studyLevelFilter, setStudyLevelFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [userDocuments, setUserDocuments] = useState<UserDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: appsError } = await supabase
        .from("admin_applications_safe" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (appsError) throw appsError;
      setApplications((data as any) || []);
    } catch (err) {
      console.error("[AdminApplications] load failed", err);
      setError("Failed to load applications. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApplications();
    const channel = supabase.channel("admin-applications")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => void fetchApplications())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchUserDocuments = async () => {
      if (!selectedApplication?.user_id) { setUserDocuments([]); return; }
      setLoadingDocuments(true);
      const { data, error: docsError } = await supabase.from("documents").select("*").eq("user_id", selectedApplication.user_id).order("uploaded_at", { ascending: false });
      setLoadingDocuments(false);
      if (docsError) { console.error(docsError); setUserDocuments([]); return; }
      setUserDocuments(data || []);
    };
    void fetchUserDocuments();
  }, [selectedApplication?.user_id]);

  const updateStatus = async (id: string, newStatus: string, note?: string) => {
    try {
      const app = applications.find((a) => a.application_id === id);
      const updateData: { status: string; notes?: string } = { status: newStatus };
      if (note) {
        const existingNotes = app?.notes || "";
        updateData.notes = `${existingNotes}\n[${new Date().toLocaleString()}] Status: ${newStatus} - ${note}`.trim();
      }
      const { error: updateError } = await supabase.from("applications").update(updateData).eq("id", id);
      if (updateError) throw updateError;
      if (app?.user_id) {
        const statusLabel = applicationStatuses.find((s) => s.value === newStatus)?.label || newStatus;
        await supabase.from("notifications").insert({
          user_id: app.user_id,
          type: "application_status",
          title: `Application ${statusLabel}`,
          message: `Your application for ${app.residence_name || "accommodation"} has been updated to: ${statusLabel}${note ? `. Note: ${note}` : ""}`,
          metadata: { application_id: id, status: newStatus, residence_name: app.residence_name },
        });
      }
      toast.success(`Application ${newStatus.replaceAll("_", " ")}`);
      setSelectedApplication(null);
      setStatusNote("");
      await fetchApplications();
    } catch (err: any) {
      console.error("Application status update failed", err);
      toast.error(err?.message || "Failed to update application. Handover-critical approvals are blocked until required data is complete.");
    }
  };

  const updateAcademicContext = async (app: Application, patch: Partial<Application>) => {
    const nextCycle = String(patch.academic_cycle ?? app.academic_cycle ?? "unspecified") as Application["academic_cycle"];
    let nextPeriod = Number(patch.academic_period ?? app.academic_period ?? 0);
    if (nextCycle === "unspecified") nextPeriod = 0;
    if (nextCycle === "annual") nextPeriod = 1;
    if (nextCycle === "semester") nextPeriod = Math.max(1, Math.min(2, nextPeriod || 1));
    if (nextCycle === "trimester") nextPeriod = Math.max(1, Math.min(3, nextPeriod || 1));
    const payload: any = {
      academic_year: Number(patch.academic_year ?? app.academic_year),
      academic_cycle: nextCycle,
      academic_period: nextPeriod,
      study_level: patch.study_level ?? app.study_level ?? "unspecified",
      student_stage: patch.student_stage ?? app.student_stage ?? "unspecified",
    };
    const { error: academicError } = await (supabase as any).from("applications").update(payload).eq("id", app.application_id);
    if (academicError) return toast.error(academicError.message || "Could not update academic classification");
    setSelectedApplication((current) => current?.application_id === app.application_id ? { ...current, ...payload } : current);
    setApplications((current) => current.map((row) => row.application_id === app.application_id ? { ...row, ...payload } : row));
    toast.success("Academic classification updated");
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    if (!selectedIds.size) return toast.error("No applications selected");
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    const { error: bulkError } = await supabase.from("applications").update({ status: newStatus }).in("id", ids);
    setBulkProcessing(false);
    if (bulkError) return toast.error(bulkError.message || "Bulk update failed. One or more applications may be missing handover-critical data.");
    toast.success(`${ids.length} applications updated`);
    setSelectedIds(new Set());
    await fetchApplications();
  };

  const filteredApplications = useMemo(() => applications.filter((app) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = app.student_name?.toLowerCase().includes(q) || app.residence_name?.toLowerCase().includes(q) || app.student_email?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || app.application_status === statusFilter;
    const inst = app.institution_type;
    const matchesInstitution = institutionFilter === "all" || (institutionFilter === "other" ? !inst : inst === institutionFilter);
    const matchesYear = academicYearFilter === "all" || app.academic_year === Number(academicYearFilter);
    const matchesCycle = academicCycleFilter === "all" || app.academic_cycle === academicCycleFilter;
    const matchesStudyLevel = studyLevelFilter === "all" || app.study_level === studyLevelFilter;
    return matchesSearch && matchesStatus && matchesInstitution && matchesYear && matchesCycle && matchesStudyLevel;
  }), [applications, searchQuery, statusFilter, institutionFilter, academicYearFilter, academicCycleFilter, studyLevelFilter]);

  const pendingIds = useMemo(() => filteredApplications.filter((app) => app.application_status === "submitted" || app.application_status === "pending").map((app) => app.application_id), [filteredApplications]);
  const pendingCount = pendingIds.length;

  const toggleSelection = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      submitted: "secondary", pending: "secondary", under_review: "default", documents_required: "secondary",
      interview_scheduled: "default", waitlisted: "secondary", conditionally_approved: "default", approved: "default",
      rejected: "destructive", withdrawn: "outline",
    };
    const label = applicationStatuses.find((s) => s.value === status)?.label || status.replaceAll("_", " ");
    return <Badge variant={variants[status] || "secondary"}>{label}</Badge>;
  };

  return (
    <>
      <SEO title="Manage Applications | Admin" description="Review, validate and manage accommodation applications" />
      <div className="space-y-6">
        <HandoverExportPanel />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-3xl font-black">Applications & Academic Cohorts</h1><p className="text-muted-foreground">Review applications by academic year, annual/semester/trimester cycle, study level and institutional context. Handover exports are available only through GOD MODE OS above.</p></div>
          <Badge variant="outline" className="w-fit gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Legacy handover export disabled</Badge>
        </div>

        {selectedIds.size > 0 && <Card className="border-primary/50 bg-primary/5"><CardContent className="flex flex-wrap items-center gap-3 py-3"><span className="font-medium">{selectedIds.size} selected</span><Button size="sm" onClick={() => void bulkUpdateStatus("approved")} disabled={bulkProcessing}><CheckCheck className="mr-2 h-4 w-4" />Approve All</Button><Button size="sm" variant="destructive" onClick={() => void bulkUpdateStatus("rejected")} disabled={bulkProcessing}><XCircle className="mr-2 h-4 w-4" />Reject All</Button><Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Clear Selection</Button></CardContent></Card>}

        <Card>
          <CardHeader><div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search by name, email, or residence..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="lg:w-48"><SelectValue placeholder="Filter status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{applicationStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
            <Select value={institutionFilter} onValueChange={(v) => setInstitutionFilter(v as any)}><SelectTrigger className="lg:w-48"><SelectValue placeholder="Institution type" /></SelectTrigger><SelectContent><SelectItem value="all">All Institutions</SelectItem><SelectItem value="university">University / TUT</SelectItem><SelectItem value="tvet">TVET / College</SelectItem><SelectItem value="private">Private</SelectItem><SelectItem value="other">Other / Unspecified</SelectItem></SelectContent></Select>
            <Select value={academicYearFilter} onValueChange={setAcademicYearFilter}><SelectTrigger className="lg:w-36"><SelectValue placeholder="Academic year" /></SelectTrigger><SelectContent><SelectItem value="all">All Years</SelectItem>{academicYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select>
            <Select value={academicCycleFilter} onValueChange={setAcademicCycleFilter}><SelectTrigger className="lg:w-44"><SelectValue placeholder="Academic cycle" /></SelectTrigger><SelectContent><SelectItem value="all">All Cycles</SelectItem><SelectItem value="annual">Annual</SelectItem><SelectItem value="semester">Semester</SelectItem><SelectItem value="trimester">Trimester</SelectItem><SelectItem value="unspecified">Unspecified</SelectItem></SelectContent></Select>
            <Select value={studyLevelFilter} onValueChange={setStudyLevelFilter}><SelectTrigger className="lg:w-44"><SelectValue placeholder="Study level" /></SelectTrigger><SelectContent><SelectItem value="all">All Levels</SelectItem><SelectItem value="undergraduate">Undergraduate</SelectItem><SelectItem value="postgraduate">Postgraduate</SelectItem><SelectItem value="advanced">Advanced</SelectItem><SelectItem value="other">Other</SelectItem><SelectItem value="unspecified">Unspecified</SelectItem></SelectContent></Select>
            {pendingCount > 0 && <Button variant="outline" onClick={() => setSelectedIds(new Set(pendingIds))}>Select All Pending ({pendingCount})</Button>}
          </div></CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : error ? <div className="py-10 text-center text-destructive"><p className="font-semibold">{error}</p><Button variant="outline" className="mt-4" onClick={() => void fetchApplications()}>Retry</Button></div> : filteredApplications.length === 0 ? <p className="py-10 text-center text-muted-foreground">No applications found</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-12"><Checkbox checked={selectedIds.size > 0 && selectedIds.size === pendingIds.length} onCheckedChange={(checked) => setSelectedIds(checked ? new Set(pendingIds) : new Set())} /></TableHead><TableHead>Student</TableHead><TableHead>Residence</TableHead><TableHead>Academic Context</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredApplications.map((app) => <TableRow key={app.application_id} className={selectedIds.has(app.application_id) ? "bg-primary/5" : ""}><TableCell>{(app.application_status === "submitted" || app.application_status === "pending") && <Checkbox checked={selectedIds.has(app.application_id)} onCheckedChange={() => toggleSelection(app.application_id)} />}</TableCell><TableCell><p className="font-medium">{app.student_name || "Unknown"}</p><p className="text-sm text-muted-foreground">{app.student_email}</p></TableCell><TableCell>{app.residence_name || "Unknown"}</TableCell><TableCell><div className="space-y-1"><Badge variant="outline">{app.academic_year} · {academicLabel(app.academic_cycle)}{app.academic_period > 0 ? ` ${app.academic_period}` : ""}</Badge><p className="text-xs text-muted-foreground">{academicLabel(app.study_level)} · {academicLabel(app.student_stage)}</p></div></TableCell><TableCell>{safeFormatDate(app.application_date)}</TableCell><TableCell>{getStatusBadge(app.application_status)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setSelectedApplication(app)}><Eye className="h-4 w-4" /></Button>{(app.application_status === "submitted" || app.application_status === "pending") && <><Button variant="ghost" size="icon" className="text-green-600" onClick={() => void updateStatus(app.application_id, "approved")}><Check className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => void updateStatus(app.application_id, "rejected")}><X className="h-4 w-4" /></Button></>}</TableCell></TableRow>)}</TableBody></Table></div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}><DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>Application Details</DialogTitle><DialogDescription>Review student application information and source documents.</DialogDescription></DialogHeader>{selectedApplication && <div className="space-y-4"><div className="grid grid-cols-2 gap-4"><Info label="Student Name" value={selectedApplication.student_name || "Unknown"} /><Info label="Student Number" value={selectedApplication.student_number || "N/A"} /><Info label="Email" value={selectedApplication.student_email || "N/A"} /><Info label="Phone" value={selectedApplication.student_phone || "N/A"} /><Info label="Residence" value={selectedApplication.residence_name || "Unknown"} /><Info label="Applied On" value={safeFormatDate(selectedApplication.application_date)} /><Info label="Academic Year" value={String(selectedApplication.academic_year)} /><Info label="Academic Cycle" value={`${academicLabel(selectedApplication.academic_cycle)}${selectedApplication.academic_period > 0 ? ` ${selectedApplication.academic_period}` : ""}`} /><Info label="Study Level" value={academicLabel(selectedApplication.study_level)} /><Info label="Student Stage" value={academicLabel(selectedApplication.student_stage)} /></div><div className="rounded-xl border bg-muted/20 p-3"><p className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Institutional Classification</p><div className="grid grid-cols-2 gap-3"><Select value={String(selectedApplication.academic_year)} onValueChange={(value) => void updateAcademicContext(selectedApplication, { academic_year: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{academicYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select><Select value={selectedApplication.academic_cycle} onValueChange={(value) => void updateAcademicContext(selectedApplication, { academic_cycle: value as Application["academic_cycle"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unspecified">Unspecified</SelectItem><SelectItem value="annual">Annual</SelectItem><SelectItem value="semester">Semester</SelectItem><SelectItem value="trimester">Trimester</SelectItem></SelectContent></Select><Select value={String(selectedApplication.academic_period)} onValueChange={(value) => void updateAcademicContext(selectedApplication, { academic_period: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(selectedApplication.academic_cycle === "semester" ? [1,2] : selectedApplication.academic_cycle === "trimester" ? [1,2,3] : selectedApplication.academic_cycle === "annual" ? [1] : [0]).map((period) => <SelectItem key={period} value={String(period)}>{period === 0 ? "Unspecified" : selectedApplication.academic_cycle === "annual" ? "Annual" : `Period ${period}`}</SelectItem>)}</SelectContent></Select><Select value={selectedApplication.study_level} onValueChange={(value) => void updateAcademicContext(selectedApplication, { study_level: value as Application["study_level"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unspecified">Unspecified</SelectItem><SelectItem value="undergraduate">Undergraduate</SelectItem><SelectItem value="postgraduate">Postgraduate</SelectItem><SelectItem value="advanced">Advanced</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><div className="col-span-2"><Select value={selectedApplication.student_stage} onValueChange={(value) => void updateAcademicContext(selectedApplication, { student_stage: value as Application["student_stage"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unspecified">Unspecified stage</SelectItem><SelectItem value="first_time">First-time</SelectItem><SelectItem value="continuing">Continuing</SelectItem><SelectItem value="returning">Returning</SelectItem><SelectItem value="advanced">Advanced-stage</SelectItem><SelectItem value="graduating">Final / graduating</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div></div><p className="mt-2 text-[11px] text-muted-foreground">Use verified student/institution information only. Historical records are not auto-guessed.</p></div><div><p className="mb-1 text-sm text-muted-foreground">Status</p>{getStatusBadge(selectedApplication.application_status)}</div>{selectedApplication.notes && <div><p className="mb-1 text-sm text-muted-foreground">Notes</p><p className="text-sm">{selectedApplication.notes}</p></div>}
        <div className="border-t pt-4"><div className="mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">Uploaded Documents</Label></div>{loadingDocuments ? <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading documents...</div> : userDocuments.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No documents uploaded by this student yet.</p> : <div className="max-h-48 space-y-2 overflow-y-auto">{userDocuments.map((doc) => <div key={doc.id} className="flex items-center justify-between rounded-md bg-muted/50 p-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium capitalize">{doc.document_type.replaceAll("_", " ")}</p><p className="truncate text-xs text-muted-foreground">{doc.file_name}</p></div><Button size="sm" variant="ghost" onClick={async () => { try { window.open(await getSignedUrl("documents", doc.file_path, 3600), "_blank"); } catch { toast.error("Failed to open document"); } }}><Eye className="h-4 w-4" /></Button></div>)}</div>}</div>
        <div className="space-y-3 border-t pt-4"><Label>Update Status</Label><Select onValueChange={(value) => void updateStatus(selectedApplication.application_id, value, statusNote)}><SelectTrigger><SelectValue placeholder="Change status..." /></SelectTrigger><SelectContent>{applicationStatuses.map((s) => <SelectItem key={s.value} value={s.value}><span className="flex items-center gap-2"><s.icon className="h-4 w-4" />{s.label}</span></SelectItem>)}</SelectContent></Select><div className="space-y-2"><Label className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />Add Note (optional)</Label><Textarea placeholder="Add a note about this status change..." value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2} /></div></div>
      </div>}</DialogContent></Dialog>
    </>
  );
};

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-sm text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>; }

const AdminApplications = () => <AdminLayout><AdminApplicationsContent /></AdminLayout>;
export default AdminApplications;
