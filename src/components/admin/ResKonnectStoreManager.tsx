import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Package, Loader2, Tag, Star, Eye, EyeOff } from "lucide-react";
import { ProductFormDialog } from "./ProductFormDialog";
import { useAuth } from "@/contexts/AuthContext";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  category_id: string | null;
  images: string[] | null;
  stock_quantity: number | null;
  sku: string | null;
  tags: string[] | null;
  brand: string | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  store_id: string;
  created_at: string | null;
}

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

export const ResKonnectStoreManager = () => {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  // Auto-create or fetch admin store
  const ensureStore = useCallback(async () => {
    if (!user) return;

    const { data: existing } = await supabase
      .from("stores")
      .select("id")
      .eq("user_id", user.id)
      .eq("store_name", "ResKonnect Store")
      .maybeSingle();

    if (existing) {
      setStoreId(existing.id);
      return;
    }

    const { data: created, error } = await supabase
      .from("stores")
      .insert({
        user_id: user.id,
        store_name: "ResKonnect Store",
        store_description: "Official ResKonnect marketplace — student essentials, merch, and more.",
        verified: true,
        is_active: true,
        contact_email: "reskonnect@gmail.com",
        contact_whatsapp: "27637323192",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create store:", error);
      toast.error("Failed to initialise the ResKonnect Store");
      return;
    }

    setStoreId(created.id);
    toast.success("ResKonnect Store created");
  }, [user]);

  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }, [storeId]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("product_categories")
      .select("id, name, slug")
      .order("display_order");
    setCategories(data || []);
  }, []);

  useEffect(() => {
    ensureStore();
    fetchCategories();
  }, [ensureStore, fetchCategories]);

  useEffect(() => {
    if (storeId) fetchProducts();
  }, [storeId, fetchProducts]);

  const toggleField = async (id: string, field: "is_active" | "is_featured", value: boolean) => {
    const { error } = await supabase.from("products").update({ [field]: value }).eq("id", id);
    if (error) {
      toast.error("Failed to update");
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const deleteProduct = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("products").delete().eq("id", deletingId);
    if (error) {
      toast.error("Failed to delete product");
    } else {
      toast.success("Product deleted");
      setProducts((prev) => prev.filter((p) => p.id !== deletingId));
    }
    setDeletingId(null);
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    const slug = newCategoryName.trim().toLowerCase().replace(/\s+/g, "-");
    const { error } = await supabase
      .from("product_categories")
      .insert({ name: newCategoryName.trim(), slug });

    if (error) {
      toast.error("Failed to add category");
    } else {
      toast.success("Category added");
      setNewCategoryName("");
      fetchCategories();
    }
    setSavingCategory(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === "all" || p.category_id === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const getCategoryName = (catId: string | null) =>
    categories.find((c) => c.id === catId)?.name || "—";

  if (!storeId) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Setting up ResKonnect Store…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)}>
          <Tag className="w-4 h-4 mr-1" /> Categories
        </Button>
        <Button onClick={() => { setEditingProduct(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{products.length}</p>
            <p className="text-xs text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{products.filter((p) => p.is_active).length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{products.filter((p) => p.is_featured).length}</p>
            <p className="text-xs text-muted-foreground">Featured</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">
              {products.filter((p) => (p.stock_quantity ?? 0) <= 5 && p.is_active).length}
            </p>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5" /> Products ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading…</p>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No products yet. Add your first product!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Featured</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover border"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            {product.sku && (
                              <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">R{product.price.toLocaleString()}</span>
                          {product.compare_at_price && (
                            <span className="text-xs text-muted-foreground line-through ml-1">
                              R{product.compare_at_price.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getCategoryName(product.category_id)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (product.stock_quantity ?? 0) <= 5
                              ? "destructive"
                              : "default"
                          }
                        >
                          {product.stock_quantity ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!product.is_active}
                          onCheckedChange={(v) => toggleField(product.id, "is_active", v)}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!product.is_featured}
                          onCheckedChange={(v) => toggleField(product.id, "is_featured", v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingProduct({
                                ...product,
                                description: product.description || "",
                                images: product.images || [],
                                stock_quantity: product.stock_quantity ?? 0,
                                sku: product.sku || "",
                                tags: product.tags || [],
                                brand: product.brand || "",
                                is_active: product.is_active ?? true,
                                is_featured: product.is_featured ?? false,
                              });
                              setFormOpen(true);
                            }}
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeletingId(product.id)}
                            title="Delete"
                          >
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

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct as Parameters<typeof ProductFormDialog>[0]["product"]}
        storeId={storeId}
        categories={categories}
        onSaved={fetchProducts}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The product will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProduct} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <Button onClick={addCategory} disabled={savingCategory} size="sm">
                {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
              </Button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted">
                  <span className="text-sm">{cat.name}</span>
                  <Badge variant="outline" className="text-xs">{cat.slug}</Badge>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No categories yet</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
