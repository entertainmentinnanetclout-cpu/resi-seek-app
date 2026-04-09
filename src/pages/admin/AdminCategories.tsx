import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Loader2, GripVertical } from "lucide-react";

export const AdminCategoriesContent = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [form, setForm] = useState({ name: "", slug: "", image_url: "", display_order: 0 });
  const [saving, setSaving] = useState(false);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("product_categories" as any)
      .select("*")
      .order("display_order");
    if (error) console.error(error);
    setCategories(data || []);

    // Get product counts per category
    const { data: products } = await supabase
      .from("products")
      .select("category_id")
      .not("category_id", "is", null);

    const counts: Record<string, number> = {};
    (products || []).forEach((p: any) => {
      counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    });
    setProductCounts(counts);
    setIsLoading(false);
  };

  const openNew = () => {
    setEditingCat(null);
    setForm({ name: "", slug: "", image_url: "", display_order: categories.length });
    setFormOpen(true);
  };

  const openEdit = (cat: any) => {
    setEditingCat(cat);
    setForm({
      name: cat.name || "",
      slug: cat.slug || "",
      image_url: cat.image_url || "",
      display_order: cat.display_order || 0,
    });
    setFormOpen(true);
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      const slug = form.slug.trim() || generateSlug(form.name);
      const payload = {
        name: form.name.trim(),
        slug,
        image_url: form.image_url.trim() || null,
        display_order: form.display_order,
      };

      if (editingCat) {
        const { error } = await supabase
          .from("product_categories" as any)
          .update(payload)
          .eq("id", editingCat.id);
        if (error) throw error;
        toast.success("Category updated");
      } else {
        const { error } = await supabase
          .from("product_categories" as any)
          .insert(payload as any);
        if (error) throw error;
        toast.success("Category created");
      }
      setFormOpen(false);
      fetchCategories();
    } catch (err: any) {
      const msg = err?.message || String(err);
      toast.error(`Failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: any) => {
    const count = productCounts[cat.id] || 0;
    if (count > 0) {
      toast.error(`Cannot delete — ${count} product(s) are using this category`);
      return;
    }
    if (!confirm(`Delete "${cat.name}"?`)) return;

    const { error } = await supabase
      .from("product_categories" as any)
      .delete()
      .eq("id", cat.id);
    if (error) {
      toast.error("Failed to delete category");
    } else {
      toast.success("Category deleted");
      fetchCategories();
    }
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Product Categories</h3>
          <p className="text-sm text-muted-foreground">Manage categories for marketplace filtering</p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No categories yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat: any) => (
                <TableRow key={cat.id}>
                  <TableCell className="text-muted-foreground">{cat.display_order}</TableCell>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{cat.slug}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{productCounts[cat.id] || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cat)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm((p) => ({
                    ...p,
                    name: e.target.value,
                    slug: editingCat ? p.slug : generateSlug(e.target.value),
                  }));
                }}
                placeholder="e.g. Electronics"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="auto-generated"
              />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((p) => ({ ...p, display_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCat ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
