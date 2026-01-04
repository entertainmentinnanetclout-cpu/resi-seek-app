import SEO from "@/components/SEO";
import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, Loader2, AlertTriangle, ChevronDown, FileText, X, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

interface UploadedDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

const Profile = () => {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;
  const [isEditing, setIsEditing] = useState(false);
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>({});
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>("personal_info");
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  
  // Use refs to prevent keyboard closing on each keystroke
  const inputRefs = useRef<Record<string, string>>({});

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

  // Handle input change without re-rendering - store in ref
  const handleInputChange = (id: string, value: string) => {
    inputRefs.current[id] = value;
  };

  // Update formData only on blur to prevent keyboard closing
  const handleInputBlur = (id: string, value: string) => {
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
    if (!files || files.length === 0 || !user) {
      console.log('[Document Upload] No files or user:', { files: files?.length, userId: user?.id });
      return;
    }
    
    // Use the currently selected doc type
    const docType = selectedDocType;
    if (!docType) {
      console.log('[Document Upload] No document type selected');
      toast.error("Please select a document type first");
      return;
    }

    const file = files[0];
    console.log('[Document Upload] Starting upload for:', docType, file.name);
    
    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB");
      return;
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, PNG, and JPG files are allowed");
      return;
    }

    // Set uploading state IMMEDIATELY
    setUploadingDoc(docType);
    setUploadProgress(10);
    
    // Show immediate feedback
    toast.loading(`Uploading ${docType}...`, { id: `upload-${docType}` });

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 15;
      });
    }, 200);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${docType.toLowerCase().replace(/ /g, '_')}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      console.log('[Document Upload] Uploading to storage:', filePath);

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('[Document Upload] Storage upload failed:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
      
      console.log('[Document Upload] Storage upload success:', uploadData);
      setUploadProgress(90);

      // Store document record in documents table
      const { error: dbError, data: dbData } = await supabase.from("documents").insert({
        user_id: user.id,
        document_type: docType,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size
      }).select().single();

      if (dbError) {
        console.error('[Document Upload] Database insert failed:', dbError);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }
      
      console.log('[Document Upload] Database insert success:', dbData);

      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Dismiss loading toast and show success
      toast.dismiss(`upload-${docType}`);
      toast.success(`${docType} uploaded successfully!`, {
        description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      });
      
      // Refresh to show updated status
      console.log('[Document Upload] Fetching updated documents...');
      const { data: docs, error: fetchError } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id);
      
      if (fetchError) {
        console.error('[Document Upload] Fetch error:', fetchError);
      }
      
      if (docs) {
        console.log('[Document Upload] Documents fetched:', docs.length);
        setUploadedDocuments(docs as UploadedDocument[]);
      }

    } catch (err: any) {
      clearInterval(progressInterval);
      console.error("[Document Upload] Error:", err);
      toast.dismiss(`upload-${docType}`);
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      // Keep the uploaded state visible for a moment, then reset
      setTimeout(() => {
        setUploadingDoc(null);
        setUploadProgress(0);
        if (documentInputRef.current) {
          documentInputRef.current.value = "";
        }
      }, 1000);
      // Don't reset selectedDocType so user can retry if needed
    }
  };

  const handleDrop = (docType: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedDocType(docType);
      // Create a synthetic event-like object
      const input = documentInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleDocumentChange({ target: input } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  // Fetch uploaded documents on mount
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id);
      
      if (data) {
        setUploadedDocuments(data as UploadedDocument[]);
        setProfile((prev: any) => ({
          ...prev,
          uploadedDocuments: data.map(d => d.document_type)
        }));
      }
    };
    fetchDocuments();
  }, [user?.id]);

  // View document handler
  const handleViewDocument = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60); // 60 seconds validity
      
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast.error(`Could not open document: ${err.message}`);
    }
  };

  // Get uploaded document info by type
  const getUploadedDoc = (docType: string) => {
    return uploadedDocuments.find(d => d.document_type === docType);
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
        <SEO
            title="Manage Your Profile | ResKonnect"
            description="Keep your personal information and documents up-to-date for a seamless application experience."
        />
      <TooltipProvider>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <Breadcrumb className="mb-4">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link to="/">Home</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link to="/dashboard">Dashboard</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink>Profile</BreadcrumbLink>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
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
                        <Input 
                          id="full_name" 
                          defaultValue={formData.full_name || ""} 
                          onBlur={(e) => handleInputBlur("full_name", e.target.value)} 
                          placeholder="Enter your full name" 
                          disabled={!isEditing} 
                        />
                        {errors.full_name && <p className="text-sm text-red-500">{errors.full_name}</p>}
                      </div>
                      <div className="space-y-2">
                        <Tooltip><TooltipTrigger asChild><Label htmlFor="student_number">Student Number</Label></TooltipTrigger><TooltipContent><p>Your official university student number.</p></TooltipContent></Tooltip>
                        <Input 
                          id="student_number" 
                          defaultValue={formData.student_number || ""} 
                          onBlur={(e) => handleInputBlur("student_number", e.target.value)} 
                          placeholder="Enter your student number" 
                          disabled={!isEditing} 
                        />
                        {errors.student_number && <p className="text-sm text-red-500">{errors.student_number}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" value={user?.email || ""} disabled /></div>
                      <div className="space-y-2">
                        <Tooltip><TooltipTrigger asChild><Label htmlFor="phone">Phone Number</Label></TooltipTrigger><TooltipContent><p>A valid SA number (e.g., 0821234567).</p></TooltipContent></Tooltip>
                        <Input 
                          id="phone" 
                          defaultValue={formData.phone || ""} 
                          onBlur={(e) => handleInputBlur("phone", e.target.value)} 
                          placeholder="Enter your phone number" 
                          disabled={!isEditing} 
                        />
                        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="campus">Campus</Label>
                        <Select value={formData.campus || ""} onValueChange={(v) => handleSelectChange("campus", v)} disabled={!isEditing}>
                          <SelectTrigger id="campus"><SelectValue placeholder="Select campus" /></SelectTrigger>
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
                        {errors.campus && <p className="text-sm text-red-500">{errors.campus}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="course">Course</Label>
                        <Input 
                          id="course" 
                          defaultValue={formData.course || ""} 
                          onBlur={(e) => handleInputBlur("course", e.target.value)} 
                          placeholder="e.g. BEng Tech" 
                          disabled={!isEditing} 
                        />
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

                <AccordionItem title="Roommate Preferences" description="Help us find compatible roommates for you." id="roommate_prefs">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Sleep Schedule</Label>
                          <Select 
                            value={formData.lifestyle_preferences?.sleepSchedule || ""} 
                            onValueChange={(v) => setFormData((prev: any) => ({ ...prev, lifestyle_preferences: { ...prev.lifestyle_preferences, sleepSchedule: v } }))}
                            disabled={!isEditing}
                          >
                            <SelectTrigger><SelectValue placeholder="Select preference" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="early_bird">🌅 Early Bird</SelectItem>
                              <SelectItem value="night_owl">🦉 Night Owl</SelectItem>
                              <SelectItem value="flexible">⏰ Flexible</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Study Habits</Label>
                          <Select 
                            value={formData.lifestyle_preferences?.studyHabits || ""} 
                            onValueChange={(v) => setFormData((prev: any) => ({ ...prev, lifestyle_preferences: { ...prev.lifestyle_preferences, studyHabits: v } }))}
                            disabled={!isEditing}
                          >
                            <SelectTrigger><SelectValue placeholder="Select preference" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quiet">🤫 Quiet Study</SelectItem>
                              <SelectItem value="background_music">🎵 Background Music OK</SelectItem>
                              <SelectItem value="flexible">📚 Flexible</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Social Level</Label>
                          <Select 
                            value={formData.lifestyle_preferences?.socialLevel || ""} 
                            onValueChange={(v) => setFormData((prev: any) => ({ ...prev, lifestyle_preferences: { ...prev.lifestyle_preferences, socialLevel: v } }))}
                            disabled={!isEditing}
                          >
                            <SelectTrigger><SelectValue placeholder="Select preference" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="introvert">🏠 Introvert</SelectItem>
                              <SelectItem value="extrovert">🎉 Extrovert</SelectItem>
                              <SelectItem value="ambivert">😊 Ambivert</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Cleanliness</Label>
                          <Select 
                            value={formData.lifestyle_preferences?.cleanliness || ""} 
                            onValueChange={(v) => setFormData((prev: any) => ({ ...prev, lifestyle_preferences: { ...prev.lifestyle_preferences, cleanliness: v } }))}
                            disabled={!isEditing}
                          >
                            <SelectTrigger><SelectValue placeholder="Select preference" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="very_clean">✨ Very Clean</SelectItem>
                              <SelectItem value="moderate">🧹 Moderate</SelectItem>
                              <SelectItem value="relaxed">😌 Relaxed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">💡 These preferences help match you with compatible roommates in the <a href="/roommates" className="text-primary underline">Roommate Finder</a>.</p>
                    </div>
                </AccordionItem>

                <AccordionItem title="Supporting Documents" description="Upload copies of your required documents." id="supporting_docs">
                    <div className="space-y-3">
                      <input type="file" ref={documentInputRef} onChange={handleDocumentChange} className="hidden" accept="application/pdf, image/png, image/jpeg" />
                      {["ID Copy", "Proof of Registration", "Proof of Funding"].map((doc) => {
                        const uploadedDoc = getUploadedDoc(doc);
                        const isUploaded = !!uploadedDoc;
                        const isUploading = uploadingDoc === doc;
                        const isDraggedOver = dragOver === doc;
                        return (
                          <div 
                            key={doc} 
                            className={`relative flex flex-col gap-3 p-4 border-2 border-dashed rounded-lg transition-all ${
                              isDraggedOver ? 'border-primary bg-primary/5' : 
                              isUploaded ? 'border-green-500/50 bg-green-500/5' : 
                              'border-border bg-background/50'
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(doc); }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={(e) => handleDrop(doc, e)}
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                {isUploading ? (
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                  </div>
                                ) : isUploaded ? (
                                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-yellow-500" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{doc}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {isUploading 
                                      ? `Uploading... ${uploadProgress}%` 
                                      : isUploaded 
                                        ? `Uploaded ✓ ${uploadedDoc.file_name} (${(uploadedDoc.file_size / 1024).toFixed(1)} KB)`
                                        : 'Drag & drop or click to upload'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto">
                                {isUploaded && !isUploading && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 sm:flex-initial"
                                    onClick={() => handleViewDocument(uploadedDoc.file_path, uploadedDoc.file_name)}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    View
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant={isUploaded ? "outline" : "default"}
                                  size="sm"
                                  className="flex-1 sm:flex-initial"
                                  onClick={() => { setSelectedDocType(doc); documentInputRef.current?.click(); }}
                                  disabled={isUploading}
                                >
                                  {isUploading ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      {uploadProgress}%
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 mr-2" />
                                      {isUploaded ? 'Replace' : 'Upload'}
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                            
                            {/* Progress bar */}
                            {isUploading && (
                              <Progress value={uploadProgress} className="h-2" />
                            )}
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground mt-2">
                        Accepted formats: PDF, PNG, JPG (max 10MB)
                      </p>
                    </div>
                </AccordionItem>
            </form>
            <Card className="bg-card/50">
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-2">Manage Your Profile Information</h3>
                    <p className="text-muted-foreground text-sm">
                    A complete and up-to-date profile is crucial for a successful application. Landlords are more likely to approve applications from students with fully verified and accurate information. By keeping your profile and documents current, you enhance your credibility and increase your chances of securing your preferred accommodation. ResKonnect is committed to protecting your data while streamlining the verification process.
                    </p>
                </CardContent>
            </Card>
          </div>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default Profile;
