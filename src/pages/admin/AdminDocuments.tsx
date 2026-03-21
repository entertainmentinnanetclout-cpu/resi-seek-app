import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Eye, CheckCircle2, XCircle, Clock, FileText, Download, Loader2, User, Users, Phone, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatPhoneNumber } from "@/lib/exportHelpers";

interface Document {
  id: string;
  user_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
  status?: string;
  admin_notes?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  profiles?: {
    full_name: string;
    email: string;
    phone: string | null;
    student_number: string | null;
    campus: string | null;
  } | null;
}

interface StudentWithDocs {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  student_number: string | null;
  campus: string | null;
  documents: Document[];
  documentCount: number;
  hasApplication: boolean;
  applicationStatus?: string;
  residenceApplied?: string;
}

export const AdminDocumentsContent = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [studentsWithDocs, setStudentsWithDocs] = useState<StudentWithDocs[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<"verify" | "reject">("verify");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const fetchDocuments = async () => {
    try {
      // Fetch documents
      const { data: docsData, error } = await supabase
        .from("documents")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      // Fetch all profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, student_number, campus");

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Merge documents with profiles
      const docsWithProfiles = (docsData || []).map(doc => ({
        ...doc,
        profiles: profileMap.get(doc.user_id) || null
      }));

      setDocuments(docsWithProfiles);

      // Fetch applications to link with profiles
      const { data: applications } = await supabase
        .from("applications")
        .select("user_id, status, residence:residences!fk_applications_residence(name)");

      const appMap = new Map<string, { status: string; residenceName: string }>();
      applications?.forEach(app => {
        if (!appMap.has(app.user_id)) {
          appMap.set(app.user_id, {
            status: app.status,
            residenceName: app.residence?.name || ''
          });
        }
      });

      // Group by student
      const studentMap = new Map<string, StudentWithDocs>();
      docsWithProfiles.forEach(doc => {
        const profile = doc.profiles;
        if (!profile) return;

        if (!studentMap.has(profile.id)) {
          const appInfo = appMap.get(profile.id);
          studentMap.set(profile.id, {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            student_number: profile.student_number,
            campus: profile.campus,
            documents: [],
            documentCount: 0,
            hasApplication: !!appInfo,
            applicationStatus: appInfo?.status,
            residenceApplied: appInfo?.residenceName,
          });
        }

        const student = studentMap.get(profile.id)!;
        student.documents.push(doc);
        student.documentCount++;
      });

      setStudentsWithDocs(Array.from(studentMap.values()).sort((a, b) => b.documentCount - a.documentCount));
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    const channel = supabase
      .channel("documents-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => fetchDocuments())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePreview = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 300);

      if (error) throw error;

      setPreviewUrl(data.signedUrl);
      setSelectedDoc(doc);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("Failed to preview document");
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document");
    }
  };

  const openActionDialog = (doc: Document, type: "verify" | "reject") => {
    setSelectedDoc(doc);
    setActionType(type);
    setAdminNotes("");
    setActionOpen(true);
  };

  const handleAction = async () => {
    if (!selectedDoc) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: any = {
        status: actionType === "verify" ? "verified" : "rejected",
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
      };

      if (actionType === "reject") {
        updateData.admin_notes = adminNotes;
      }

      const { error } = await supabase
        .from("documents")
        .update(updateData)
        .eq("id", selectedDoc.id);

      if (error) throw error;

      toast.success(`Document ${actionType === "verify" ? "verified" : "rejected"}`);
      setActionOpen(false);
      fetchDocuments();
    } catch (error: any) {
      console.error("Action error:", error);
      toast.error(error.message || "Failed to update document");
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-success/20 text-success border-success/30 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
            <XCircle className="w-3 h-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30 gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </Badge>
        );
    }
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const formattedPhone = formatPhoneNumber(phone);
    const message = encodeURIComponent(
      `Hi ${name}, this is ResKonnect regarding your document submission. How can we assist you?`
    );
    window.open(`https://wa.me/${formattedPhone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.profiles?.student_number?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || doc.status === statusFilter || (!doc.status && statusFilter === "pending");

    return matchesSearch && matchesStatus;
  });

  const filteredStudents = studentsWithDocs.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: documents.length,
    pending: documents.filter((d) => !d.status || d.status === "pending").length,
    verified: documents.filter((d) => d.status === "verified").length,
    rejected: documents.filter((d) => d.status === "rejected").length,
    studentsWithDocs: studentsWithDocs.length,
  };

  return (
    <>
      <SEO title="Document Review | Admin" description="Review and verify student documents" />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Document Review</h1>
          <p className="text-muted-foreground">Review and verify student uploaded documents</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.verified}</p>
                  <p className="text-sm text-muted-foreground">Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.studentsWithDocs}</p>
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Documents</TabsTrigger>
            <TabsTrigger value="students">By Student ({stats.studentsWithDocs})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {/* Filters */}
            <Card className="mt-4">
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by student, document type, or file name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground mt-2">Loading documents...</p>
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No documents found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Document Type</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDocuments.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-full bg-primary/10">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{doc.profiles?.full_name || "Unknown"}</p>
                                  <p className="text-xs text-muted-foreground">{doc.profiles?.email}</p>
                                  {doc.profiles?.phone && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Phone className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs">{formatPhoneNumber(doc.profiles.phone)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{doc.document_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm truncate max-w-[150px]">{doc.file_name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(doc.uploaded_at), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>{getStatusBadge(doc.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handlePreview(doc)} title="Preview">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} title="Download">
                                  <Download className="w-4 h-4" />
                                </Button>
                                {doc.profiles?.phone && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-green-600"
                                    onClick={() => handleWhatsApp(doc.profiles!.phone!, doc.profiles!.full_name)}
                                    title="WhatsApp"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </Button>
                                )}
                                {(!doc.status || doc.status === "pending") && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-success hover:text-success"
                                      onClick={() => openActionDialog(doc, "verify")}
                                      title="Verify"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => openActionDialog(doc, "reject")}
                                      title="Reject"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Students with Documents</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No students found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredStudents.map((student) => (
                      <Card key={student.id} className="bg-secondary/30">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{student.full_name}</span>
                                <Badge variant="outline">{student.documentCount} docs</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{student.email}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {student.phone && (
                                  <span className="text-xs flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {formatPhoneNumber(student.phone)}
                                  </span>
                                )}
                                {student.campus && (
                                  <Badge variant="secondary" className="text-xs">{student.campus}</Badge>
                                )}
                                {student.hasApplication && (
                                  <Badge className={student.applicationStatus === 'approved' ? 'bg-success/20 text-success' : 'bg-blue-500/20 text-blue-500'}>
                                    {student.applicationStatus}
                                    {student.residenceApplied && ` - ${student.residenceApplied}`}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {student.phone && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(`tel:${formatPhoneNumber(student.phone)}`, '_self')}
                                  >
                                    <Phone className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600"
                                    onClick={() => handleWhatsApp(student.phone!, student.full_name)}
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Document list */}
                          <div className="mt-4 space-y-2">
                            {student.documents.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <span className="text-sm font-medium">{doc.document_type}</span>
                                    <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(doc.status)}
                                  <Button variant="ghost" size="icon" onClick={() => handlePreview(doc)}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Document Preview - {selectedDoc?.document_type}</DialogTitle>
          </DialogHeader>
          <div className="w-full h-[70vh] bg-muted rounded-lg overflow-hidden">
            {previewUrl && (
              <iframe src={previewUrl} className="w-full h-full" title="Document Preview" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "verify" ? "Verify Document" : "Reject Document"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{selectedDoc?.document_type}</p>
              <p className="text-sm text-muted-foreground">{selectedDoc?.file_name}</p>
              <p className="text-sm text-muted-foreground">Student: {selectedDoc?.profiles?.full_name}</p>
            </div>
            {actionType === "reject" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for rejection</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={saving || (actionType === "reject" && !adminNotes.trim())}
              className={actionType === "verify" ? "bg-success hover:bg-success/90" : "bg-destructive hover:bg-destructive/90"}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {actionType === "verify" ? "Verify Document" : "Reject Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AdminDocuments = () => (
  <AdminLayout><AdminDocumentsContent /></AdminLayout>
);

export default AdminDocuments;
