import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const { isUploading, uploadFile } = useFileUpload();
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    full_name: "",
    student_number: "",
    email: "",
    phone: "",
    campus: "",
    course: "",
    year_of_study: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, student_number, email, phone, campus, course, year_of_study")
        .eq("id", user?.id)
        .single();

      if (!error && data) setProfile(data);
    };

    if (user?.id) fetchProfile();
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("id", user.id)
      .select();

    setIsSaving(false);

    if (error) {
      console.error('Save error:', error);
      toast.error('Failed to save changes. Please try again.');
    } else {
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    }
  };


  const handleDocumentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user || !selectedDocType) return;

    const file = files[0];
    const allowedExtensions = ['pdf', 'jpeg', 'jpg', 'png'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      toast.error('Only PDF, JPG, or PNG files are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }

    setUploadingDoc(selectedDocType);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const fileData = reader.result as string;
      const response = await fetch('/api/handler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadFile',
          user_id: user.id,
          fileName: file.name,
          fileData,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`${selectedDocType} uploaded successfully!`);
        const updates = {
          [`${selectedDocType.toLowerCase().replace(" ", "_")}_url`]: result.url,
          [`${selectedDocType.toLowerCase().replace(" ", "_")}_status`]: "uploaded",
        };
        await supabase.from("profiles").update(updates).eq("id", user.id);
      } else {
        toast.error(`Upload failed: ${result.error}`);
      }
      setUploadingDoc(null);
      setSelectedDocType(null);
    };
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
          <Card className="shadow-card bg-card dark:bg-card/80">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your student details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">Full Name</label>
                    <Input
                      value={profile.full_name || ""}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, full_name: e.target.value }))
                      }
                      placeholder="Enter your full name"
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">Student Number</label>
                    <Input
                      value={profile.student_number || ""}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, student_number: e.target.value }))
                      }
                      placeholder="Enter your student number"
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">Email Address</label>
                    <Input
                      value={user?.email || ""}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">Phone Number</label>
                    <Input
                      value={profile.phone || ""}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="Enter your phone number"
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">Campus</label>
                    <Select
                      value={profile.campus || ""}
                      onValueChange={(value) =>
                        setProfile((prev) => ({ ...prev, campus: value }))
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your campus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hatfield">Hatfield Campus</SelectItem>
                        <SelectItem value="mamelodi">Mamelodi Campus</SelectItem>
                        <SelectItem value="sunnyside">Sunnyside Campus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">Course</label>
                    <Input
                      value={profile.course || ""}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, course: e.target.value }))
                      }
                      placeholder="Enter your course"
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block text-muted-foreground">Year of Study</label>
                    <Select
                      value={profile.year_of_study || ""}
                      onValueChange={(value) =>
                        setProfile((prev) => ({ ...prev, year_of_study: value }))
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your year of study" />
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
                      variant="default"
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
          <Card className="shadow-card bg-card dark:bg-card/80">
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
                  className="flex items-center justify-between p-4 border rounded-lg bg-background dark:bg-background/50"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
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
