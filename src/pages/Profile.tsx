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
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, student_number, email, phone, campus, course, year_of_study")
          .eq("id", user?.id)
          .maybeSingle();
        if (error) throw error;
        if (data) setProfile(data);
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Could not load your profile data.");
      }
    };

    if (user?.id) fetchProfile();
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setIsSaving(true);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in to save your profile.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: profile.full_name,
         student_number: profile.student_number,
        email: profile.email,
        phone_number: profile.phone_number,
        campus: profile.campus,
        course: profile.course,
        year_of_study: profile.year_of_study,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Profile save error:", error);
      alert("Failed to save profile. Please try again.");
    } else {
      alert("Profile saved successfully!");
    }
  } catch (err) {
    console.error(err);
  } finally {
    setIsSaving(false);
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

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        try {
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

          if (!response.ok) throw new Error(result.error);

          toast.success(`${selectedDocType} uploaded successfully!`);
          const updates = {
            [`${selectedDocType.toLowerCase().replace(" ", "_")}_url`]: result.url,
            [`${selectedDocType.toLowerCase().replace(" ", "_")}_status`]: "uploaded",
          };
          const { error: updateError } = await supabase.from("profiles").update(updates).eq("id", user.id);
          if (updateError) throw updateError;

        } catch (err: any) {
          toast.error(`Upload failed: ${err.message}`);
        } finally {
          setUploadingDoc(null);
          setSelectedDocType(null);
        }
      };
    } catch (err: any) {
      toast.error(`An unexpected error occurred: ${err.message}`);
      setUploadingDoc(null);
      setSelectedDocType(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setProfile((prev) => ({ ...prev, [name]: value }));
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
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSaving(true);
              try {
                const { error } = await supabase
                  .from("profiles")
                  .update({
                    full_name: profile.full_name,
                    student_number: profile.student_number,
                    phone_number: profile.phone_number,
                    campus: profile.campus,
                    course: profile.course,
                    year_of_study: profile.year_of_study,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", user.id);

                if (error) throw error;

                toast.success("Profile updated successfully!");
                setIsEditing(false);
              } catch (err: any) {
                console.error(err);
                toast.error("Failed to update profile. Please try again.");
              } finally {
                setIsSaving(false);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  Full Name
                </label>
                <Input
                  value={profile.full_name || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      full_name: e.target.value,
                    }))
                  }
                  placeholder="Enter your full name"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  Student Number
                </label>
                <Input
                  value={profile.student_number || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      student_number: e.target.value,
                    }))
                  }
                  placeholder="Enter your student number"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  Email Address
                </label>
                <Input value={user?.email || ""} disabled />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  Phone Number
                </label>
                <Input
                  value={profile.phone_number || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      phone_number: e.target.value,
                    }))
                  }
                  placeholder="Enter your phone number"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  Campus
                </label>
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
                    <SelectItem value="Pretoria West (Main)">
                      Pretoria West (Main Campus)
                    </SelectItem>
                    <SelectItem value="Arcadia Campus">
                      Arcadia Campus
                    </SelectItem>
                    <SelectItem value="Ga-Rankuwa Campus">
                      Ga-Rankuwa Campus
                    </SelectItem>
                    <SelectItem value="Mbombela Campus">
                      Mbombela Campus
                    </SelectItem>
                    <SelectItem value="Polokwane Campus">
                      Polokwane Campus
                    </SelectItem>
                    <SelectItem value="Soshanguve North Campus">
                      Soshanguve North Campus
                    </SelectItem>
                    <SelectItem value="Soshanguve South Campus">
                      Soshanguve South Campus
                    </SelectItem>
                    <SelectItem value="eMalahleni Campus">
                      eMalahleni Campus
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  Course
                </label>
                <Input
                  value={profile.course || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      course: e.target.value,
                    }))
                  }
                  placeholder="Enter your course"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block text-muted-foreground">
                  Year of Study
                </label>
                <Select
                  value={profile.year_of_study || ""}
                  onValueChange={(value) =>
                    setProfile((prev) => ({
                      ...prev,
                      year_of_study: value,
                    }))
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
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Save Changes
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  </div>

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
        </DashboardLayout>
      );
    };

export default Profile;
