import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
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
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile"; // ✅ kept correct import
import logo from "@/assets/Main header Desktop.png";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ✅ Only call the hook when user exists
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  return (
    <>
        <SEO
            title="Setup Your Profile | ResKonnect"
            description="Complete your profile to start applying for student accommodations."
        />
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={logo} alt="ResKonnect" className="h-8 w-auto" />
          </div>
        </div>
      </nav>

      {/* ... rest of your component stays exactly the same */}
    </div>
    </>
  );
};

export default ProfileSetup;
