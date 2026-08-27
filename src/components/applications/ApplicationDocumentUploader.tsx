import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, FileText, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage/signedUrl";
import { toast } from "sonner";

const BASE_DOCS = [
  { key: "id_document", label: "ID document", description: "South African ID or passport", required: true },
  { key: "latest_results", label: "Latest academic results", description: "Most recent school, college or university results", required: true },
  { key: "proof_of_residence", label: "Proof of residence", description: "Recent proof of address", required: false },
  { key: "funding_document", label: "Funding / NSFAS document", description: "Funding proof where applicable", required: false },
  { key: "guardian_id", label: "Parent / guardian ID", description: "Where an institution requires it", required: false },
  { key: "other", label: "Other supporting document", description: "Any additional application document", required: false },
] as const;

export default function ApplicationDocumentUploader({ caseId, applicantStage, onReadinessChange }: { caseId: string; applicantStage?: string; onReadinessChange?: (ready: boolean) => void }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const docTypes = useMemo(() => applicantStage === "matriculant"
    ? [{ key: "id_document", label: "ID document", description: "South African ID or passport", required: true }, { key: "latest_results", label: "Grade 11 / latest Grade 12 results", description: "Latest available school results", required: true }, ...BASE_DOCS.slice(2)]
    : applicantStage === "tvet_student"
      ? [{ key: "id_document", label: "ID document", description: "South African ID or passport", required: true }, { key: "latest_results", label: "Latest results / certificate", description: "TVET or school results relevant to the application", required: true }, ...BASE_DOCS.slice(2)]
      : [...BASE_DOCS], [applicantStage]);

  const load = async () => {
    const { data, error } = await (supabase as any).from("application_assistance_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false });
    if (error) console.error("Could not load assistance documents", error);
    setDocuments(data || []);
  };

  useEffect(() => { void load(); }, [caseId]);
  useEffect(() => {
    const required = docTypes.filter((d) => d.required).map((d) => d.key);
    const ready = required.every((type) => documents.some((doc) => doc.document_type === type));
    onReadinessChange?.(ready);
  }, [documents, docTypes, onReadinessChange]);

  const byType = (type: string) => documents.find((doc) => doc.document_type === type);

  const upload = async (type: string, file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sign in to upload documents");
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Upload a PDF, JPG, PNG or WebP file");
    if (file.size > 10 * 1024 * 1024) return toast.error("Files must be 10MB or smaller");

    setUploading(type); setProgress(10);
    try {
      const existing = byType(type);
      if (existing) {
        await supabase.storage.from("application-documents").remove([existing.file_path]);
        await (supabase as any).from("application_assistance_documents").delete().eq("id", existing.id);
      }
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${user.id}/${caseId}/${type}_${Date.now()}.${ext}`;
      setProgress(30);
      const { error: storageError } = await supabase.storage.from("application-documents").upload(path, file, { cacheControl: "3600", upsert: false });
      if (storageError) throw storageError;
      setProgress(70);
      const { error: rowError } = await (supabase as any).from("application_assistance_documents").insert({ case_id: caseId, user_id: user.id, document_type: type, file_name: file.name, file_path: path, file_size: file.size });
      if (rowError) throw rowError;
      setProgress(100);
      toast.success("Application document saved");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Could not upload document");
    } finally {
      setUploading(null); setProgress(0);
    }
  };

  const openDocument = async (doc: any) => {
    try { window.open(await getSignedUrl("application-documents", doc.file_path, 900), "_blank", "noopener,noreferrer"); }
    catch { toast.error("Could not open document"); }
  };

  return <div className="space-y-3">
    {docTypes.map((type) => {
      const doc = byType(type.key);
      const busy = uploading === type.key;
      return <Card key={type.key} className={doc ? "border-emerald-500/30 bg-emerald-500/[0.04]" : type.required ? "border-amber-500/30" : ""}><CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${doc ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{doc ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-bold">{type.label}</p>{type.required && <span className="text-xs font-bold text-amber-600">Required</span>}</div><p className="mt-1 text-xs text-muted-foreground">{type.description}</p>{doc && <p className="mt-1 truncate text-xs font-medium">{doc.file_name}</p>}{busy && <div className="mt-2"><Progress value={progress} className="h-1.5" /></div>}</div>
          <input ref={(el) => { inputs.current[type.key] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { const file=e.target.files?.[0]; if (file) void upload(type.key,file); e.currentTarget.value=""; }} />
          <div className="flex shrink-0 gap-1">{doc && <Button type="button" variant="outline" size="icon" onClick={() => void openDocument(doc)}><Eye className="h-4 w-4" /></Button>}<Button type="button" variant={doc ? "outline" : "default"} size="icon" disabled={busy} onClick={() => inputs.current[type.key]?.click()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : doc ? <RefreshCw className="h-4 w-4" /> : <Upload className="h-4 w-4" />}</Button></div>
        </div>
      </CardContent></Card>;
    })}
  </div>;
}
