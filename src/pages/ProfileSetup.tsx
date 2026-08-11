import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useRealtimeProfile(user);

  const [formData, setFormData] = useState<any>({});
  const [uploadedDocs, setUploadedDocs] = useState({
    id: false,
    registration: false,
    funding: false
  });
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name ?? '',
        student_number: profile.student_number ?? '',
        email: user?.email ?? '',
        phone: profile.phone ?? '',
        campus: profile.campus ?? '',
        course: profile.course ?? '',
        year_of_study: profile.year_of_study ?? '',
      });
    }
  }, [profile, user]);

  const progress = Object.values(uploadedDocs).filter(Boolean).length * 33.33;

  const handleFileUpload = async (docType: keyof typeof uploadedDocs, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!uploadedDocs.id || !uploadedDocs.registration || !user) {
      toast.error("Please upload all required documents");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('id', user.id);
      if (error) throw error;
      toast.success("Profile completed! You can now apply for residences.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const DocumentUploadBox = ({ 
    label, 
    docType, 
    isUploaded 
  }: { 
    label: string; 
    docType: keyof typeof uploadedDocs; 
    isUploaded: boolean;
  }) => (
    <div className={`p-4 border-2 border-dashed rounded-lg transition-all ${
      isUploaded ? 'border-green-500 bg-green-500/5' : 'border-border hover:border-primary/50'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {uploading === docType ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : isUploaded ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">
              {isUploaded ? 'Uploaded ✓' : 'PDF, JPG, PNG (max 10MB)'}
            </p>
          </div>
        </div>
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            onChange={(e) => handleFileUpload(docType, e)}
            disabled={uploading === docType}
          />
          <Button
            type="button"
            variant={isUploaded ? "outline" : "default"}
            size="sm"
            disabled={uploading === docType}
            asChild
          >
            <span>
              {uploading === docType ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploaded ? 'Replace' : 'Upload'}
                </>
              )}
            </span>
          </Button>
        </label>
      </div>
    </div>
  );

  return (
    <>
      <SEO
        title="Setup Your Profile | ResKonnect"
        description="Complete your profile to start applying for student accommodations."
      />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <img src={BRAND.logos.full} alt={BRAND.name} className="h-8 w-auto object-contain" />
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
            <p className="text-muted-foreground">
              Fill in your details and upload required documents to start applying for residences.
            </p>
          </div>

          {/* Progress */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Document Upload Progress</span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Required Documents</CardTitle>
                <CardDescription>Upload your verification documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DocumentUploadBox label="ID Copy" docType="id" isUploaded={uploadedDocs.id} />
                <DocumentUploadBox label="Proof of Registration" docType="registration" isUploaded={uploadedDocs.registration} />
                <DocumentUploadBox label="Proof of Funding (Optional)" docType="funding" isUploaded={uploadedDocs.funding} />
              </CardContent>
            </Card>

            {/* Personal Details */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Details</CardTitle>
                <CardDescription>Your student information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      value={formData.full_name || ''}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student_number">Student Number *</Label>
                    <Input
                      id="student_number"
                      name="student_number"
                      value={formData.student_number || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 123456789"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 0821234567"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="campus">Campus *</Label>
                    <Select
                      value={formData.campus || ''}
                      onValueChange={(v) => handleSelectChange('campus', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select campus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pretoria West">Pretoria West Campus</SelectItem>
                        <SelectItem value="Arts (Pretoria)">Arts Campus (Pretoria)</SelectItem>
                        <SelectItem value="Arcadia">Arcadia Campus</SelectItem>
                        <SelectItem value="Soshanguve North">Soshanguve North Campus</SelectItem>
                        <SelectItem value="Soshanguve South">Soshanguve South Campus</SelectItem>
                        <SelectItem value="Ga-Rankuwa">Ga-Rankuwa Campus</SelectItem>
                        <SelectItem value="Polokwane">Polokwane Campus</SelectItem>
                        <SelectItem value="Mbombela">Mbombela Campus (Nelspruit)</SelectItem>
                        <SelectItem value="eMalahleni">eMalahleni Campus (Witbank)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course">Course *</Label>
                    <Input
                      id="course"
                      name="course"
                      value={formData.course || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., BEng Tech"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year_of_study">Year of Study *</Label>
                    <Select
                      value={formData.year_of_study || ''}
                      onValueChange={(v) => handleSelectChange('year_of_study', v)}
                    >
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

            <Button type="submit" className="w-full" size="lg">
              Complete Setup & Continue
            </Button>
          </form>
        </div>
      </div>
    </>
  );
};

export default ProfileSetup;