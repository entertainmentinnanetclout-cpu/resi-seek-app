import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, Loader2, AlertTriangle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>({});
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>("personal_info");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("*").eq("id", user?.id).maybeSingle();
        if (error) throw error;
        if (data) {
          setProfile(data);
          const draft = localStorage.getItem(`profileDraft_${user.id}`);
          if (draft) {
            setFormData(JSON.parse(draft));
            toast.info("Draft restored.");
          } else {
            setFormData(data);
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Could not load your profile data.");
      }
    };

    if (user?.id) fetchProfile();
  }, [user?.id]);

  useEffect(() => {
    if (isEditing && user?.id) {
      localStorage.setItem(`profileDraft_${user.id}`, JSON.stringify(formData));
    }
  }, [formData, isEditing, user?.id]);

  const validateField = (name: string, value: string) => {
    let error = "";
    if (!value) {
      error = "This field is required.";
    } else if (name === "phone" && !/^(\+27|0)[6-8][0-9]{8}$/.test(value)) {
      error = "Invalid South African phone number.";
    }
    setErrors((prev: any) => ({ ...prev, [name]: error }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [id]: value }));
    validateField(id, value);
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const { id, created_at, email, ...updateData } = formData;
    try {
      const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);
      if (error) throw error;
      setProfile(formData);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      localStorage.removeItem(`profileDraft_${user.id}`);
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
    setUploadingDoc(selectedDocType);

    try {
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
  
  const AccordionItem = ({ title, description, id, children }: any) => (
    <Card className="shadow-sm md:shadow-none">
        <div className="md:hidden p-4 border-b" onClick={() => setOpenAccordion(openAccordion === id ? null : id)}>
            <div className="flex justify-between items-center cursor-pointer">
                <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${openAccordion === id ? 'rotate-180' : ''}`} />
            </div>
        </div>
        <div className={`md:block ${openAccordion === id ? 'block' : 'hidden'}`}>
            <CardHeader className="hidden md:block">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-0">
                {children}
            </CardContent>
        </div>
    </Card>
  )

  return (
    <DashboardLayout>
      <TooltipProvider>
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

            <form onSubmit={handleSave} className="space-y-4 md:space-y-0 md:bg-card md:rounded-lg md:shadow-sm">
              <AccordionItem title="Personal Information" description="Keep your student details up-to-date." id="personal_info">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Tooltip><TooltipTrigger asChild><Label htmlFor="full_name">Full Name</Label></TooltipTrigger><TooltipContent><p>As it appears on your ID.</p></TooltipContent></Tooltip>
                        <Input id="full_name" value={formData.full_name || ""} onChange={handleChange} placeholder="Enter your full name" disabled={!isEditing} />
                        {errors.full_name && <p className="text-sm text-red-500">{errors.full_name}</p>}
                      </div>
                      <div className="space-y-2">
                        <Tooltip><TooltipTrigger asChild><Label htmlFor="student_number">Student Number</Label></TooltipTrigger><TooltipContent><p>Your official university student number.</p></TooltipContent></Tooltip>
                        <Input id="student_number" value={formData.student_number || ""} onChange={handleChange} placeholder="Enter your student number" disabled={!isEditing} />
                        {errors.student_number && <p className="text-sm text-red-500">{errors.student_number}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" value={user?.email || ""} disabled /></div>
                      <div className="space-y-2">
                        <Tooltip><TooltipTrigger asChild><Label htmlFor="phone">Phone Number</Label></TooltipTrigger><TooltipContent><p>A valid SA number (e.g., 0821234567).</p></TooltipContent></Tooltip>
                        <Input id="phone" value={formData.phone || ""} onChange={handleChange} placeholder="Enter your phone number" disabled={!isEditing} />
                        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="campus">Campus</Label>
                        <Select value={formData.campus || ""} onValueChange={(v) => handleSelectChange("campus", v)} disabled={!isEditing}>
                          <SelectTrigger id="campus"><SelectValue placeholder="Select campus" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pretoria West">Pretoria West</SelectItem>
                            <SelectItem value="Soshanguve">Soshanguve</SelectItem>
                            <SelectItem value="Ga-Rankuwa">Ga-Rankuwa</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.campus && <p className="text-sm text-red-500">{errors.campus}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="course">Course</Label><Input id="course" value={formData.course || ""} onChange={handleChange} placeholder="e.g. BEng Tech" disabled={!isEditing} />
                        {errors.course && <p className="text-sm text-red-500">{errors.course}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="year_of_study">Year of Study</Label>
                        <Select value={formData.year_of_study || ""} onValueChange={(v) => handleSelectChange("year_of_study", v)} disabled={!isEditing}>
                          <SelectTrigger id="year_of_study"><SelectValue placeholder="Select year" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1st Year</SelectItem>
                            <SelectItem value="2">2nd Year</SelectItem>
                            <SelectItem value="3">3rd Year</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.year_of_study && <p className="text-sm text-red-500">{errors.year_of_study}</p>}
                      </div>
                    </div>
                    {isEditing && (
                      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => {setIsEditing(false); setFormData(profile); setErrors({});}} className="w-full sm:w-auto flex-1">Cancel</Button>
                        <Button type="submit" className="w-full sm:w-auto flex-1" disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionItem>

                <AccordionItem title="Supporting Documents" description="Upload copies of your required documents." id="supporting_docs">
                    <div className="space-y-3">
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
                    </div>
                </AccordionItem>
            </form>
          </div>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default Profile;
