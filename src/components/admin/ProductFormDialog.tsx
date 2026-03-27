import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

interface ProductData {
  id?: string;
  name: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  category_id: string | null;
  images: string[];
  stock_quantity: number;
  sku: string;
  tags: string[];
  brand: string;
  is_active: boolean;
  is_featured: boolean;
}

const emptyProduct: ProductData = {
  name: "",
  description: "",
  price: 0,
  compare_at_price: null,
  category_id: null,
  images: [],
  stock_quantity: 0,
  sku: "",
  tags: [],
  brand: "",
  is_active: true,
  is_featured: false,
};

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductData | null;
  storeId: string;
  categories: ProductCategory[];
  onSaved: () => void;
}

export const ProductFormDialog = ({
  open,
  onOpenChange,
  product,
  storeId,
  categories,
  onSaved,
}: ProductFormDialogProps) => {
  const [form, setForm] = useState<ProductData>(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const isEditing = !!product?.id;

  useEffect(() => {
    if (product) {
      setForm({ ...emptyProduct, ...product });
      setTagInput((product.tags || []).join(", "));
    } else {
      setForm(emptyProduct);
      setTagInput("");
    }
  }, [product, open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newImages: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${storeId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, file, { upsert: true });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);

        newImages.push(urlData.publicUrl);
      }

      setForm((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
      toast.success(`${newImages.length} image(s) uploaded`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (form.price <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      const tags = tagInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: form.price,
        compare_at_price: form.compare_at_price || null,
        category_id: form.category_id || null,
        images: form.images,
        stock_quantity: form.stock_quantity,
        sku: form.sku.trim() || null,
        tags,
        brand: form.brand.trim() || null,
        is_active: form.is_active,
        is_featured: form.is_featured,
        store_id: storeId,
        payment_type: (form as any).payment_type || "standard",
        checkout_url: (form as any).payment_type === "checkout_link" ? ((form as any).checkout_url || null) : null,
      };

      if (isEditing && product?.id) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id);
        if (error) throw error;
        toast.success("Product updated");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Product created");
      }

      onSaved();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Save error:", error);

      let msg = "Unknown error";
      if (error && typeof error === "object") {
        const err = error as { message?: unknown; details?: unknown; code?: unknown };
        const message = typeof err.message === "string" ? err.message : null;
        const details = typeof err.details === "string" ? err.details : null;
        const code = typeof err.code === "string" ? err.code : null;

        msg = [message, details, code ? `(${code})` : null].filter(Boolean).join(" ") || JSON.stringify(error);
      } else {
        msg = String(error);
      }

      toast.error(`Failed to save product: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update product details" : "List a new product on the ResKonnect Store"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. TUT Hoodie — Navy Blue"
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Product details, sizes, textures, materials..."
              rows={4}
            />
          </div>

          {/* Price row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price">Price (R) *</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                value={form.price || ""}
                onChange={(e) => setForm((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="compare_price">Compare-at Price (R)</Label>
              <Input
                id="compare_price"
                type="number"
                min={0}
                step={0.01}
                value={form.compare_at_price ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    compare_at_price: e.target.value ? parseFloat(e.target.value) : null,
                  }))
                }
                placeholder="Original price for sale display"
              />
            </div>
          </div>

          {/* Category & Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.category_id || "none"}
                onValueChange={(v) => setForm((p) => ({ ...p, category_id: v === "none" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={form.brand}
                onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                placeholder="e.g. ResKonnect"
              />
            </div>
          </div>

          {/* Stock & SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stock">Stock Quantity</Label>
              <Input
                id="stock"
                type="number"
                min={0}
                value={form.stock_quantity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, stock_quantity: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                placeholder="e.g. RK-HOODIE-NB-001"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. clothing, hoodie, winter"
            />
          </div>

          {/* Payment Configuration */}
          <div className="grid gap-2">
            <Label>Payment Type</Label>
            <Select
              value={(form as any).payment_type || "standard"}
              onValueChange={(v) => setForm((p) => ({ ...p, payment_type: v } as any))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (Cart + COD/Yoco)</SelectItem>
                <SelectItem value="checkout_link">External Checkout Link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(form as any).payment_type === "checkout_link" && (
            <div className="grid gap-2">
              <Label htmlFor="checkout_url">Checkout URL</Label>
              <Input
                id="checkout_url"
                type="url"
                value={(form as any).checkout_url || ""}
                onChange={(e) => setForm((p) => ({ ...p, checkout_url: e.target.value } as any))}
                placeholder="https://pay.yoco.com/your-link or any payment URL"
              />
              <p className="text-xs text-muted-foreground">
                Users will be redirected to this link when they click "Buy Now"
              </p>
            </div>
          )}

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_featured}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_featured: v }))}
              />
              <Label>Featured</Label>
            </div>
          </div>

          {/* Images */}
          <div className="grid gap-2">
            <Label>Images</Label>
            <div className="grid grid-cols-4 gap-2">
              {form.images.map((url, idx) => (
                <div key={idx} className="relative aspect-square group">
                  <img
                    src={url}
                    alt={`Product ${idx + 1}`}
                    className="w-full h-full object-cover rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="aspect-square border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors text-muted-foreground">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 mb-1" />
                    <span className="text-xs">Upload</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? "Update Product" : "Add Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
