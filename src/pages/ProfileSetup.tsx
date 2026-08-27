import SEO from "@/components/SEO";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";
import { BRAND } from "@/constants/brand";
import { TUT_CAMPUSES } from "@/lib/campuses";

const STAGES = [
  ["university_student", "University student"],
  ["tvet_student", "TVET student"],
  ["matriculant", "Matriculant / Grade 12"],
  ["private_applicant", "Private college / other applicant"],
  ["other", "Other"],
] as const;

const phonePattern = /^(\+27|0)[6-8][0-9]{8}$/;
const idPattern = /^\d{13}$/;

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useRealtimeProfile(user);
  const [formData, setFormData] = useState<any>({});
  const [identifierType, setIdentifierType] = useState<"student_number" | "identity_number">("student_number");
  const [uploadedDocs, setUploadedDocs] = useState({ id: false, registration: false, funding: false });
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const extended = profile as any;
    const stage = extended.applicant_stage || "university_student";
    const useId = Boolean(extended.identity_number && !extended.student_number) || ["tvet_student", "matriculant"].includes(stage);
    setIdentifierType(useId ? "identity_number" : "student_number");
    setFormData({
      full_name: profile.full_name ?? "",
      student_number: profile.student_number ?? "",
      identity_number: extended.identity_number ?? "",
      applicant_stage: stage,
      email: user?.email ?? "",
      phone: profile.phone ?? "",
      campus: profile.campus ?? "",
      course: profile.course ?? "",
      year_of_study: profile.year_of_study ?? "",
    });
  }, [profile, user]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("documents").select("document_type").eq("user_id", user.id);
      const types = new Set((data || []).map((row: any) => row.document_type));
      setUploadedDocs({ id: types.has("id"), registration: types.has("registration"), funding: types.has("funding") });
    })();
  }, [user?.id]);

  const stage = formData.applicant_stage || "university_student";
  const registrationRequired = ["university_student", "tvet_student"].includes(stage);
  const requiredDocKeys = registrationRequired ? ["id", "registration"] : ["id"];
  const requiredDone = requiredDocKeys.filter((key) => uploadedDocs[key as keyof typeof uploadedDocs]).length;
  const progress = requiredDocKeys.length ? (requiredDone / requiredDocKeys.length) * 100 : 100;

  const identifierValid = identifierType === "student_number"
    ? String(formData.student_number || "").trim().length >= 5
    : idPattern.test(String(formData.identity_number || "").trim());
  const contactValid = String(formData.full_name || "").trim().length >= 2 && phonePattern.test(String(formData.phone || "").trim()) && Boolean(formData.campus) && identifierValid;

  const handleFileUpload = async (docType: keyof typeof uploadedDocs, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) { toast.error("Only PDF, DOCX, JPG, PNG and WebP files are allowed"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File size must be less than 10MB"); return; }
    setUploading(docType);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${docType}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from("documents").insert({ user_id: user.id, file_path: fileName, file_name: file.name, document_type: docType, file_size: file.size } as any);
      if (dbError) throw dbError;
      setUploadedDocs((prev) => ({ ...prev, [docType]: true }));
      toast.success("Document uploaded successfully!");
    } catch (error: any) { toast.error(error.message || "Failed to upload document"); }
    finally { setUploading(null); event.target.value = ""; }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };
  const handleSelectChange = (name: string, value: string) => setFormData((prev: any) => ({ ...prev, [name]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (!contactValid) return toast.error(identifierType === "identity_number" ? "Complete your details with a valid phone number and 13-digit South African ID." : "Complete your details with a valid phone number and student number.");
    if (!uploadedDocs.id || (registrationRequired && !uploadedDocs.registration)) return toast.error(registrationRequired ? "Upload your ID and proof of registration before continuing." : "Upload your ID before continuing.");

    try {
      const payload = {
        full_name: String(formData.full_name || "").trim(),
        phone: String(formData.phone || "").trim(),
        campus: formData.campus,
        applicant_stage: stage,
        student_number: identifierType === "student_number" ? String(formData.student_number || "").trim() : null,
        identity_number: identifierType === "identity_number" ? String(formData.identity_number || "").trim() : null,
        course: String(formData.course || "").trim() || null,
        year_of_study: formData.year_of_study || null,
      };
      const { error } = await (supabase as any).from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile completed. Your ResKonnect account is ready.");
      navigate("/dashboard");
    } catch (error: any) { toast.error(error.message || "Could not save your profile"); }
  };

  const DocumentUploadBox = ({ label, docType, isUploaded, optional = false }: { label: string; docType: keyof typeof uploadedDocs; isUploaded: boolean; optional?: boolean }) => (
    <div className={`rounded-xl border-2 border-dashed p-4 transition-all ${isUploaded ? "border-green-500 bg-green-500/5" : "border-border hover:border-primary/50"}`}>
      <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3">{uploading === docType ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" /> : isUploaded ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" /> : <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" />}<div className="min-w-0"><p className="font-medium">{label}{optional ? " (Optional)" : ""}</p><p className="text-sm text-muted-foreground">{isUploaded ? "Uploaded ✓" : "PDF, DOCX, JPG, PNG, WebP · max 10MB"}</p></div></div><label className="shrink-0 cursor-pointer"><input type="file" className="hidden" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" onChange={(e) => void handleFileUpload(docType, e)} disabled={uploading === docType} /><Button type="button" variant={isUploaded ? "outline" : "default"} size="sm" disabled={uploading === docType} asChild><span><Upload className="mr-2 h-4 w-4" />{isUploaded ? "Replace" : "Upload"}</span></Button></label></div>
    </div>
  );

  const campuses = useMemo(() => [
    ...TUT_CAMPUSES.map((campus) => ({ value: campus.value, label: campus.label })),
    { value: "TVET / College applicant", label: "TVET / College applicant" },
    { value: "Not yet selected", label: "Matriculant — campus not yet selected" },
    { value: "Private / Other institution", label: "Private / Other institution" },
  ], []);

  return <>
    <SEO title="Setup Your Profile | ResKonnect" description="Complete your ResKonnect profile for accommodation, applications and opportunities." />
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur-sm"><div className="container mx-auto flex items-center px-4 py-4"><img src={BRAND.logos.full} alt={BRAND.name} className="h-9 w-auto object-contain" /></div></nav>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">ResKonnect profile</p><h1 className="mt-2 text-3xl font-black">Complete your profile</h1><p className="mt-2 text-muted-foreground">University students can use a student number. TVET students and matriculants may use a South African ID when they do not yet have a student number.</p></div>
        <Card className="mb-6"><CardContent className="pt-6"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">Required document progress</span><span className="text-sm text-muted-foreground">{Math.round(progress)}%</span></div><Progress value={progress} className="h-2" /></CardContent></Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card><CardHeader><CardTitle>Personal details</CardTitle><CardDescription>Used across accommodation and application journeys.</CardDescription></CardHeader><CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="full_name">Full name *</Label><Input id="full_name" name="full_name" value={formData.full_name || ""} onChange={handleInputChange} required /></div><div className="space-y-2"><Label>Applicant stage *</Label><Select value={stage} onValueChange={(value) => { handleSelectChange("applicant_stage", value); if (["tvet_student", "matriculant"].includes(value) && !formData.student_number) setIdentifierType("identity_number"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGES.map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1.5"><Button type="button" size="sm" variant={identifierType === "student_number" ? "default" : "ghost"} onClick={() => setIdentifierType("student_number")}>Student number</Button><Button type="button" size="sm" variant={identifierType === "identity_number" ? "default" : "ghost"} onClick={() => setIdentifierType("identity_number")}>SA ID</Button></div>
            {identifierType === "student_number" ? <div className="space-y-2"><Label htmlFor="student_number">Student number *</Label><Input id="student_number" name="student_number" value={formData.student_number || ""} onChange={handleInputChange} placeholder="Student number" /></div> : <div className="space-y-2"><Label htmlFor="identity_number">South African ID *</Label><Input id="identity_number" name="identity_number" inputMode="numeric" maxLength={13} value={formData.identity_number || ""} onChange={(e) => setFormData((prev:any) => ({ ...prev, identity_number:e.target.value.replace(/\D/g,"").slice(0,13) }))} placeholder="13-digit ID number" /></div>}
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Email</Label><Input value={user?.email || ""} disabled /></div><div className="space-y-2"><Label htmlFor="phone">Phone / WhatsApp *</Label><Input id="phone" name="phone" inputMode="tel" value={formData.phone || ""} onChange={handleInputChange} placeholder="0821234567" required /></div></div>
            <div className="space-y-2"><Label>Campus / study context *</Label><Select value={formData.campus || ""} onValueChange={(value) => handleSelectChange("campus", value)}><SelectTrigger><SelectValue placeholder="Select campus or context" /></SelectTrigger><SelectContent>{campuses.map((campus) => <SelectItem key={campus.value} value={campus.value}>{campus.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="course">Course / intended course</Label><Input id="course" name="course" value={formData.course || ""} onChange={handleInputChange} placeholder={stage === "matriculant" ? "What would you like to study?" : "Current course"} /></div><div className="space-y-2"><Label>Year of study</Label><Select value={formData.year_of_study || ""} onValueChange={(value) => handleSelectChange("year_of_study", value)}><SelectTrigger><SelectValue placeholder="Select if applicable" /></SelectTrigger><SelectContent><SelectItem value="1">1st Year</SelectItem><SelectItem value="2">2nd Year</SelectItem><SelectItem value="3">3rd Year</SelectItem><SelectItem value="4">4th Year</SelectItem><SelectItem value="postgrad">Postgraduate</SelectItem><SelectItem value="not_started">Not started yet</SelectItem></SelectContent></Select></div></div>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Verification documents</CardTitle><CardDescription>{registrationRequired ? "ID and proof of registration are required for your current student stage." : "Your ID is required. Registration can be added later once you are admitted/registered."}</CardDescription></CardHeader><CardContent className="space-y-4"><DocumentUploadBox label="ID Copy" docType="id" isUploaded={uploadedDocs.id} /><DocumentUploadBox label="Proof of Registration" docType="registration" isUploaded={uploadedDocs.registration} optional={!registrationRequired} /><DocumentUploadBox label="Proof of Funding" docType="funding" isUploaded={uploadedDocs.funding} optional /></CardContent></Card>
          <Button type="submit" className="w-full" size="lg" disabled={!contactValid}>Complete Setup & Continue</Button>
        </form>
      </div>
    </div>
  </>;
};

export default ProfileSetup;
