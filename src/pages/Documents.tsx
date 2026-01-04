import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import DocumentUploader from "@/components/DocumentUploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Shield, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

const Documents = () => {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;

  return (
    <DashboardLayout>
      <SEO
        title="My Documents | Upload Supporting Documents"
        description="Upload and manage your supporting documents for residence applications."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display">My Documents</h1>
              <p className="text-muted-foreground">
                Upload and manage your supporting documents
              </p>
            </div>
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Upload your supporting documents to complete your profile. Required documents are
              marked with an asterisk (*). You can replace any document by clicking the refresh
              button.
            </AlertDescription>
          </Alert>

          {/* Security Note */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Your documents are secure</p>
                <p className="text-muted-foreground mt-1">
                  All documents are encrypted and stored securely. Only you and authorized
                  administrators can view your documents.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Document Uploader */}
          <Card>
            <CardHeader>
              <CardTitle>Supporting Documents</CardTitle>
              <CardDescription>
                Upload PDF or image files (max 10MB each). Click to upload or drag and drop.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUploader />
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tips for Document Upload</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Ensure documents are clear and legible</p>
              <p>• Student cards should show your photo and student number</p>
              <p>• Proof of registration must be for the current academic year</p>
              <p>• NSFAS approval letter should show your funding status</p>
              <p>• Accepted formats: PDF, JPG, PNG, WebP</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Documents;
