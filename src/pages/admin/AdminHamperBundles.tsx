import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gift, Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ImageInput from "@/components/ImageInput";

interface Hamper {
  id: string;
  name: string;
  description: string | null;
  short_description?: string | null;
  price: number;
  category: string | null;
  stock_quantity: number;
  image_url: string | null;
  is_active: boolean;
  is_landing_featured?: boolean;
  hamper_bundle_items?: { id: string; item_name: string; quantity: number }[];
}

interface HamperItem {
  id: string;
  name: string;
  category: string;
}

const emptyForm = {
  name: "",
  description: "",
  short_description: "",
  price: "",
  category: "general",
  stock_quantity: "10",
  image_url: "",
  is_active: true,
  is_landing_featured: false,
};

export const AdminHamperBundlesContent = () => {
  const [bundles, setBundles] = useState<Hamper[]>([]);
  const [catalogItems, setCatalogItems] = useState<HamperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Hamper | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const fetchAll = async () => {
    const [{ data: hampers }, { data: items }] = await Promise.all([
      supabase
        .from("hampers" as any)
        .select("*, hamper_bundle_items(id, item_name, quantity, hamper_item_id)")
        .order("created_at", { ascending: false }),
      supabase
        .from("hamper_items" as any)
        .select("id, name, category")
        .eq("is_active", true)
        .order("name"),
    ]);
    setBundles((hampers as any) || []);
    setCatalogItems((items as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("hampers-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "hampers" }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setSelectedItemIds([]);
    setDialogOpen(true);
  };

  const openEdit = async (h: Hamper) => {
    setEditing(h);
    setForm({
      name: h.name,
      description: h.description || "",
      short_description: h.short_description || "",
      price: String(h.price),
      category: h.category || "general",
      stock_quantity: String(h.stock_quantity ?? 0),
      image_url: h.image_url || "",
      is_active: h.is_active,
      is_landing_featured: !!h.is_landing_featured,
    });
    // Pre-select linked catalog items
    const { data: bundleItems } = await supabase
      .from("hamper_bundle_items" as any)
      .select("hamper_item_id")
      .eq("hamper_id", h.id);
    setSelectedItemIds(((bundleItems as any) || []).map((b: any) => b.hamper_item_id).filter(Boolean));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error("Name and price are required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description || null,
        short_description: form.short_description || null,
        price: parseFloat(form.price),
        category: form.category,
        stock_quantity: parseInt(form.stock_quantity || "0", 10),
        image_url: form.image_url || null,
        is_active: form.is_active,
        is_landing_featured: form.is_landing_featured,
      };

      let bundleId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("hampers" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Bundle updated");
      } else {
        const { data, error } = await supabase
          .from("hampers" as any)
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        bundleId = (data as any).id;
        toast.success("Bundle created");
      }

      // Sync bundle items: clear and re-insert from selected catalog items
      if (bundleId) {
        await supabase.from("hamper_bundle_items" as any).delete().eq("hamper_id", bundleId);
        if (selectedItemIds.length > 0) {
          const rows = selectedItemIds.map((itemId) => {
            const cat = catalogItems.find((c) => c.id === itemId);
            return {
              hamper_id: bundleId,
              hamper_item_id: itemId,
              item_name: cat?.name || "Item",
              quantity: 1,
            };
          });
          await supabase.from("hamper_bundle_items" as any).insert(rows);
        }
      }

      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      toast.error(`Failed to save bundle: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this hamper bundle?")) return;
    try {
      await supabase.from("hamper_bundle_items" as any).delete().eq("hamper_id", id);
      const { error } = await supabase.from("hampers" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Bundle deleted");
      fetchAll();
    } catch (err: any) {
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      toast.error(`Failed to delete: ${msg}`);
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  };

  return (
    <>
      <SEO title="Hamper Bundles | Admin" description="Manage buyable hamper bundles for the marketplace" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Gift className="w-7 h-7 text-primary" />
              Hamper Bundles
            </h1>
            <p className="text-muted-foreground">Buyable hamper bundles shown in the marketplace</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" /> New Bundle
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Bundles ({bundles.length})</CardTitle>
            <CardDescription>These appear under Marketplace → Hampers tab.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : bundles.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-3">No bundles yet</p>
                <Button variant="outline" onClick={openAdd}>
                  <Plus className="w-4 h-4 mr-2" /> Create your first bundle
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bundle</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundles.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {b.image_url ? (
                              <img src={b.image_url} alt={b.name} className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <Gift className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{b.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{b.category || "general"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{b.hamper_bundle_items?.length || 0} items</TableCell>
                        <TableCell className="font-semibold">R{Number(b.price).toFixed(2)}</TableCell>
                        <TableCell>{b.stock_quantity}</TableCell>
                        <TableCell>
                          <Badge variant={b.is_active ? "default" : "secondary"}>
                            {b.is_active ? "Live" : "Hidden"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(b.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Bundle" : "New Hamper Bundle"}</DialogTitle>
            <DialogDescription>
              Bundles appear in Marketplace → Hampers. Attach catalog items so students see what's inside.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Survival Hamper - Junior" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="essentials">Essentials</SelectItem>
                    <SelectItem value="snacks">Snacks</SelectItem>
                    <SelectItem value="study">Study Pack</SelectItem>
                    <SelectItem value="exam">Exam Survival</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Short tagline (one-liner)</Label>
              <Input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} placeholder="Everything a first-year needs" />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Full description shown on the marketplace card." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (R) *</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="299.00" />
              </div>
              <div>
                <Label>Stock quantity</Label>
                <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
              </div>
            </div>

            <ImageInput
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              bucket="hamper-images"
              pathPrefix="bundles"
              label="Bundle image"
            />

            <div>
              <Label>Items in this bundle</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Pick from your hamper catalog. {selectedItemIds.length} selected.
              </p>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                {catalogItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No catalog items yet — create some in Hamper Catalog first.
                  </p>
                ) : (
                  catalogItems.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm flex-1">{item.name}</span>
                      <Badge variant="outline" className="text-xs">{item.category}</Badge>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
                <Label>Live in marketplace</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_landing_featured} onCheckedChange={(c) => setForm({ ...form, is_landing_featured: c })} />
                <Label>Feature on landing</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editing ? "Save changes" : "Create bundle"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AdminHamperBundles = () => (
  <AdminLayout><AdminHamperBundlesContent /></AdminLayout>
);

export default AdminHamperBundles;
