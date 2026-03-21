import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, Search, Download, Eye, Loader2, FileText, MessageSquare, UserCheck, Filter } from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted", className: "bg-yellow-500 text-white" },
  { value: "processing", label: "Processing", className: "bg-blue-500 text-white" },
  { value: "placed", label: "Placed", className: "bg-green-500 text-white" },
  { value: "not_suitable", label: "Not Suitable", className: "bg-destructive text-white" },
];

const AdminWIL = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campusFilter, setCampusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [adminNotes, setAdminNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wil_applications" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load WIL applications");
      console.error(error);
    }
    setApplications((data as any[]) || []);
    setLoading(false);
  };

  const openDetail = async (app: any) => {
    setSelectedApp(app);
    setDetailOpen(true);

    const [docsRes, notesRes] = await Promise.all([
      supabase.from("wil_documents" as any).select("*").eq("application_id", app.id).order("uploaded_at", { ascending: false }),
      supabase.from("wil_admin_notes" as any).select("*").eq("application_id", app.id).order("created_at", { ascending: false }),
    ]);

    setDocuments((docsRes.data as any[]) || []);
    setAdminNotes((notesRes.data as any[]) || []);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedApp) return;
    setUpdatingStatus(true);

    const { error } = await supabase
      .from("wil_applications" as any)
      .update({ status: newStatus })
      .eq("id", selectedApp.id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Status updated to ${newStatus}`);
      setSelectedApp({ ...selectedApp, status: newStatus });
      setApplications(prev => prev.map(a => a.id === selectedApp.id ? { ...a, status: newStatus } : a));
    }
    setUpdatingStatus(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedApp || !user) return;
    setSavingNote(true);

    const { data, error } = await supabase
      .from("wil_admin_notes" as any)
      .insert({ application_id: selectedApp.id, admin_id: user.id, note: newNote.trim() })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add note");
    } else {
      setAdminNotes(prev => [data as any, ...prev]);
      setNewNote("");
      toast.success("Note added");
    }
    setSavingNote(false);
  };

  const handleViewDoc = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from("wil-documents")
      .createSignedUrl(doc.file_path, 3600);
    if (error) { toast.error("Failed to open document"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const exportCSV = () => {
    const headers = ["Full Name", "Student Number", "Course", "Year Level", "Duration", "Funding", "Campus", "Status", "Preferred Area", "Date Submitted"];
    const rows = filtered.map(a => [
      a.full_name, a.student_number, a.course, a.year_level, a.wil_duration,
      a.funding_status, a.campus, a.status, a.preferred_area || "", format(new Date(a.created_at), "yyyy-MM-dd"),
    ].map(f => `"${String(f).replace(/"/g, '""')}"`).join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wil-applications-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  const filtered = applications.filter(a => {
    const matchesSearch = !search || a.full_name?.toLowerCase().includes(search.toLowerCase()) || a.student_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    const matchesCampus = campusFilter === "all" || a.campus === campusFilter;
    return matchesSearch && matchesStatus && matchesCampus;
  });

  const uniqueCampuses = [...new Set(applications.map(a => a.campus).filter(Boolean))];

  const getStatusBadge = (status: string) => {
    const config = STATUS_OPTIONS.find(s => s.value === status);
    return <Badge className={config?.className || ""}>{config?.label || status}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-primary" />
              WIL Management
            </h1>
            <p className="text-muted-foreground">{filtered.length} application{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={exportCSV} variant="outline" disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search by name or student number..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><Filter className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={campusFilter} onValueChange={setCampusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Campuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campuses</SelectItem>
                  {uniqueCampuses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">No WIL applications found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Student No.</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Funding</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(app => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.full_name}</TableCell>
                        <TableCell>{app.student_number}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{app.course}</TableCell>
                        <TableCell>{app.year_level}</TableCell>
                        <TableCell>{app.wil_duration}</TableCell>
                        <TableCell>{app.funding_status}</TableCell>
                        <TableCell>{app.campus}</TableCell>
                        <TableCell>{getStatusBadge(app.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(app.created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openDetail(app)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" /> WIL Application Details
            </DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Student Info */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Student Information</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-medium ml-1">{selectedApp.full_name}</span></div>
                    <div><span className="text-muted-foreground">Student No:</span> <span className="font-medium ml-1">{selectedApp.student_number}</span></div>
                    <div><span className="text-muted-foreground">Course:</span> <span className="font-medium ml-1">{selectedApp.course}</span></div>
                    <div><span className="text-muted-foreground">Year:</span> <span className="font-medium ml-1">{selectedApp.year_level}</span></div>
                    <div><span className="text-muted-foreground">Campus:</span> <span className="font-medium ml-1">{selectedApp.campus}</span></div>
                    <div><span className="text-muted-foreground">Duration:</span> <span className="font-medium ml-1">{selectedApp.wil_duration}</span></div>
                    <div><span className="text-muted-foreground">Funding:</span> <span className="font-medium ml-1">{selectedApp.funding_status}</span></div>
                    <div><span className="text-muted-foreground">Preferred Area:</span> <span className="font-medium ml-1">{selectedApp.preferred_area || "—"}</span></div>
                    {selectedApp.notes && (
                      <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> <span className="ml-1">{selectedApp.notes}</span></div>
                    )}
                  </CardContent>
                </Card>

                {/* Status Change */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
                  <CardContent className="flex items-center gap-3">
                    <Select value={selectedApp.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                      <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selectedApp.status !== "placed" && (
                      <Button size="sm" variant="default" onClick={() => handleStatusChange("placed")} disabled={updatingStatus}>
                        <UserCheck className="w-4 h-4 mr-1" /> Mark as Placed
                      </Button>
                    )}
                    {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
                  </CardContent>
                </Card>

                {/* Documents */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Documents ({documents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No documents uploaded</p>
                    ) : (
                      <div className="space-y-2">
                        {documents.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg border">
                            <div>
                              <p className="text-sm font-medium">{doc.doc_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                              <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleViewDoc(doc)}>
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Admin Notes */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Internal Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add an internal note..." rows={2} className="flex-1" />
                      <Button onClick={handleAddNote} disabled={savingNote || !newNote.trim()} className="self-end">
                        {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                    {adminNotes.length > 0 && <Separator />}
                    {adminNotes.map(note => (
                      <div key={note.id} className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{note.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(note.created_at), "dd MMM yyyy, HH:mm")}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const AdminWIL = () => (
  <AdminLayout><AdminWILContent /></AdminLayout>
);

export default AdminWIL;
