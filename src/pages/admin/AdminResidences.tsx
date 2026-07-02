import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Search, Upload, Grid3X3, X, Images, Star, LayoutList, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TrustedResidencesEditor from "@/components/admin/TrustedResidencesEditor";
import SectionsManager from "@/components/admin/SectionsManager";
import { useResidenceSections } from "@/hooks/useResidenceSections";

interface Residence {
  id: string;
  name: string;
  address: string;
  price: number;
  capacity: number;
  available_spots: number;
  campus: string | null;
  province: string | null;
  room_type: string | null;
  room_types: string[] | null;
  quality_grade: string | null;
  verification_level: string | null;
  featured: boolean | null;
  image_url: string | null;
  images: string[] | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  amenities: string[] | null;
  virtual_tour_url: string | null;
  virtual_tour_provider: string | null;
  accepts_university?: boolean | null;
  accepts_tvet?: boolean | null;
  accepts_private?: boolean | null;
  accepts_nsfas?: boolean | null;
  institution_tags?: string[] | null;
  is_spotlight?: boolean | null;
  spotlight_rank?: number | null;
}

const ROOM_TYPE_OPTIONS = ["Single", "Sharing", "Bachelor", "Commune"];
const QUALITY_GRADES = [
  { value: "basic", label: "Basic (Budget)", color: "bg-muted" },
  { value: "standard", label: "Standard", color: "bg-blue-500" },
  { value: "premium", label: "Premium", color: "bg-amber-500" },
  { value: "luxury", label: "Luxury", color: "bg-purple-500" },
];

const emptyResidence: Partial<Residence> = {
  name: "",
  address: "",
  price: 0,
  capacity: 1,
  available_spots: 0,
  campus: "",
  province: "Gauteng",
  room_type: "single",
  room_types: [],
  quality_grade: "standard",
  verification_level: "basic",
  featured: false,
  description: "",
  contact_email: "",
  contact_phone: "",
  amenities: [],
  images: [],
  virtual_tour_url: "",
  virtual_tour_provider: "",
  accepts_university: true,
  accepts_tvet: false,
  accepts_private: false,
  accepts_nsfas: false,
  institution_tags: [],
  is_spotlight: false,
};

