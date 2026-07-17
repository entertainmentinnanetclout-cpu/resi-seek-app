import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage/signedUrl";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Briefcase, Upload, FileText, Check, Eye, RefreshCw, Loader2, Clock, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { TUT_CAMPUSES } from "@/lib/campuses";

const WIL_DURATIONS = [
  { value: "1 Month", label: "1 Month" },
  { value: "3 Months", label: "3 Months" },
  { value: "6 Months", label: "6 Months" },
  { value: "12 Months", label: "12 Months" },
];

const FUNDING_OPTIONS = [
  { value: "NSFAS Funded", label: "NSFAS Funded" },
  { value: "Self-Funded", label: "Self-Funded" },
];

const WIL_DOC_TYPES = [
  { key: "id_document", label: "ID Document", description: "South African ID or Passport", required: true },
  { key: "proof_of_registration", label: "Proof of Registration", description: "Current year registration", required: true },
  { key: "cv", label: "CV / Resume", description: "Updated curriculum vitae", required: true },
  { key: "academic_record", label: "Academic Record", description: "Latest academic transcript", required: true },
  { key: "placement_letter", label: "Placement Letter Request", description: "Letter from institution" },
  { key: "motivation_letter", label: "Motivation Letter", description: "Personal motivation statement" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: "Submitted", color: "bg-yellow-500", icon: Clock },
  processing: { label: "Processing", color: "bg-blue-500", icon: Loader2 },
  placed: { label: "Placed", color: "bg-green-500", icon: CheckCircle2 },
  not_suitable: { label: "Not Suitable", color: "bg-destructive", icon: XCircle },
};

interface WilDocument {
  id: string;
  doc_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

const MyWIL = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [documents, setDocuments] = useState<WilDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<{ type: string; file: File } | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Form state
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [wilDuration, setWilDuration] = useState("");
  const [fundingStatus, setFundingStatus] = useState("");
  const [campus, setCampus] = useState("");
  const [preferredArea, setPreferredArea] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [profileRes, appRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("wil_applications" as any).select("*").eq("student_id", user.id).maybeSingle(),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      if (!appRes.data) {
        setCampus(profileRes.data.campus || "");
        setCourse(profileRes.data.course || "");
      }
    }

    if (appRes.data) {
      const app = appRes.data as any;
      setApplication(app);
      setCourse(app.course || "");
      setYearLevel(String(app.year_level || ""));
      setWilDuration(app.wil_duration || "");
      setFundingStatus(app.funding_status || "");
      setCampus(app.campus || "");
      setPreferredArea(app.preferred_area || "");
      setNotes(app.notes || "");

      // Load documents
      const { data: docs } = await supabase
        .from("wil_documents" as any)
        .select("*")
        .eq("application_id", app.id);
      setDocuments((docs as any[]) || []);
    }

    setLoading(false);
  };

  const isEditable = !application || application.status === "submitted";

  const handleSubmit = async () => {
    if (!user || !profile) return;

    if (!course || !yearLevel || !wilDuration || !fundingStatus || !campus) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    const payload = {
      student_id: user.id,
      full_name: profile.full_name || "",
      student_number: profile.student_number || "",
      course,
      year_level: parseInt(yearLevel),
      wil_duration: wilDuration,
      funding_status: fundingStatus,
      campus,
      preferred_area: preferredArea || null,
      notes: notes || null,
      status: "submitted",
    };

    try {
      if (application) {
        const { error } = await supabase
          .from("wil_applications" as any)
          .update(payload)
          .eq("id", application.id);
        if (error) throw error;
        toast.success("WIL application updated!");
      } else {
        const { data, error } = await supabase
          .from("wil_applications" as any)
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setApplication(data);
        toast.success("WIL application submitted!");
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save application");
    } finally {
      setSubmitting(false);
    }
  };

  // Document upload logic
  const getDocByType = (type: string) => documents.find(d => d.doc_type === type);

  const handleFileSelect = async (type: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF or image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be less than 10MB");
      return;
    }

    const existing = getDocByType(type);
    if (existing) {
      setPendingReplace({ type, file });
      setReplaceDialogOpen(true);
    } else {
      await uploadDoc(type, file);
    }
    if (fileInputRefs.current[type]) fileInputRefs.current[type]!.value = "";
  };

  const uploadDoc = async (type: string, file: File, replace = false) => {
    if (!user || !application) {
      toast.error("Please submit your application first before uploading documents");
      return;
    }

    setUploadingType(type);
    setUploadProgress(10);

    try {
      if (replace) {
        const existing = getDocByType(type);
        if (existing) {
          await supabase.storage.from("wil-documents").remove([existing.file_path]);
          await supabase.from("wil_documents" as any).delete().eq("id", existing.id);
        }
      }

      setUploadProgress(30);
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${type}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("wil-documents")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      setUploadProgress(70);

      const { error: dbError } = await supabase.from("wil_documents" as any).insert({
        application_id: application.id,
        student_id: user.id,
        doc_type: type,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      });
      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success(replace ? "Document replaced!" : "Document uploaded!");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingType(null);
      setUploadProgress(0);
    }
  };

  const handleViewDoc = async (doc: WilDocument) => {
    try {
      const url = await getSignedUrl("wil-documents", doc.file_path, 3600);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to open document");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-primary" />
              My WIL Placement Assistance
            </h1>
            <p className="text-muted-foreground mt-1">
              Submit your Work Integrated Learning placement request
            </p>
          </div>
          {application && STATUS_CONFIG[application.status] && (
            <Badge className={`${STATUS_CONFIG[application.status].color} text-white px-3 py-1`}>
              {STATUS_CONFIG[application.status].label}
            </Badge>
          )}
        </div>

        {/* Status Timeline */}
        {application && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                {["submitted", "processing", "placed"].map((step, i) => {
                  const isCurrent = application.status === step;
                  const isPast = ["submitted", "processing", "placed"].indexOf(application.status) > i;
                  const config = STATUS_CONFIG[step];
                  return (
                    <div key={step} className="flex items-center gap-2 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent || isPast ? config.color + " text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {isPast ? <Check className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className={`text-sm ${isCurrent ? "font-semibold" : "text-muted-foreground"}`}>
                        {config.label}
                      </span>
                      {i < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />}
                    </div>
                  );
                })}
              </div>
              {application.status === "not_suitable" && (
                <p className="text-sm text-destructive mt-3">
                  Your application has been marked as not suitable. Please contact support for more information.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
            <CardDescription>Auto-filled from your profile</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Full Name</Label>
              <Input value={profile?.full_name || ""} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Student Number</Label>
              <Input value={profile?.student_number || ""} disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* Academic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Academic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Course Name *</Label>
              <Input value={course} onChange={e => setCourse(e.target.value)} disabled={!isEditable} placeholder="e.g. Diploma in IT" />
            </div>
            <div>
              <Label>Year Level *</Label>
              <Select value={yearLevel} onValueChange={setYearLevel} disabled={!isEditable}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map(y => (
                    <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campus *</Label>
              <Select value={campus} onValueChange={setCampus} disabled={!isEditable}>
                <SelectTrigger><SelectValue placeholder="Select campus" /></SelectTrigger>
                <SelectContent>
                  {TUT_CAMPUSES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* WIL Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">WIL Placement Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>WIL Duration Required *</Label>
              <Select value={wilDuration} onValueChange={setWilDuration} disabled={!isEditable}>
                <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                <SelectContent>
                  {WIL_DURATIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Funding Status *</Label>
              <Select value={fundingStatus} onValueChange={setFundingStatus} disabled={!isEditable}>
                <SelectTrigger><SelectValue placeholder="Select funding" /></SelectTrigger>
                <SelectContent>
                  {FUNDING_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Preferred Placement Area</Label>
              <Input value={preferredArea} onChange={e => setPreferredArea(e.target.value)} disabled={!isEditable} placeholder="e.g. Software Development, Networking" />
            </div>
            <div className="md:col-span-2">
              <Label>Additional Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={!isEditable} placeholder="Any additional information..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        {isEditable && (
          <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Briefcase className="w-4 h-4 mr-2" />}
            {application ? "Update Application" : "Submit WIL Application"}
          </Button>
        )}

        {/* Document Uploads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supporting Documents</CardTitle>
            <CardDescription>
              {application ? "Upload your supporting documents below" : "Submit your application first, then upload documents"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WIL_DOC_TYPES.map(docType => {
                const uploaded = getDocByType(docType.key);
                const isUploading = uploadingType === docType.key;

                return (
                  <Card key={docType.key} className={`transition-all ${
                    uploaded ? "border-green-500/50 bg-green-500/5" : docType.required ? "border-orange-500/30" : ""
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {uploaded ? <Check className="w-5 h-5 text-green-500 flex-shrink-0" /> : <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                            <h3 className="font-medium truncate">
                              {docType.label}
                              {docType.required && !uploaded && <span className="text-orange-500 ml-1">*</span>}
                            </h3>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{docType.description}</p>
                          {uploaded && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <p className="truncate">{uploaded.file_name}</p>
                              <p>{formatFileSize(uploaded.file_size)}</p>
                            </div>
                          )}
                          {isUploading && (
                            <div className="mt-3">
                              <Progress value={uploadProgress} className="h-1" />
                              <p className="text-xs text-muted-foreground mt-1">Uploading... {uploadProgress}%</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <input type="file" ref={el => (fileInputRefs.current[docType.key] = el)} onChange={e => handleFileSelect(docType.key, e)} accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" disabled={isUploading || !application} />
                          {uploaded ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleViewDoc(uploaded)} disabled={isUploading}><Eye className="w-4 h-4" /></Button>
                              {isEditable && (
                                <Button size="sm" variant="outline" onClick={() => fileInputRefs.current[docType.key]?.click()} disabled={isUploading}>
                                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                </Button>
                              )}
                            </>
                          ) : (
                            <Button size="sm" onClick={() => fileInputRefs.current[docType.key]?.click()} disabled={isUploading || !application}>
                              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Replace Dialog */}
      <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Document?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the existing file.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingReplace(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (pendingReplace) await uploadDoc(pendingReplace.type, pendingReplace.file, true); setReplaceDialogOpen(false); setPendingReplace(null); }}>
              Replace Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default MyWIL;
