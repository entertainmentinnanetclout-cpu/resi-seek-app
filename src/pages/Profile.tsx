import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("*").eq("id", user?.id).maybeSingle();
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
    const { id, created_at, email, ...updateData } = profile;
    try {
      const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);
      if (error) throw error;
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save changes. Please try again.');
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
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File must be under 10MB');
      return;
    }

    setUploadingDoc(selectedDocType);

    try {
        // This part would ideally use a serverless function to avoid exposing service keys
        // For this demo, we are showing the client-side flow
        const filePath = `${user.id}/${selectedDocType.toLowerCase().replace(/ /g, '_')}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

        const updates = {
            [`${selectedDocType.toLowerCase().replace(/ /g, "_")}_url`]: publicUrl,
            [`${selectedDocType.toLowerCase().replace(/ /g, "_")}_status`]: "uploaded",
        };

        const { error: dbError } = await supabase.from("profiles").update(updates).eq("id", user.id);
        if (dbError) throw dbError;

        setProfile(prev => ({...prev, ...updates}));
        toast.success(`${selectedDocType} uploaded successfully!`);

    } catch (err: any) {
        toast.error(`Upload failed: ${err.message}`);
    } finally {
        setUploadingDoc(null);
        setSelectedDocType(null);
        if (documentInputRef.current) {
            documentInputRef.current.value = "";
        }
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">My Profile</h1>
              <p className="text-muted-foreground mt-1">Manage your personal information and documents.</p>
            </div>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto flex-shrink-0">Edit Profile</Button>
            )}
          </div>

          <form onSubmit={handleSave}>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Keep your student details up-to-date.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="full_name">Full Name</Label><Input id="full_name" value={profile.full_name || ""} onChange={(e) => setProfile(p => ({...p, full_name: e.target.value}))} placeholder="Enter your full name" disabled={!isEditing} /></div>
                  <div className="space-y-2"><Label htmlFor="student_number">Student Number</Label><Input id="student_number" value={profile.student_number || ""} onChange={(e) => setProfile(p => ({...p, student_number: e.target.value}))} placeholder="Enter your student number" disabled={!isEditing} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" value={user?.email || ""} disabled /></div>
                  <div className="space-y-2"><Label htmlFor="phone">Phone Number</Label><Input id="phone" value={profile.phone || ""} onChange={(e) => setProfile(p => ({...p, phone: e.target.value}))} placeholder="Enter your phone number" disabled={!isEditing} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="campus">Campus</Label>
                    <Select value={profile.campus || ""} onValueChange={(v) => setProfile(p => ({...p, campus: v}))} disabled={!isEditing}>
                      <SelectTrigger id="campus"><SelectValue placeholder="Select campus" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pretoria West">Pretoria West</SelectItem>
                        <SelectItem value="Soshanguve">Soshanguve</SelectItem>
                        <SelectItem value="Ga-Rankuwa">Ga-Rankuwa</SelectItem>
                        <SelectItem value="Arcadia">Arcadia</SelectItem>
                        <SelectItem value="eMalahleni">eMalahleni</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="course">Course</Label><Input id="course" value={profile.course || ""} onChange={(e) => setProfile(p => ({...p, course: e.target.value}))} placeholder="e.g. BEng Tech" disabled={!isEditing} /></div>
                  <div className="space-y-2">
                    <Label htmlFor="year_of_study">Year of Study</Label>
                    <Select value={profile.year_of_study || ""} onValueChange={(v) => setProfile(p => ({...p, year_of_study: v}))} disabled={!isEditing}>
                      <SelectTrigger id="year_of_study"><SelectValue placeholder="Select year" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                        <SelectItem value="Postgraduate">Postgraduate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {isEditing && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="w-full sm:w-auto flex-1">Cancel</Button>
                    <Button type="submit" className="w-full sm:w-auto flex-1" disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Save Changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Supporting Documents</CardTitle>
              <CardDescription>Upload copies of your required documents. Max 10MB each (PDF, PNG, JPG).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input type="file" ref={documentInputRef} onChange={handleDocumentChange} className="hidden" accept="application/pdf, image/png, image/jpeg" />
              {["ID Copy", "Proof of Registration", "Proof of Funding"].map((doc) => {
                const docKey = doc.toLowerCase().replace(/ /g, "_");
                const status = profile[`${docKey}_status`];
                return (
                  <div key={doc} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border rounded-lg bg-background/50">
                    <div className="flex items-center gap-3">
                      {status === 'uploaded' ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />}
                      <div>
                        <p className="font-medium">{doc}</p>
                        <p className="text-sm capitalize text-muted-foreground">{status || 'Not Uploaded'}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto flex-shrink-0"
                      onClick={() => { setSelectedDocType(doc); documentInputRef.current?.click(); }}
                      disabled={uploadingDoc === doc}
                    >
                      {uploadingDoc === doc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      {status === 'uploaded' ? 'Replace' : 'Upload'}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
