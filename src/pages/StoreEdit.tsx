import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Upload, Image as ImageIcon, Loader2, ArrowLeft, Save } from "lucide-react";
import { TUT_CAMPUSES } from "@/lib/campuses";

const StoreEdit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    store_name: "",
    store_description: "",
    contact_whatsapp: "",
    contact_email: "",
    campus: "",
    accent_color: "#3b82f6",
    return_policy: "",
    delivery_notes: "",
    is_open: true,
  });

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("stores").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) {
      navigate("/store-setup");
      return;
    }
    const s = data as any;
    setStoreId(s.id);
    setLogoPreview(s.store_logo_url);
    setBannerPreview(s.store_banner_url);
    setForm({
      store_name: s.store_name || "",
      store_description: s.store_description || "",
      contact_whatsapp: s.contact_whatsapp || "",
      contact_email: s.contact_email || "",
      campus: s.campus || "",
      accent_color: s.accent_color || "#3b82f6",
      return_policy: s.return_policy || "",
      delivery_notes: s.delivery_notes || "",
      is_open: s.is_open !== false,
    });
    setLoading(false);
  };

  const upload = async (file: File, type: "logo" | "banner"): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${type}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error(`Failed to upload ${type}`);
      return null;
    }
    return supabase.storage.from("store-assets").getPublicUrl(path).data.publicUrl;
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2MB");
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const handleBanner = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Banner must be under 5MB");
    setBannerFile(f);
    setBannerPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!storeId) return;
    if (!form.store_name.trim()) return toast.error("Store name is required");
    setSaving(true);
    try {
      let logoUrl: string | null | undefined;
      let bannerUrl: string | null | undefined;
      if (logoFile) logoUrl = await upload(logoFile, "logo");
      if (bannerFile) bannerUrl = await upload(bannerFile, "banner");

      const updates: any = {
        store_name: form.store_name.trim(),
        store_description: form.store_description.trim() || null,
        contact_whatsapp: form.contact_whatsapp.trim() || null,
        contact_email: form.contact_email.trim() || null,
        campus: form.campus || null,
        accent_color: form.accent_color,
        return_policy: form.return_policy.trim() || null,
        delivery_notes: form.delivery_notes.trim() || null,
        is_open: form.is_open,
        updated_at: new Date().toISOString(),
      };
      if (logoUrl !== undefined) updates.store_logo_url = logoUrl;
      if (bannerUrl !== undefined) updates.store_banner_url = bannerUrl;

      const { error } = await supabase.from("stores").update(updates).eq("id", storeId);
      if (error) throw error;
      toast.success("Store updated");
      navigate("/my-store");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO title="Edit Store | ResKonnect" description="Update your store branding and details" />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/my-store")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to My Store
          </Button>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10"><Store className="w-6 h-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-bold">Edit Your Store</h1>
              <p className="text-sm text-muted-foreground">Update your branding, policies and contact info</p>
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle>Branding</CardTitle><CardDescription>Logo, banner and accent color</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Logo</Label>
                <input type="file" ref={logoInputRef} onChange={handleLogo} accept="image/*" className="hidden" />
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-20 h-20 rounded-full object-cover border" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center"><ImageIcon className="w-6 h-6 text-muted-foreground" /></div>
                  )}
                  <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Replace Logo
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Banner</Label>
                <input type="file" ref={bannerInputRef} onChange={handleBanner} accept="image/*" className="hidden" />
                {bannerPreview ? (
                  <div className="w-full h-32 rounded-lg bg-cover bg-center border cursor-pointer" style={{ backgroundImage: `url(${bannerPreview})` }} onClick={() => bannerInputRef.current?.click()} />
                ) : (
                  <div className="w-full h-32 rounded-lg bg-muted flex items-center justify-center cursor-pointer" onClick={() => bannerInputRef.current?.click()}>
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="w-16 h-10 p-1" />
                  <Input value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="flex-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Store Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Store Name *</Label>
                <Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.store_description} onChange={(e) => setForm({ ...form, store_description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Campus</Label>
                <Select value={form.campus} onValueChange={(v) => setForm({ ...form, campus: v })}>
                  <SelectTrigger><SelectValue placeholder="Select campus" /></SelectTrigger>
                  <SelectContent>
                    {TUT_CAMPUSES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>WhatsApp Number</Label>
                <Input value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} placeholder="27712345678" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Policies & Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Return Policy</Label>
                <Textarea value={form.return_policy} onChange={(e) => setForm({ ...form, return_policy: e.target.value })} rows={2} placeholder="e.g., Returns accepted within 7 days for unused items" />
              </div>
              <div className="space-y-2">
                <Label>Delivery Notes</Label>
                <Textarea value={form.delivery_notes} onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })} rows={2} placeholder="e.g., Free delivery on Soshanguve campus, R30 elsewhere" />
              </div>
              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium">Store Open</p>
                  <p className="text-sm text-muted-foreground">Toggle off to temporarily pause new orders</p>
                </div>
                <Switch checked={form.is_open} onCheckedChange={(v) => setForm({ ...form, is_open: v })} />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/my-store")} className="flex-1">Cancel</Button>
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StoreEdit;