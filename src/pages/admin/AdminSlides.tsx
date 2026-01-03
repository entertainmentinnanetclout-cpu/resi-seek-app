import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HeroSlide {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_text: string | null;
  cta_link: string | null;
  display_order: number;
  is_active: boolean;
}

const emptySlide: Partial<HeroSlide> = {
  title: "",
  description: "",
  image_url: "",
  cta_text: "",
  cta_link: "",
  display_order: 0,
  is_active: true,
};

const AdminSlides = () => {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Partial<HeroSlide> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSlides = async () => {
    try {
      const { data, error } = await supabase
        .from("hero_slides")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setSlides(data || []);
    } catch (error) {
      console.error("Error fetching slides:", error);
      toast.error("Failed to load slides");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlides();
    
    const channel = supabase
      .channel('admin-slides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hero_slides' }, () => {
        fetchSlides();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSave = async () => {
    if (!editingSlide?.title) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = editingSlide.image_url;

      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `slide-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("admin-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("admin-images")
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      if (!imageUrl) {
        toast.error("Image is required");
        setSaving(false);
        return;
      }

      const slideData = {
        title: editingSlide.title,
        description: editingSlide.description || null,
        image_url: imageUrl,
        cta_text: editingSlide.cta_text || null,
        cta_link: editingSlide.cta_link || null,
        display_order: editingSlide.display_order || 0,
        is_active: editingSlide.is_active ?? true,
      };

      if (editingSlide.id) {
        const { error } = await supabase
          .from("hero_slides")
          .update(slideData)
          .eq("id", editingSlide.id);

        if (error) throw error;
        toast.success("Slide updated");
      } else {
        const { error } = await supabase
          .from("hero_slides")
          .insert([slideData]);

        if (error) throw error;
        toast.success("Slide created");
      }

      setIsDialogOpen(false);
      setEditingSlide(null);
      setImageFile(null);
      fetchSlides();
    } catch (error: any) {
      console.error("Error saving slide:", error);
      toast.error(error.message || "Failed to save slide");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this slide?")) return;

    try {
      const { error } = await supabase.from("hero_slides").delete().eq("id", id);
      if (error) throw error;
      toast.success("Slide deleted");
      fetchSlides();
    } catch (error) {
      toast.error("Failed to delete slide");
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("hero_slides")
        .update({ is_active: !currentState })
        .eq("id", id);

      if (error) throw error;
      fetchSlides();
    } catch (error) {
      toast.error("Failed to update slide");
    }
  };

  return (
    <AdminLayout>
      <SEO title="Hero Slides | Admin" description="Manage homepage hero carousel slides" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Hero Slides</h1>
            <p className="text-muted-foreground">Manage homepage carousel images</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingSlide({ ...emptySlide, display_order: slides.length })}>
                <Plus className="w-4 h-4 mr-2" /> Add Slide
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingSlide?.id ? "Edit Slide" : "Add New Slide"}</DialogTitle>
                <DialogDescription>Configure the hero carousel slide.</DialogDescription>
              </DialogHeader>

              {editingSlide && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={editingSlide.title || ""}
                      onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
                      placeholder="Slide title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editingSlide.description || ""}
                      onChange={(e) => setEditingSlide({ ...editingSlide, description: e.target.value })}
                      placeholder="Slide description"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CTA Button Text</Label>
                      <Input
                        value={editingSlide.cta_text || ""}
                        onChange={(e) => setEditingSlide({ ...editingSlide, cta_text: e.target.value })}
                        placeholder="Get Started"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CTA Link</Label>
                      <Input
                        value={editingSlide.cta_link || ""}
                        onChange={(e) => setEditingSlide({ ...editingSlide, cta_link: e.target.value })}
                        placeholder="/find"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      value={editingSlide.display_order || 0}
                      onChange={(e) => setEditingSlide({ ...editingSlide, display_order: Number(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Image *</Label>
                    <div className="space-y-2">
                      {editingSlide.image_url && (
                        <img src={editingSlide.image_url} alt="Preview" className="w-full h-32 object-cover rounded" />
                      )}
                      <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={editingSlide.is_active ?? true}
                      onCheckedChange={(checked) => setEditingSlide({ ...editingSlide, is_active: checked })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Slide"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : slides.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No slides yet. Add your first slide to get started.
              </CardContent>
            </Card>
          ) : (
            slides.map((slide) => (
              <Card key={slide.id} className={!slide.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="flex items-center text-muted-foreground">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <img src={slide.image_url} alt={slide.title} className="w-32 h-20 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{slide.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{slide.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Order: {slide.display_order}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={slide.is_active} onCheckedChange={() => toggleActive(slide.id, slide.is_active)} />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingSlide(slide);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(slide.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSlides;
