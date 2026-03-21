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
import { Gift, Plus, Pencil, Trash2, Loader2, Image, Apple, BookOpen, ShowerHead, Laptop, Bed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HamperItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  estimated_price: number | null;
  is_active: boolean;
  created_at: string;
}

const categories = [
  { value: "food", label: "Food & Snacks", icon: Apple },
  { value: "stationery", label: "Stationery", icon: BookOpen },
  { value: "toiletries", label: "Toiletries", icon: ShowerHead },
  { value: "tech", label: "Tech & Gadgets", icon: Laptop },
  { value: "bedding", label: "Bedding & Linen", icon: Bed },
];

const AdminHamperItems = () => {
  const [items, setItems] = useState<HamperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<HamperItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formData, setFormData] = useState({
    name: "",
    category: "food",
    description: "",
    image_url: "",
    estimated_price: "",
    is_active: true,
  });

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from("hamper_items")
        .select("*")
        .order("category", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Failed to load hamper items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel("hamper-items-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hamper_items" }, fetchItems)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleEdit = (item: HamperItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      description: item.description || "",
      image_url: item.image_url || "",
      estimated_price: item.estimated_price?.toString() || "",
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category: "food",
      description: "",
      image_url: "",
      estimated_price: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.category) {
      toast.error("Please fill in required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        description: formData.description || null,
        image_url: formData.image_url || null,
        estimated_price: formData.estimated_price ? parseFloat(formData.estimated_price) : null,
        is_active: formData.is_active,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("hamper_items")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast.success("Item updated");
      } else {
        const { error } = await supabase
          .from("hamper_items")
          .insert([payload]);

        if (error) throw error;
        toast.success("Item created");
      }

      setDialogOpen(false);
      fetchItems();
    } catch (error: any) {
      console.error("Error saving item:", error);
      toast.error(error.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const { error } = await supabase
        .from("hamper_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Item deleted");
      fetchItems();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item");
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat ? <cat.icon className="w-4 h-4" /> : null;
  };

  const filteredItems = categoryFilter === "all" 
    ? items 
    : items.filter(item => item.category === categoryFilter);

  return (
    <AdminLayout>
      <SEO title="Hamper Items | Admin" description="Manage student hamper item catalog" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Gift className="w-8 h-8 text-primary" />
              Hamper Items
            </h1>
            <p className="text-muted-foreground">Manage items students can choose for their hampers</p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>

        {/* Category Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {categories.map(cat => {
            const count = items.filter(i => i.category === cat.value).length;
            const Icon = cat.icon;
            return (
              <Card 
                key={cat.value} 
                className={`cursor-pointer transition-all ${categoryFilter === cat.value ? 'border-primary' : ''}`}
                onClick={() => setCategoryFilter(categoryFilter === cat.value ? "all" : cat.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{cat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Item Catalog ({filteredItems.length})</CardTitle>
            <CardDescription>
              {categoryFilter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setCategoryFilter("all")}>
                  Clear filter
                </Button>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No items found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Est. Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <Image className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{item.name}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.description}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {getCategoryIcon(item.category)}
                            {categories.find(c => c.value === item.category)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.estimated_price ? `R${item.estimated_price}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.is_active ? "default" : "secondary"}>
                            {item.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(item.id)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the item details" : "Add a new item to the hamper catalog"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Item Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 2-Minute Noodles (5 pack)"
              />
            </div>

            <div>
              <Label>Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the item..."
                rows={2}
              />
            </div>

            <div>
              <Label>Image URL</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div>
              <Label>Estimated Price (R)</Label>
              <Input
                type="number"
                value={formData.estimated_price}
                onChange={(e) => setFormData({ ...formData, estimated_price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editingItem ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AdminHamperItems = () => (
  <AdminLayout><AdminHamperItemsContent /></AdminLayout>
);

export default AdminHamperItems;
