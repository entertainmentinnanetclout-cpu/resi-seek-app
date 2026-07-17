import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage/signedUrl";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, FileText, Check, Eye, RefreshCw, Loader2, X } from "lucide-react";

interface UploadedDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

interface DocumentType {
  key: string;
  label: string;
  description: string;
  required?: boolean;
}

const DOCUMENT_TYPES: DocumentType[] = [
  { key: "student_card", label: "Student Card", description: "Valid student ID card", required: true },
  { key: "proof_of_registration", label: "Proof of Registration", description: "Current year registration", required: true },
  { key: "id_document", label: "ID Document", description: "South African ID or Passport" },
  { key: "proof_of_residence", label: "Proof of Residence", description: "Utility bill or bank statement" },
  { key: "nsfas_approval", label: "NSFAS Approval Letter", description: "NSFAS funding confirmation" },
  { key: "other", label: "Other Documents", description: "Any additional supporting documents" },
];

export const DocumentUploader = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<{ type: string; file: File } | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching documents:", error);
      return;
    }

    setDocuments(data || []);
  };

  const getDocumentByType = (type: string): UploadedDocument | undefined => {
    return documents.find(doc => doc.document_type === type);
  };

  const handleFileSelect = async (type: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF or image file (JPG, PNG, WebP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    const existingDoc = getDocumentByType(type);
    
    if (existingDoc) {
      // Show confirmation dialog for replacement
      setPendingReplace({ type, file });
      setReplaceDialogOpen(true);
    } else {
      // Direct upload
      await uploadDocument(type, file);
    }

    // Reset file input
    if (fileInputRefs.current[type]) {
      fileInputRefs.current[type]!.value = "";
    }
  };

  const uploadDocument = async (type: string, file: File, isReplacement = false) => {
    if (!user) return;

    setUploadingType(type);
    setUploadProgress(10);

    const toastId = toast.loading(
      isReplacement ? "Replacing document..." : "Uploading document...",
      { description: file.name }
    );

    try {
      // If replacing, delete old file first
      if (isReplacement) {
        const existingDoc = getDocumentByType(type);
        if (existingDoc) {
          // Delete from storage
          await supabase.storage
            .from("documents")
            .remove([existingDoc.file_path]);

          // Delete from database
          await supabase
            .from("documents")
            .delete()
            .eq("id", existingDoc.id);
        }
      }

      setUploadProgress(30);

      // Upload new file
      const fileExt = file.name.split(".").pop();
      const fileName = `${type}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      // Save to database
      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        document_type: type,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      setUploadProgress(100);

      toast.success(
        isReplacement ? "Document replaced successfully!" : "Document uploaded successfully!",
        { id: toastId, description: file.name }
      );

      // Refresh documents list
      await fetchDocuments();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Upload failed", {
        id: toastId,
        description: error.message || "Please try again",
      });
    } finally {
      setUploadingType(null);
      setUploadProgress(0);
    }
  };

  const handleConfirmReplace = async () => {
    if (pendingReplace) {
      await uploadDocument(pendingReplace.type, pendingReplace.file, true);
    }
    setReplaceDialogOpen(false);
    setPendingReplace(null);
  };

  const handleViewDocument = async (doc: UploadedDocument) => {
    try {
      const url = await getSignedUrl("documents", doc.file_path, 3600);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error("Failed to open document");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOCUMENT_TYPES.map((docType) => {
          const uploadedDoc = getDocumentByType(docType.key);
          const isUploading = uploadingType === docType.key;

          return (
            <Card
              key={docType.key}
              className={`transition-all ${
                uploadedDoc
                  ? "border-green-500/50 bg-green-500/5"
                  : docType.required
                  ? "border-orange-500/30"
                  : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {uploadedDoc ? (
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <h3 className="font-medium truncate">
                        {docType.label}
                        {docType.required && !uploadedDoc && (
                          <span className="text-orange-500 ml-1">*</span>
                        )}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {docType.description}
                    </p>

                    {uploadedDoc && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p className="truncate">{uploadedDoc.file_name}</p>
                        <p>{formatFileSize(uploadedDoc.file_size)}</p>
                      </div>
                    )}

                    {isUploading && (
                      <div className="mt-3">
                        <Progress value={uploadProgress} className="h-1" />
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploading... {uploadProgress}%
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      ref={(el) => (fileInputRefs.current[docType.key] = el)}
                      onChange={(e) => handleFileSelect(docType.key, e)}
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      disabled={isUploading}
                    />

                    {uploadedDoc ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDocument(uploadedDoc)}
                          disabled={isUploading}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fileInputRefs.current[docType.key]?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => fileInputRefs.current[docType.key]?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Replace Confirmation Dialog */}
      <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Document?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a document uploaded for this type. Replacing it will
              permanently delete the existing file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingReplace(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>
              Replace Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentUploader;
