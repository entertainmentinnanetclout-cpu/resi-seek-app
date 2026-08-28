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
  notes: string | null;
}

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
    return matchesSearch && matchesStatus && matchesInstitution;
  }), [applications, searchQuery, statusFilter, institutionFilter]);

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
          <div><h1 className="text-3xl font-black">Applications</h1><p className="text-muted-foreground">Review and manage source applications. Handover exports are available only through GOD MODE OS above.</p></div>
          <Badge variant="outline" className="w-fit gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Legacy handover export disabled</Badge>
        </div>

        {selectedIds.size > 0 && <Card className="border-primary/50 bg-primary/5"><CardContent className="flex flex-wrap items-center gap-3 py-3"><span className="font-medium">{selectedIds.size} selected</span><Button size="sm" onClick={() => void bulkUpdateStatus("approved")} disabled={bulkProcessing}><CheckCheck className="mr-2 h-4 w-4" />Approve All</Button><Button size="sm" variant="destructive" onClick={() => void bulkUpdateStatus("rejected")} disabled={bulkProcessing}><XCircle className="mr-2 h-4 w-4" />Reject All</Button><Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Clear Selection</Button></CardContent></Card>}

        <Card>
          <CardHeader><div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search by name, email, or residence..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="lg:w-48"><SelectValue placeholder="Filter status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{applicationStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
            <Select value={institutionFilter} onValueChange={(v) => setInstitutionFilter(v as any)}><SelectTrigger className="lg:w-48"><SelectValue placeholder="Institution type" /></SelectTrigger><SelectContent><SelectItem value="all">All Institutions</SelectItem><SelectItem value="university">University / TUT</SelectItem><SelectItem value="tvet">TVET / College</SelectItem><SelectItem value="private">Private</SelectItem><SelectItem value="other">Other / Unspecified</SelectItem></SelectContent></Select>
            {pendingCount > 0 && <Button variant="outline" onClick={() => setSelectedIds(new Set(pendingIds))}>Select All Pending ({pendingCount})</Button>}
          </div></CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : error ? <div className="py-10 text-center text-destructive"><p className="font-semibold">{error}</p><Button variant="outline" className="mt-4" onClick={() => void fetchApplications()}>Retry</Button></div> : filteredApplications.length === 0 ? <p className="py-10 text-center text-muted-foreground">No applications found</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-12"><Checkbox checked={selectedIds.size > 0 && selectedIds.size === pendingIds.length} onCheckedChange={(checked) => setSelectedIds(checked ? new Set(pendingIds) : new Set())} /></TableHead><TableHead>Student</TableHead><TableHead>Residence</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredApplications.map((app) => <TableRow key={app.application_id} className={selectedIds.has(app.application_id) ? "bg-primary/5" : ""}><TableCell>{(app.application_status === "submitted" || app.application_status === "pending") && <Checkbox checked={selectedIds.has(app.application_id)} onCheckedChange={() => toggleSelection(app.application_id)} />}</TableCell><TableCell><p className="font-medium">{app.student_name || "Unknown"}</p><p className="text-sm text-muted-foreground">{app.student_email}</p></TableCell><TableCell>{app.residence_name || "Unknown"}</TableCell><TableCell>{safeFormatDate(app.application_date)}</TableCell><TableCell>{getStatusBadge(app.application_status)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setSelectedApplication(app)}><Eye className="h-4 w-4" /></Button>{(app.application_status === "submitted" || app.application_status === "pending") && <><Button variant="ghost" size="icon" className="text-green-600" onClick={() => void updateStatus(app.application_id, "approved")}><Check className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => void updateStatus(app.application_id, "rejected")}><X className="h-4 w-4" /></Button></>}</TableCell></TableRow>)}</TableBody></Table></div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}><DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>Application Details</DialogTitle><DialogDescription>Review student application information and source documents.</DialogDescription></DialogHeader>{selectedApplication && <div className="space-y-4"><div className="grid grid-cols-2 gap-4"><Info label="Student Name" value={selectedApplication.student_name || "Unknown"} /><Info label="Student Number" value={selectedApplication.student_number || "N/A"} /><Info label="Email" value={selectedApplication.student_email || "N/A"} /><Info label="Phone" value={selectedApplication.student_phone || "N/A"} /><Info label="Residence" value={selectedApplication.residence_name || "Unknown"} /><Info label="Applied On" value={safeFormatDate(selectedApplication.application_date)} /></div><div><p className="mb-1 text-sm text-muted-foreground">Status</p>{getStatusBadge(selectedApplication.application_status)}</div>{selectedApplication.notes && <div><p className="mb-1 text-sm text-muted-foreground">Notes</p><p className="text-sm">{selectedApplication.notes}</p></div>}
        <div className="border-t pt-4"><div className="mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><Label className="text-sm font-semibold">Uploaded Documents</Label></div>{loadingDocuments ? <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading documents...</div> : userDocuments.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No documents uploaded by this student yet.</p> : <div className="max-h-48 space-y-2 overflow-y-auto">{userDocuments.map((doc) => <div key={doc.id} className="flex items-center justify-between rounded-md bg-muted/50 p-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium capitalize">{doc.document_type.replaceAll("_", " ")}</p><p className="truncate text-xs text-muted-foreground">{doc.file_name}</p></div><Button size="sm" variant="ghost" onClick={async () => { try { window.open(await getSignedUrl("documents", doc.file_path, 3600), "_blank"); } catch { toast.error("Failed to open document"); } }}><Eye className="h-4 w-4" /></Button></div>)}</div>}</div>
        <div className="space-y-3 border-t pt-4"><Label>Update Status</Label><Select onValueChange={(value) => void updateStatus(selectedApplication.application_id, value, statusNote)}><SelectTrigger><SelectValue placeholder="Change status..." /></SelectTrigger><SelectContent>{applicationStatuses.map((s) => <SelectItem key={s.value} value={s.value}><span className="flex items-center gap-2"><s.icon className="h-4 w-4" />{s.label}</span></SelectItem>)}</SelectContent></Select><div className="space-y-2"><Label className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />Add Note (optional)</Label><Textarea placeholder="Add a note about this status change..." value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2} /></div></div>
      </div>}</DialogContent></Dialog>
    </>
  );
};

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-sm text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>; }

const AdminApplications = () => <AdminLayout><AdminApplicationsContent /></AdminLayout>;
export default AdminApplications;
