import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitRecruiterApplication } from "@/lib/referrals/referralApi";

export default function RecruiterApply() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [myApp, setMyApp] = useState<any>(null);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", whatsapp_number: "",
    institution: "", campus: "", city: "", province: "",
    recruitment_area: "", experience: "", motivation: "",
    social_media_link: ""
  });

  useEffect(() => {
    if (!user) {
      navigate("/recruit/auth?returnTo=/recruit/apply");
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("recruiter_applications" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("program_key", "student_recruitment")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setMyApp(data);
      if (data?.status === "approved") {
        await refreshProfile();
        navigate("/recruit/dashboard");
      }

      setForm((f) => ({
        ...f,
        full_name: (user.user_metadata as any)?.full_name || f.full_name,
        email: user.email || f.email,
        phone: (user.user_metadata as any)?.phone || f.phone
      }));
      setLoading(false);
    })();
  }, [user, navigate, refreshProfile]);

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.recruitment_area.trim() || !form.motivation.trim() || !(form.phone || form.whatsapp_number)) {
      toast.error("Please fill in required fields (Name, Area, Contact, and Motivation)");
      return;
    }
    setApplying(true);
    const { data, error } = await submitRecruiterApplication({ ...form, program_key: 'student_recruitment' });
    setApplying(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted successfully!");
    const { data: refreshed } = await supabase.from("recruiter_applications" as any).select("*").eq("id", data as any).maybeSingle();
    setMyApp(refreshed);
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <DashboardLayout>
      <SEO title="Apply as Recruiter | ResKonnect" description="Join the ResKonnect recruitment programme." />
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Recruiter Application</h1>
          <p className="text-muted-foreground">Tell us about yourself and why you'd like to join our programme.</p>
        </div>

        {myApp && myApp.status === "pending" ? (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Application Pending <Badge>In Review</Badge></CardTitle>
              <CardDescription>
                We've received your application. Our team is reviewing it and will notify you via email once a decision is made.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-sm">Submitted on: {new Date(myApp.created_at).toLocaleDateString()}</p>
               <Button variant="outline" className="mt-4" onClick={() => navigate("/recruit")}>Back to Info</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input readOnly disabled value={form.email} className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp Number</Label>
                  <Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Province</Label>
                  <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Institution</Label>
                  <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Campus/Area</Label>
                  <Input value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value })} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Recruitment Area * (Where will you be recruiting students?)</Label>
                  <Input placeholder="e.g. Soshanguve, Pretoria CBD, Online" value={form.recruitment_area} onChange={(e) => setForm({ ...form, recruitment_area: e.target.value })} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Experience (Optional)</Label>
                  <Textarea placeholder="Any previous experience in marketing or recruitment?" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Motivation * (Why should we choose you?)</Label>
                  <Textarea rows={4} placeholder="Tell us how you plan to recruit students..." value={form.motivation} onChange={(e) => setForm({ ...form, motivation: e.target.value })} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Social Media Link (Optional)</Label>
                  <Input placeholder="Instagram/TikTok/Facebook profile" value={form.social_media_link} onChange={(e) => setForm({ ...form, social_media_link: e.target.value })} />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => navigate("/recruit")}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={applying}>
                  {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Application
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