export const AdminResidencesContent = () => {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<"all" | "university" | "tvet" | "private" | "spotlight">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResidence, setEditingResidence] = useState<Partial<Residence> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const { sections: dbSections } = useResidenceSections();

  const fetchResidences = async () => {
    try {
      const { data, error } = await supabase
        .from("residences")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResidences(data || []);
    } catch (error) {
      console.error("Error fetching residences:", error);
      toast.error("Failed to load residences");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidences();
  }, []);

  const handleSave = async () => {
    if (!editingResidence?.name || !editingResidence?.address) {
      toast.error("Name and address are required");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = editingResidence.image_url;
      let imagesArray = editingResidence.images || [];

      // Upload main image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `residence-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("admin-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from("admin-images")
          .getPublicUrl(fileName);
        
        imageUrl = urlData.publicUrl;
      }

      // Upload additional images if provided
      if (additionalImages.length > 0) {
        const uploadPromises = additionalImages.map(async (file) => {
          const fileExt = file.name.split(".").pop();
          const fileName = `residence-gallery-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("admin-images")
            .upload(fileName, file);

          if (uploadError) throw uploadError;
          
          const { data: urlData } = supabase.storage
            .from("admin-images")
            .getPublicUrl(fileName);
          
          return urlData.publicUrl;
        });

        const newUrls = await Promise.all(uploadPromises);
        imagesArray = [...imagesArray, ...newUrls];
      }

      const residenceData = {
        name: editingResidence.name!,
        address: editingResidence.address!,
        image_url: imageUrl,
        images: imagesArray,
        price: Number(editingResidence.price) || 0,
        capacity: Number(editingResidence.capacity) || 1,
        available_spots: Number(editingResidence.available_spots) || 0,
        campus: editingResidence.campus || null,
        province: editingResidence.province || null,
        room_type: editingResidence.room_type || null,
        room_types: editingResidence.room_types || [],
        quality_grade: editingResidence.quality_grade || 'standard',
        verification_level: editingResidence.verification_level || null,
        featured: editingResidence.featured || false,
        description: editingResidence.description || null,
        contact_email: editingResidence.contact_email || null,
        contact_phone: editingResidence.contact_phone || null,
        virtual_tour_url: editingResidence.virtual_tour_url || null,
        virtual_tour_provider: editingResidence.virtual_tour_provider || null,
        section_category: (editingResidence as any).section_category || null,
        accepts_university: editingResidence.accepts_university ?? true,
        accepts_tvet: editingResidence.accepts_tvet ?? false,
        accepts_private: editingResidence.accepts_private ?? false,
        accepts_nsfas: editingResidence.accepts_nsfas ?? false,
        institution_tags: editingResidence.institution_tags ?? [],
        is_spotlight: editingResidence.is_spotlight ?? false,
      };

      if (editingResidence.id) {
        // Update existing
        const { error } = await supabase
          .from("residences")
          .update(residenceData)
          .eq("id", editingResidence.id);

        if (error) throw error;
        toast.success("Residence updated successfully");
      } else {
        // Create new
        const { error } = await supabase
          .from("residences")
          .insert([residenceData]);

        if (error) throw error;
        toast.success("Residence created successfully");
      }

      setIsDialogOpen(false);
      setEditingResidence(null);
      setImageFile(null);
      setAdditionalImages([]);
      fetchResidences();
    } catch (error: any) {
      console.error("Error saving residence:", error);
      toast.error(error.message || "Failed to save residence");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this residence?")) return;

    try {
      const { error } = await supabase
        .from("residences")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Residence deleted");
      fetchResidences();
    } catch (error) {
      console.error("Error deleting residence:", error);
      toast.error("Failed to delete residence");
    }
  };

  const filteredResidences = residences.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (r.name ?? '').toLowerCase().includes(q) ||
      (r.address ?? '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (audienceFilter === "university") return r.accepts_university !== false;
    if (audienceFilter === "tvet") return r.accepts_tvet === true;
    if (audienceFilter === "private") return r.accepts_private === true;
    if (audienceFilter === "spotlight") return r.is_spotlight === true;
    return true;
  });

  const toggleSpotlight = async (r: Residence) => {
    const next = !r.is_spotlight;
    setResidences((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_spotlight: next } : x)));
    const { error } = await supabase.from("residences").update({ is_spotlight: next }).eq("id", r.id);
    if (error) {
      toast.error(error.message || "Failed to update spotlight");
      fetchResidences();
    } else {
      toast.success(next ? "Added to spotlight" : "Removed from spotlight");
    }
  };

  const toggleAudience = async (r: Residence, field: "accepts_tvet" | "accepts_private" | "accepts_university") => {
    const next = !r[field];
    setResidences((prev) => prev.map((x) => (x.id === r.id ? { ...x, [field]: next } : x)));
    const { error } = await supabase.from("residences").update({ [field]: next }).eq("id", r.id);
    if (error) {
      toast.error(error.message || "Failed to update audience");
      fetchResidences();
    }
  };

  return (
    <>
      <SEO title="Manage Residences | Admin" description="Manage residence listings" />
      
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Residences</h1>
          <p className="text-muted-foreground">Manage all residence listings</p>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">All Residences</TabsTrigger>
            <TabsTrigger value="trusted" className="gap-2">
              <Grid3X3 className="w-4 h-4" />
              Trusted Grid
            </TabsTrigger>
            <TabsTrigger value="sections" className="gap-2">
              <LayoutList className="w-4 h-4" />
              Sections
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingResidence(emptyResidence)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Residence
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingResidence?.id ? "Edit Residence" : "Add New Residence"}</DialogTitle>
                <DialogDescription>Fill in the residence details below.</DialogDescription>
              </DialogHeader>
              
              {editingResidence && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={editingResidence.name || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, name: e.target.value })}
                        placeholder="Residence name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price (R/month) *</Label>
                      <Input
                        type="number"
                        value={editingResidence.price || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, price: Number(e.target.value) })}
                        placeholder="3500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Address *</Label>
                    <Input
                      value={editingResidence.address || ""}
                      onChange={(e) => setEditingResidence({ ...editingResidence, address: e.target.value })}
                      placeholder="Full address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Campus</Label>
                      <Input
                        value={editingResidence.campus || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, campus: e.target.value })}
                        placeholder="TUT Pretoria"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Province</Label>
                      <Select
                        value={editingResidence.province || "Gauteng"}
                        onValueChange={(value) => setEditingResidence({ ...editingResidence, province: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Gauteng">Gauteng</SelectItem>
                          <SelectItem value="Western Cape">Western Cape</SelectItem>
                          <SelectItem value="KwaZulu-Natal">KwaZulu-Natal</SelectItem>
                          <SelectItem value="Eastern Cape">Eastern Cape</SelectItem>
                          <SelectItem value="Free State">Free State</SelectItem>
                          <SelectItem value="Limpopo">Limpopo</SelectItem>
                          <SelectItem value="Mpumalanga">Mpumalanga</SelectItem>
                          <SelectItem value="North West">North West</SelectItem>
                          <SelectItem value="Northern Cape">Northern Cape</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Capacity</Label>
                      <Input
                        type="number"
                        value={editingResidence.capacity || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, capacity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Available Spots</Label>
                      <Input
                        type="number"
                        value={editingResidence.available_spots || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, available_spots: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Multi-select Room Types - GOD MODE */}
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                    <Label className="text-base font-semibold">Room Types Available</Label>
                    <p className="text-xs text-muted-foreground">Select all room types this residence offers</p>
                    <div className="grid grid-cols-2 gap-3">
                      {ROOM_TYPE_OPTIONS.map((type) => {
                        const isSelected = editingResidence.room_types?.includes(type.toLowerCase()) || false;
                        return (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`room-${type}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const current = editingResidence.room_types || [];
                                const typeValue = type.toLowerCase();
                                const newTypes = checked 
                                  ? [...current, typeValue]
                                  : current.filter(t => t !== typeValue);
                                setEditingResidence({ ...editingResidence, room_types: newTypes });
                              }}
                            />
                            <label htmlFor={`room-${type}`} className="text-sm font-medium cursor-pointer">
                              {type}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    {editingResidence.room_types && editingResidence.room_types.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {editingResidence.room_types.map(t => (
                          <Badge key={t} variant="secondary" className="capitalize">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quality Grade - GOD MODE */}
                  <div className="space-y-2">
                    <Label>Quality Grade</Label>
                    <Select
                      value={editingResidence.quality_grade || "standard"}
                      onValueChange={(value) => setEditingResidence({ ...editingResidence, quality_grade: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALITY_GRADES.map((grade) => (
                          <SelectItem key={grade.value} value={grade.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${grade.color}`} />
                              {grade.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Section Category */}
                  <div className="space-y-2">
                    <Label>Section Category</Label>
                    <Select
                      value={(editingResidence as any).section_category || "none"}
                      onValueChange={(value) => setEditingResidence({ ...editingResidence, section_category: value === "none" ? null : value } as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No section</SelectItem>
                        {dbSections.map((s) => (
                          <SelectItem key={s.id} value={s.slug}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${s.color}`} />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Audience & Accreditation */}
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-sm font-semibold">Audience & Accreditation</Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Which students can this residence accept?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "accepts_university", label: "University students" },
                        { key: "accepts_tvet", label: "TVET / College students" },
                        { key: "accepts_private", label: "Private renters" },
                        { key: "accepts_nsfas", label: "NSFAS approved" },
                      ].map((f) => (
                        <label
                          key={f.key}
                          className="flex items-center justify-between gap-2 rounded-lg border p-3 cursor-pointer"
                        >
                          <span className="text-sm">{f.label}</span>
                          <Switch
                            checked={!!(editingResidence as any)[f.key]}
                            onCheckedChange={(v) =>
                              setEditingResidence({ ...editingResidence, [f.key]: v } as any)
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Institution tags (comma-separated)</Label>
                      <Input
                        placeholder="e.g. TUT, UNISA, Tshwane North College"
                        value={(editingResidence.institution_tags || []).join(", ")}
                        onChange={(e) =>
                          setEditingResidence({
                            ...editingResidence,
                            institution_tags: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Verification Level</Label>
                      <Select
                        value={editingResidence.verification_level || "basic"}
                        onValueChange={(value) => setEditingResidence({ ...editingResidence, verification_level: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="trusted_partner">Trusted Partner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Featured</Label>
                      <Select
                        value={editingResidence.featured ? "yes" : "no"}
                        onValueChange={(value) => setEditingResidence({ ...editingResidence, featured: value === "yes" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editingResidence.description || ""}
                      onChange={(e) => setEditingResidence({ ...editingResidence, description: e.target.value })}
                      placeholder="Describe the residence..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input
                        type="email"
                        value={editingResidence.contact_email || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, contact_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Phone</Label>
                      <Input
                        value={editingResidence.contact_phone || ""}
                        onChange={(e) => setEditingResidence({ ...editingResidence, contact_phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Main Image (Cover Photo)</Label>
                    <div className="flex items-center gap-4">
                      {editingResidence.image_url && (
                        <img src={editingResidence.image_url} alt="Preview" className="w-20 h-20 object-cover rounded" />
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>

                  {/* Gallery Images Section */}
                  <div className="space-y-3 border-t pt-4">
                    <Label className="flex items-center gap-2">
                      <Images className="w-4 h-4" />
                      Gallery Images (Slideshow)
                    </Label>
                    
                    {/* Existing gallery images */}
                    {editingResidence.images && editingResidence.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {editingResidence.images.map((imgUrl, idx) => (
                          <div key={idx} className="relative group">
                            <img 
                              src={imgUrl} 
                              alt={`Gallery ${idx + 1}`} 
                              className="w-16 h-16 object-cover rounded border"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newImages = [...(editingResidence.images || [])];
                                newImages.splice(idx, 1);
                                setEditingResidence({ ...editingResidence, images: newImages });
                              }}
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add new gallery images */}
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setAdditionalImages(prev => [...prev, ...files]);
                        }}
                      />
                      {additionalImages.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {additionalImages.map((file, idx) => (
                            <div key={idx} className="relative group">
                              <img 
                                src={URL.createObjectURL(file)} 
                                alt={`New ${idx + 1}`} 
                                className="w-16 h-16 object-cover rounded border border-primary"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setAdditionalImages(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Add multiple interior/exterior photos. These will appear in a slideshow on the trusted residences grid.
                      </p>
                    </div>
                  </div>

                  {/* Virtual Tour Section */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold mb-3">3D Virtual Tour</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tour Provider</Label>
                        <Select
                          value={editingResidence.virtual_tour_provider || ""}
                          onValueChange={(value) => setEditingResidence({ ...editingResidence, virtual_tour_provider: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="matterport">Matterport</SelectItem>
                            <SelectItem value="kuula">Kuula</SelectItem>
                            <SelectItem value="youtube360">YouTube 360</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Virtual Tour URL</Label>
                        <Input
                          value={editingResidence.virtual_tour_url || ""}
                          onChange={(e) => setEditingResidence({ ...editingResidence, virtual_tour_url: e.target.value })}
                          placeholder="https://my.matterport.com/show/?m=..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Paste the embed URL from Matterport, Kuula, YouTube 360, or any iframe-compatible tour
                        </p>
                      </div>
                    </div>
                    {editingResidence.virtual_tour_url && (
                      <div className="mt-4">
                        <Label className="mb-2 block">Preview</Label>
                        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                          <iframe
                            src={editingResidence.virtual_tour_url}
                            className="w-full h-full border-0"
                            allowFullScreen
                            title="Virtual Tour Preview"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Residence"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search residences..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredResidences.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No residences found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResidences.map((residence) => (
                      <TableRow key={residence.id}>
                        <TableCell className="font-medium">{residence.name}</TableCell>
                        <TableCell>{residence.campus || "-"}</TableCell>
                        <TableCell>R{residence.price.toLocaleString()}</TableCell>
                        <TableCell>{residence.available_spots}/{residence.capacity}</TableCell>
                        <TableCell>
                          <Badge variant={residence.verification_level === "verified" || residence.verification_level === "premium" ? "default" : "secondary"}>
                            {residence.verification_level || "basic"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingResidence(residence);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(residence.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="trusted">
            <TrustedResidencesEditor />
          </TabsContent>

          <TabsContent value="sections">
            <SectionsManager />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

const AdminResidences = () => (
  <AdminLayout><AdminResidencesContent /></AdminLayout>
);

export default AdminResidences;
