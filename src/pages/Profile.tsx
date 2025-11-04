import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const { isUploading, uploadFile } = useFileUpload();
  const { user } = useAuth();
  const { profile, loading } = useRealtimeProfile(user);
  const [formData, setFormData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData || !user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };


  const handleDocumentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user || !selectedDocType) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(files[0].type)) {
      toast.error('Only PDF, JPG, or PNG files are allowed');
      return;
    }

    // Validate file size (10MB max)
    if (files[0].size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }

    setUploadingDoc(selectedDocType);
    const file = files[0];
    const fileExtension = file.name.split(".").pop();
    const fileName = `${user.id}-${selectedDocType.toLowerCase().replace(" ", "-")}-${Date.now()}.${fileExtension}`;
    const path = `documents/${fileName}`;

    const url = await uploadFile(file, "documents", path);
    if (url) {
      try {
        const updates = {
          [`${selectedDocType.toLowerCase().replace(" ", "_")}_url`]: url,
          [`${selectedDocType.toLowerCase().replace(" ", "_")}_status`]: "uploaded",
        };
        const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
        if (error) throw error;
        toast.success(`${selectedDocType} uploaded successfully!`);
      } catch (err: any) {
        toast.error(err.message);
      }
    }
    setUploadingDoc(null);
    setSelectedDocType(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => (prev ? { ...prev, [name]: value } : null));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => (prev ? { ...prev, [name]: value } : null));
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Profile</h1>
              <p className="text-muted-foreground">
                Manage your personal information and documents
              </p>
            </div>
            {!isEditing && (
              <Button variant="default" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>

          {/* Personal Information */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your student details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Full Name</label>
                    <Input
                      name="full_name"
                      value={formData?.full_name ?? ""}
                      onChange={handleInputChange}
                      disabled={!isEditing || loading}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Student Number</label>
                    <Input
                      name="student_number"
                      value={formData?.student_number ?? ""}
                      onChange={handleInputChange}
                      disabled={!isEditing || loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email Address</label>
                    <Input
                      type="email"
                      name="email"
                      value={formData?.email ?? ""}
                      onChange={handleInputChange}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phone Number</label>
                    <Input
                      type="tel"
                      name="phone"
                      value={formData?.phone ?? ""}
                      onChange={handleInputChange}
                      disabled={!isEditing || loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Campus</label>
                    <Select
                      name="campus"
                      value={formData?.campus ?? ""}
                      onValueChange={(value) => handleSelectChange("campus", value)}
                      disabled={!isEditing || loading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hatfield">Hatfield Campus</SelectItem>
                        <SelectItem value="mamelodi">Mamelodi Campus</SelectItem>
                        <SelectItem value="sunnyside">Sunnyside Campus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Course</label>
                    <Input
                      name="course"
                      value={formData?.course ?? ""}
                      onChange={handleInputChange}
                      disabled={!isEditing || loading}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Year of Study</label>
                    <Select
                      name="year_of_study"
                      value={formData?.year_of_study ?? ""}
                      onValueChange={(value) => handleSelectChange("year_of_study", value)}
                      disabled={!isEditing || loading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="accent"
                      className="flex-1"
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Save Changes
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Uploaded Documents</CardTitle>
              <CardDescription>Your verified documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                type="file"
                ref={documentInputRef}
                onChange={handleDocumentChange}
                className="hidden"
                accept="application/pdf, image/png, image/jpeg"
              />
              {["ID Copy", "Proof of Registration", "Proof of Funding"].map((doc) => (
                <div
                  key={doc}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-medium">{doc}</p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.[`${doc.toLowerCase().replace(" ", "_")}_status`] === "uploaded"
                          ? "Uploaded"
                          : "Not Uploaded"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDocType(doc);
                      documentInputRef.current?.click();
                    }}
                    disabled={uploadingDoc === doc}
                  >
                    {uploadingDoc === doc ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Replace
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
