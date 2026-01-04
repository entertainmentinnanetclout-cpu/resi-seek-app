import { useState, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";
import { TUT_CAMPUSES } from "@/lib/campuses";

const StoreSetup = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    store_name: "",
    store_description: "",
    contact_whatsapp: "",
    contact_email: "",
    campus: "",
  });

  if (shouldBlock) return null;

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be less than 2MB");
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Banner must be less than 5MB");
      return;
    }

    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const uploadImage = async (file: File, type: "logo" | "banner"): Promise<string | null> => {
    if (!user) return null;

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("store-assets")
      .upload(fileName, file);

    if (error) {
      console.error(`Error uploading ${type}:`, error);
      return null;
    }

    const { data } = supabase.storage.from("store-assets").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.store_name.trim()) {
      toast.error("Please enter a store name");
      return;
    }

    setIsSubmitting(true);

    try {
      let logoUrl = null;
      let bannerUrl = null;

      if (logoFile) {
        logoUrl = await uploadImage(logoFile, "logo");
      }

      if (bannerFile) {
        bannerUrl = await uploadImage(bannerFile, "banner");
      }

      const { error } = await supabase.from("stores").insert({
        user_id: user.id,
        store_name: formData.store_name.trim(),
        store_description: formData.store_description.trim() || null,
        store_logo_url: logoUrl,
        store_banner_url: bannerUrl,
        contact_whatsapp: formData.contact_whatsapp.trim() || null,
        contact_email: formData.contact_email.trim() || null,
        campus: formData.campus || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("You already have a store");
          navigate("/my-store");
          return;
        }
        throw error;
      }

      toast.success("Store created successfully!");
      navigate("/my-store");
    } catch (error: any) {
      console.error("Error creating store:", error);
      toast.error(error.message || "Failed to create store");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <SEO
        title="Create Your Store | Student Marketplace"
        description="Set up your personal store on the student marketplace."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-full bg-primary/10">
              <Store className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">Create Your Store</h1>
            <p className="text-muted-foreground">
              Set up your personal store to start selling on the marketplace
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Store Details</CardTitle>
              <CardDescription>
                This information will be visible to buyers on your store page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Store Name */}
                <div className="space-y-2">
                  <Label htmlFor="store_name">Store Name *</Label>
                  <Input
                    id="store_name"
                    value={formData.store_name}
                    onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                    placeholder="e.g., Tech Student Deals"
                    required
                  />
                </div>

                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Store Logo</Label>
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleLogoSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-20 h-20 rounded-full object-cover border"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Max 2MB, recommended 200x200px</p>
                </div>

                {/* Banner Upload */}
                <div className="space-y-2">
                  <Label>Store Banner</Label>
                  <input
                    type="file"
                    ref={bannerInputRef}
                    onChange={handleBannerSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  {bannerPreview ? (
                    <div
                      className="w-full h-32 rounded-lg bg-cover bg-center border cursor-pointer"
                      style={{ backgroundImage: `url(${bannerPreview})` }}
                      onClick={() => bannerInputRef.current?.click()}
                    />
                  ) : (
                    <div
                      className="w-full h-32 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm text-muted-foreground">Upload Banner</p>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Max 5MB, recommended 1200x300px</p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="store_description">Store Description</Label>
                  <Textarea
                    id="store_description"
                    value={formData.store_description}
                    onChange={(e) => setFormData({ ...formData, store_description: e.target.value })}
                    placeholder="Tell buyers what you sell..."
                    rows={3}
                  />
                </div>

                {/* Campus */}
                <div className="space-y-2">
                  <Label>Campus</Label>
                  <Select
                    value={formData.campus}
                    onValueChange={(value) => setFormData({ ...formData, campus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your campus" />
                    </SelectTrigger>
                    <SelectContent>
                      {TUT_CAMPUSES.map((campus) => (
                        <SelectItem key={campus.value} value={campus.value}>
                          {campus.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <Label htmlFor="contact_whatsapp">WhatsApp Number</Label>
                  <Input
                    id="contact_whatsapp"
                    value={formData.contact_whatsapp}
                    onChange={(e) => setFormData({ ...formData, contact_whatsapp: e.target.value })}
                    placeholder="e.g., 27712345678"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code without + sign
                  </p>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Store...
                    </>
                  ) : (
                    <>
                      <Store className="w-4 h-4 mr-2" />
                      Create My Store
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StoreSetup;
