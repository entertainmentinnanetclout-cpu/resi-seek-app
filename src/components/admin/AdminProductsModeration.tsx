import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Eye, Search, ShoppingCart, Power, ChevronUp, ChevronDown } from "lucide-react";
import AdminPlaceOrderDialog from "@/components/admin/AdminPlaceOrderDialog";

interface ProductRow {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  stock_quantity: number;
  store_id: string;
  images?: string[];
  display_order: number;
  stores?: { store_name: string } | null;
}

const AdminProductsModeration = () => {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [orderProduct, setOrderProduct] = useState<ProductRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("products")
      .select("id, name, price, is_active, stock_quantity, store_id, images, display_order, stores(store_name)")
      .order("display_order", { ascending: true })
      .limit(200);
    if (error) toast.error(error.message);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Permanently delete this product?")) return;
    const { error } = await supabase.from("products" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Product deleted");
    load();
  };

  const handleReorder = async (product: ProductRow, direction: "up" | "down") => {
    const currentIndex = items.findIndex((i) => i.id === product.id);
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === items.length - 1) return;

    const otherIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const otherProduct = items[otherIndex];

    const currentOrder = product.display_order || 0;
    const otherOrder = otherProduct.display_order || 0;

    try {
      const { error: err1 } = await supabase
        .from("products" as any)
        .update({ display_order: otherOrder })
        .eq("id", product.id);
      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from("products" as any)
        .update({ display_order: currentOrder })
        .eq("id", otherProduct.id);
      if (err2) throw err2;

      toast.success("Order updated");
      load();
    } catch (err: any) {
      toast.error("Failed to reorder");
    }
  };

  const toggle = async (p: ProductRow) => {
    const { error } = await (supabase as any).from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const filtered = items.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.stores?.store_name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Seller Products ({items.length})</CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search product or store..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No products</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Order</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, idx) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={idx === 0}
                          onClick={() => handleReorder(p, "up")}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={idx === items.length - 1}
                          onClick={() => handleReorder(p, "down")}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover" />}
                      <span className="font-medium">{p.name}</span>
                    </TableCell>
                    <TableCell>{p.stores?.store_name || "—"}</TableCell>
                    <TableCell>R{Number(p.price).toFixed(2)}</TableCell>
                    <TableCell>{p.stock_quantity}</TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Order on behalf" onClick={() => setOrderProduct(p)}>
                          <ShoppingCart className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="View" onClick={() => window.open(`/product/${p.id}`, "_blank")}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Toggle active" onClick={() => toggle(p)}>
                          <Power className={`w-4 h-4 ${p.is_active ? "text-green-500" : "text-muted-foreground"}`} />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(p.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
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
      <AdminPlaceOrderDialog open={!!orderProduct} onClose={() => { setOrderProduct(null); }} product={orderProduct as any} />
    </Card>
  );
};

export default AdminProductsModeration;