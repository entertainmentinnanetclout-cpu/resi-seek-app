import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, Monitor, Home, Newspaper, X } from "lucide-react";
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

export const AdminSlidesContent = () => {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Partial<HeroSlide> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

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

  // Auto-rotate preview
  useEffect(() => {
    const activeSlides = slides.filter(s => s.is_active);
    if (activeSlides.length <= 1) return;
    
    const interval = setInterval(() => {
      setPreviewIndex(prev => (prev + 1) % activeSlides.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [slides]);

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

  const activeSlides = slides.filter(s => s.is_active);

  return (
    <AdminLayout>
      <SEO title="Hero Slides | Admin" description="Manage homepage hero carousel slides" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Hero Slides</h1>
            <p className="text-sm text-muted-foreground">Manage carousel slides across your site</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingSlide({ ...emptySlide, display_order: slides.length })} size="sm">
                <Plus className="w-4 h-4 mr-2" /> Add Slide
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

                  <div className="space-y-3">
                    <Label>Image *</Label>
                    <div className="space-y-3">
                      {editingSlide.image_url && (
                        <div className="relative group">
                          <img src={editingSlide.image_url} alt="Preview" className="w-full h-32 object-cover rounded" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setEditingSlide({ ...editingSlide, image_url: "" })}
                          >
                            <X className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                        <div className="rounded bg-muted/50 p-2 mt-1 space-y-0.5">
                          <p className="text-xs font-medium text-foreground">📐 Image Guidelines</p>
                          <p className="text-xs text-muted-foreground">• Recommended size: <strong>1200×600px</strong> (2:1 ratio)</p>
                          <p className="text-xs text-muted-foreground">• Min width: 800px, Max: 2MB (JPG/PNG/WebP)</p>
                          <p className="text-xs text-muted-foreground">• Crop focus: center — text overlays at bottom-left</p>
                        </div>
                      </div>
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

        <Tabs defaultValue="manage" className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex">
            <TabsTrigger value="manage" className="gap-2">
              <GripVertical className="w-4 h-4" />
              <span className="hidden sm:inline">Manage</span> Slides
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Monitor className="w-4 h-4" />
              Live Preview
            </TabsTrigger>
          </TabsList>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-4">
            {/* Where slides appear */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Where These Slides Appear</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Home className="w-3 h-3" />
                    Landing Page Hero
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Monitor className="w-3 h-3" />
                    Student Dashboard
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  These slides appear on both the public Landing Page and the Student Dashboard hero carousel. Any changes update in real-time.
                </p>
                <p className="text-xs text-muted-foreground">
                  📰 <strong>Campus News images</strong> are managed separately via{' '}
                  <a href="/admin/news" className="text-primary underline underline-offset-2 hover:text-primary/80">Admin → News</a>.
                </p>
              </CardContent>
            </Card>

            {/* Slides List */}
            <div className="grid gap-3">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading slides...</div>
              ) : slides.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No slides yet. Add your first slide to get started.
                  </CardContent>
                </Card>
              ) : (
                slides.map((slide) => (
                  <Card key={slide.id} className={!slide.is_active ? "opacity-60" : ""}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex items-center text-muted-foreground shrink-0">
                          <GripVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <img 
                          src={slide.image_url} 
                          alt={slide.title} 
                          className="w-20 h-14 sm:w-32 sm:h-20 object-cover rounded shrink-0" 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base truncate">{slide.title}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                                {slide.description}
                              </p>
                            </div>
                            <Badge variant={slide.is_active ? "default" : "secondary"} className="shrink-0 text-xs">
                              #{slide.display_order}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 mt-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => toggleActive(slide.id, slide.is_active)}
                              title={slide.is_active ? "Deactivate" : "Activate"}
                            >
                              {slide.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => {
                                setEditingSlide(slide);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 sm:h-8 sm:w-8 text-destructive" 
                              onClick={() => handleDelete(slide.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Homepage Preview
                </CardTitle>
                <CardDescription>
                  This is how the carousel appears on your homepage. Updates in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeSlides.length === 0 ? (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">No active slides to preview</p>
                  </div>
                ) : (
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                    {activeSlides.map((slide, index) => (
                      <div
                        key={slide.id}
                        className={`absolute inset-0 transition-opacity duration-500 ${
                          index === previewIndex ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <img
                          src={slide.image_url}
                          alt={slide.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
                          <h3 className="text-lg sm:text-2xl font-bold mb-1 sm:mb-2">{slide.title}</h3>
                          {slide.description && (
                            <p className="text-sm sm:text-base text-white/80 mb-3 line-clamp-2">{slide.description}</p>
                          )}
                          {slide.cta_text && (
                            <Button size="sm" variant="secondary">
                              {slide.cta_text}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Dots indicator */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {activeSlides.map((_, index) => (
                        <button
                          key={index}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === previewIndex ? 'bg-white' : 'bg-white/50'
                          }`}
                          onClick={() => setPreviewIndex(index)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Thumbnail strip */}
            {activeSlides.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {activeSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => setPreviewIndex(index)}
                    className={`shrink-0 w-24 sm:w-32 aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
                      index === previewIndex ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={slide.image_url}
                      alt={slide.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

const AdminSlides = () => (
  <AdminLayout><AdminSlidesContent /></AdminLayout>
);

export default AdminSlides;
