import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Image as ImageIcon } from "lucide-react";
import ImageInput from "@/components/ImageInput";

const PLACEMENTS = [
  { value: "hero", label: "Hero (top of marketplace)" },
  { value: "category", label: "Category strip" },
  { value: "campaign", label: "Campaign overlay" },
];

const empty = {
  id: undefined as string | undefined,
  title: "",
  subtitle: "",
  image_url: "",
  cta_text: "",
  cta_link: "",
  placement: "hero",
  category_slug: "",
  display_order: 0,
  is_active: true,
};

export const AdminMarketplaceBannersContent = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: b }, { data: c }] = await Promise.all([
      supabase.from("marketplace_banners" as any).select("*").order("display_order"),
      supabase.from("product_categories").select("id, name, slug").order("display_order"),
    ]);
    setBanners((b as any[]) || []);
    setCategories(c || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setForm({ ...empty }); setOpen(true); };
  const openEdit = (banner: any) => { setForm({ ...banner }); setOpen(true); };

  const save = async () => {
    if (!form.title || !form.image_url) {
      toast.error("Title and image are required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title,
        subtitle: form.subtitle || null,
        image_url: form.image_url,
        cta_text: form.cta_text || null,
        cta_link: form.cta_link || null,
        placement: form.placement,
        category_slug: form.placement === "category" ? form.category_slug || null : null,
        display_order: Number(form.display_order) || 0,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      if (form.id) {
        const { error } = await supabase.from("marketplace_banners" as any).update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Banner updated");
      } else {
        const { error } = await supabase.from("marketplace_banners" as any).insert(payload);
        if (error) throw error;
        toast.success("Banner created");
      }
      setOpen(false);
      fetchAll();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      toast.error(`Failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: any) => {
    await supabase.from("marketplace_banners" as any).update({ is_active: !b.is_active }).eq("id", b.id);
    fetchAll();
  };

  const remove = async (b: any) => {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    await supabase.from("marketplace_banners" as any).delete().eq("id", b.id);
    toast.success("Deleted");
    fetchAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Marketplace Banners</h2>
          <p className="text-muted-foreground text-sm">Hero carousel + per-category banners shown on the marketplace.</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />New Banner</Button>
      </div>

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Loading…</p>
      ) : banners.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No banners yet. Create your first hero banner above.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              <div
                className="aspect-[16/6] bg-cover bg-center bg-muted"
                style={{ backgroundImage: `url(${b.image_url})` }}
              />
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{b.title}</h3>
                    {b.subtitle && <p className="text-xs text-muted-foreground line-clamp-2">{b.subtitle}</p>}
                  </div>
                  <Switch checked={!!b.is_active} onCheckedChange={() => toggleActive(b)} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="capitalize">{b.placement}</Badge>
                  {b.category_slug && <Badge variant="secondary">{b.category_slug}</Badge>}
                  <Badge variant="outline">order: {b.display_order ?? 0}</Badge>
                </div>
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(b)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit Banner" : "New Banner"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Back to School Sale" />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Textarea value={form.subtitle || ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} rows={2} placeholder="Up to 30% off student essentials" />
            </div>
            <div>
              <Label>Image (1920x720 recommended, 16:6)</Label>
              <ImageInput
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url })}
                bucket="campaign-assets"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CTA Text</Label>
                <Input value={form.cta_text || ""} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Shop now" />
              </div>
              <div>
                <Label>CTA Link</Label>
                <Input value={form.cta_link || ""} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} placeholder="/marketplace?tab=deals" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Placement</Label>
                <Select value={form.placement} onValueChange={(v) => setForm({ ...form, placement: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Display Order</Label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
              </div>
            </div>
            {form.placement === "category" && (
              <div>
                <Label>Category</Label>
                <Select value={form.category_slug || ""} onValueChange={(v) => setForm({ ...form, category_slug: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMarketplaceBannersContent;