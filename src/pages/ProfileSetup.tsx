import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/Main header Desktop.png";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [uploadedDocs, setUploadedDocs] = useState({
    id: false,
    registration: false,
    funding: false
  });
  const [uploading, setUploading] = useState<string | null>(null);

  const progress = Object.values(uploadedDocs).filter(Boolean).length * 33.33;

  const handleFileUpload = async (docType: keyof typeof uploadedDocs, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, DOCX, JPG, and PNG files are allowed");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploading(docType);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${docType}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          file_path: fileName,
          file_name: file.name,
          document_type: docType,
          file_size: file.size
        });

      if (dbError) throw dbError;

      setUploadedDocs(prev => ({ ...prev, [docType]: true }));
      toast.success("Document uploaded successfully!");
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(null);
      event.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!uploadedDocs.id || !uploadedDocs.registration) {
      toast.error("Please upload all required documents");
      return;
    }

    toast.success("Profile completed! You can now apply for residences.");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={logo} alt="ResKonnect" className="h-8 w-auto" />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Progress Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Complete Your Profile</h1>
            <p className="text-sm md:text-base text-muted-foreground mb-4">
              Upload required documents to unlock residence applications
            </p>
            <div className="flex items-center gap-4">
              <Progress value={progress} className="flex-1" />
              <span className="text-sm font-medium whitespace-nowrap">{Math.round(progress)}%</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Personal Information</CardTitle>
                <CardDescription className="text-sm">Provide your student details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className="text-sm font-medium mb-2 block">
                      Full Name
                    </label>
                    <Input id="fullName" name="fullName" required placeholder="John Doe" />
                  </div>
                  <div>
                    <label htmlFor="studentNumber" className="text-sm font-medium mb-2 block">
                      Student Number
                    </label>
                    <Input id="studentNumber" name="studentNumber" required placeholder="u12345678" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="text-sm font-medium mb-2 block">
                      Email Address
                    </label>
                    <Input id="email" name="email" type="email" required placeholder="john@student.ac.za" />
                  </div>
                  <div>
                    <label htmlFor="phone" className="text-sm font-medium mb-2 block">
                      Phone Number
                    </label>
                    <Input id="phone" name="phone" type="tel" required placeholder="+27 12 345 6789" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="campus" className="text-sm font-medium mb-2 block">
                      Campus
                    </label>
                    <Select name="campus" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select campus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hatfield">Hatfield Campus</SelectItem>
                        <SelectItem value="mamelodi">Mamelodi Campus</SelectItem>
                        <SelectItem value="sunnyside">Sunnyside Campus</SelectItem>
                        <SelectItem value="groenkloof">Groenkloof Campus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="course" className="text-sm font-medium mb-2 block">
                      Course
                    </label>
                    <Input id="course" name="course" required placeholder="Computer Science" />
                  </div>
                  <div>
                    <label htmlFor="year" className="text-sm font-medium mb-2 block">
                      Year of Study
                    </label>
                    <Select name="year" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                        <SelectItem value="postgrad">Postgraduate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document Uploads */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Required Documents</CardTitle>
                <CardDescription className="text-sm">Upload these documents to complete your profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ID Upload */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm md:text-base">ID Copy</h4>
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">Required</span>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1">
                        Upload a clear copy of your ID (PDF, DOCX, JPG, PNG - Max 10MB)
                      </p>
                    </div>
                    {uploadedDocs.id && <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />}
                  </div>
                  <div className="relative">
                    <Input
                      type="file"
                      id="id-upload"
                      accept=".pdf,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload("id", e)}
                      className="hidden"
                      disabled={uploading === "id"}
                    />
                    <Button 
                      type="button"
                      variant={uploadedDocs.id ? "secondary" : "default"}
                      size="sm"
                      onClick={() => document.getElementById('id-upload')?.click()}
                      disabled={uploading === "id"}
                      className="w-full sm:w-auto"
                    >
                      {uploading === "id" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadedDocs.id ? "Re-upload" : "Upload ID"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Registration Upload */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm md:text-base">Proof of Registration</h4>
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">Required</span>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1">
                        Current year registration certificate (PDF, DOCX, JPG, PNG - Max 10MB)
                      </p>
                    </div>
                    {uploadedDocs.registration && <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />}
                  </div>
                  <div className="relative">
                    <Input
                      type="file"
                      id="registration-upload"
                      accept=".pdf,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload("registration", e)}
                      className="hidden"
                      disabled={uploading === "registration"}
                    />
                    <Button 
                      type="button"
                      variant={uploadedDocs.registration ? "secondary" : "default"}
                      size="sm"
                      onClick={() => document.getElementById('registration-upload')?.click()}
                      disabled={uploading === "registration"}
                      className="w-full sm:w-auto"
                    >
                      {uploading === "registration" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadedDocs.registration ? "Re-upload" : "Upload Registration"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Funding Upload */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm md:text-base">Proof of Funding</h4>
                        <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">Optional</span>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1">
                        Bursary letter or financial proof (PDF, DOCX, JPG, PNG - Max 10MB)
                      </p>
                    </div>
                    {uploadedDocs.funding && <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />}
                  </div>
                  <div className="relative">
                    <Input
                      type="file"
                      id="funding-upload"
                      accept=".pdf,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload("funding", e)}
                      className="hidden"
                      disabled={uploading === "funding"}
                    />
                    <Button 
                      type="button"
                      variant={uploadedDocs.funding ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => document.getElementById('funding-upload')?.click()}
                      disabled={uploading === "funding"}
                      className="w-full sm:w-auto"
                    >
                      {uploading === "funding" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadedDocs.funding ? "Re-upload" : "Upload Funding Proof"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {(!uploadedDocs.id || !uploadedDocs.registration) && (
                  <div className="flex items-start gap-2 text-xs md:text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>You must upload ID and Registration documents before applying for residences.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/dashboard")}
                className="flex-1"
              >
                Skip for Now
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={!uploadedDocs.id || !uploadedDocs.registration}
              >
                Complete Profile
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
