import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Plus, Package, Trash2, ExternalLink, ShoppingBag, Clock, CheckCircle, Truck, XCircle, Star, DollarSign, TrendingUp, AlertTriangle, MessageCircle, Edit } from "lucide-react";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";
import { formatDistanceToNow } from "date-fns";
import StoreReviews from "@/components/StoreReviews";
import { ProductFormDialog } from "@/components/admin/ProductFormDialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StoreData {
  id: string;
  store_name: string;
  store_description: string | null;
  store_logo_url: string | null;
  store_banner_url: string | null;
  campus: string | null;
  total_sales: number;
  rating: number;
  is_active: boolean;
  verified?: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  images: string[];
  stock_quantity: number;
  sku: string | null;
  tags: string[];
  brand: string | null;
  is_active: boolean;
  is_featured: boolean;
  category_id: string | null;
  created_at: string;
}

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

interface Order {
  id: string;
  listing_id: string;
  buyer_id: string;
  status: string;
  quantity: number;
  total_price: number;
  buyer_notes: string | null;
  delivery_address: string | null;
  buyer_phone: string | null;
  created_at: string;
  listing?: { item_name: string; images: string[] };
  buyer?: { full_name: string; phone: string | null };
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-500" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "bg-blue-500" },
  in_transit: { label: "In Transit", icon: Truck, color: "bg-purple-500" },
  delivered: { label: "Delivered", icon: Package, color: "bg-green-500" },
  completed: { label: "Completed", icon: CheckCircle, color: "bg-green-600" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-destructive" },
};

const MyStore = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState<StoreData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  useEffect(() => {
    if (user) fetchStoreData();
  }, [user]);

  const fetchStoreData = async () => {
    if (!user) return;
    setIsLoading(true);

    // Fetch store
    const { data: storeData, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (storeError) console.error("Error fetching store:", storeError);

    if (!storeData) {
      navigate("/store-setup");
      return;
    }

    setStore(storeData);

    // Fetch categories
    const { data: catData } = await supabase
      .from("product_categories")
      .select("id, name, slug")
      .order("display_order");
    setCategories(catData || []);

    // Fetch products for this store
    const { data: productsData } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeData.id)
      .order("created_at", { ascending: false });
    setProducts((productsData as Product[]) || []);

    // Fetch orders for this seller
    const { data: ordersData } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    const ordersWithData = await Promise.all(
      (ordersData || []).map(async (order) => {
        const { data: listing } = await supabase
          .from("marketplace_listings")
          .select("item_name, images")
          .eq("id", order.listing_id)
          .maybeSingle();
        const { data: buyer } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", order.buyer_id)
          .maybeSingle();
        return { ...order, listing, buyer };
      })
    );
    setOrders(ordersWithData);

    // Fetch seller earnings
    const { data: earningsData } = await supabase
      .from("seller_earnings" as any)
      .select("*")
      .eq("store_id", storeData.id)
      .order("created_at", { ascending: false });
    setEarnings((earningsData as any[]) || []);

    setIsLoading(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("marketplace_orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
      toast.success(`Order status updated to ${newStatus}`);
      fetchStoreData();
    } catch (error) {
      toast.error("Failed to update order status");
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductId) return;
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", deleteProductId);
      if (error) throw error;
      toast.success("Product deleted");
      setProducts(products.filter((p) => p.id !== deleteProductId));
    } catch (error: any) {
      toast.error("Failed to delete product");
    } finally {
      setDeleteProductId(null);
    }
  };

  if (shouldBlock) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Store exists but not verified — show pending approval
  if (store && !store.verified) {
    return (
      <DashboardLayout>
        <SEO title="My Store — Pending Approval" description="Your store is awaiting admin approval." />
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto">
            <Card className="border-yellow-500/50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                </div>
                <h2 className="text-2xl font-bold">Store Pending Approval</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Your store <span className="font-semibold text-foreground">"{store.store_name}"</span> has been submitted and is waiting for admin approval. Once approved, you'll have full access to list products, manage orders, and track earnings.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <Button
                    onClick={() => {
                      const message = encodeURIComponent(
                        `Hi ResKonnect! I'd like to follow up on my store approval for "${store.store_name}". My email is ${user?.email}. Please let me know the status.`
                      );
                      window.open(`https://wa.me/27637323192?text=${message}`, "_blank");
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contact Admin on WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/marketplace")}>
                    Browse Marketplace
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Approval typically takes 24–48 hours. You'll be notified once your store is live.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const activeOrders = orders.filter(o => !["completed", "cancelled"].includes(o.status));

  return (
    <DashboardLayout>
      <SEO
        title="My Store | Manage Your Products"
        description="Manage your store, products, orders and earnings on the student marketplace."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Store Header */}
          <Card className="overflow-hidden">
            {store?.store_banner_url && (
              <div
                className="h-32 bg-cover bg-center"
                style={{ backgroundImage: `url(${store.store_banner_url})` }}
              />
            )}
            <CardContent className={`p-6 ${store?.store_banner_url ? "-mt-12" : ""}`}>
              <div className="flex items-start gap-4">
                {store?.store_logo_url ? (
                  <img
                    src={store.store_logo_url}
                    alt={store.store_name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-background"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background">
                    <Store className="w-8 h-8 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h1 className="text-2xl font-bold">{store?.store_name}</h1>
                      {store?.campus && (
                        <p className="text-muted-foreground">{store.campus}</p>
                      )}
                    </div>
                    <Button variant="outline" onClick={() => navigate(`/store/${store?.id}`)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Public Page
                    </Button>
                  </div>
                  {store?.store_description && (
                    <p className="text-muted-foreground mt-2">{store.store_description}</p>
                  )}
                  <Badge className="mt-2 bg-green-600">✓ Verified Seller</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-sm text-muted-foreground">Products</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{activeOrders.length}</p>
                <p className="text-sm text-muted-foreground">Active Orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{store?.total_sales || 0}</p>
                <p className="text-sm text-muted-foreground">Sales</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <p className="text-2xl font-bold">
                    {store?.rating ? store.rating.toFixed(1) : "N/A"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">Rating</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="products" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>

            {/* Products Tab */}
            <TabsContent value="products">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>My Products</CardTitle>
                      <CardDescription>Full product catalog — manage stock, pricing, images and more</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingProduct(null); setShowProductForm(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Product
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {products.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-1">No products yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Start building your catalog — add products with images, pricing, stock levels and more.
                      </p>
                      <Button onClick={() => { setEditingProduct(null); setShowProductForm(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Product
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{product.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-lg font-bold text-primary">
                                R{product.price.toLocaleString()}
                              </span>
                              {product.compare_at_price && (
                                <span className="text-sm text-muted-foreground line-through">
                                  R{product.compare_at_price.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant={product.is_active ? "default" : "secondary"}>
                                {product.is_active ? "Active" : "Inactive"}
                              </Badge>
                              {product.is_featured && (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                  <Star className="w-3 h-3 mr-1" /> Featured
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Stock: {product.stock_quantity}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingProduct({
                                  id: product.id,
                                  name: product.name,
                                  description: product.description || "",
                                  price: product.price,
                                  compare_at_price: product.compare_at_price,
                                  images: product.images || [],
                                  stock_quantity: product.stock_quantity,
                                  sku: product.sku || "",
                                  tags: product.tags || [],
                                  brand: product.brand || "",
                                  is_active: product.is_active,
                                  is_featured: product.is_featured,
                                  category_id: product.category_id,
                                });
                                setShowProductForm(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteProductId(product.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle>Incoming Orders</CardTitle>
                  <CardDescription>Manage orders from buyers</CardDescription>
                </CardHeader>
                <CardContent>
                  {orders.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No orders yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => {
                        const status = statusConfig[order.status] || statusConfig.pending;
                        const StatusIcon = status.icon;
                        return (
                          <div key={order.id} className="p-4 border rounded-lg space-y-3">
                            <div className="flex items-start gap-4">
                              {order.listing?.images?.[0] ? (
                                <img
                                  src={order.listing.images[0]}
                                  alt={order.listing.item_name}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                                  <Package className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1">
                                <h3 className="font-medium">{order.listing?.item_name || "Unknown Item"}</h3>
                                <p className="text-sm text-muted-foreground">
                                  Buyer: {order.buyer?.full_name || "Unknown"}
                                  {order.buyer?.phone && ` • ${order.buyer.phone}`}
                                </p>
                                <p className="text-lg font-bold text-primary">
                                  R{order.total_price.toLocaleString()} × {order.quantity}
                                </p>
                              </div>
                              <Badge className={`${status.color} text-white`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                            </div>
                            {order.buyer_notes && (
                              <div className="p-3 bg-muted rounded-lg text-sm">
                                <span className="font-medium">Note:</span> {order.buyer_notes}
                              </div>
                            )}
                            {order.delivery_address && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Delivery:</span> {order.delivery_address}
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                              </span>
                              <Select
                                value={order.status}
                                onValueChange={(value) => updateOrderStatus(order.id, value)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="in_transit">In Transit</SelectItem>
                                  <SelectItem value="delivered">Delivered</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Earnings Tab */}
            <TabsContent value="earnings">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    My Earnings
                  </CardTitle>
                  <CardDescription>Track your revenue and platform fees</CardDescription>
                </CardHeader>
                <CardContent>
                  {earnings.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No earnings yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Earnings will appear here when customers complete purchases.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-lg font-bold">
                            R{earnings.reduce((s, e) => s + Number(e.gross_amount || 0), 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">Gross</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-lg font-bold text-destructive">
                            -R{earnings.reduce((s, e) => s + Number(e.platform_fee || 0), 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">Fees</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-lg font-bold text-primary">
                            R{earnings.reduce((s, e) => s + Number(e.net_amount || 0), 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">Net</p>
                        </div>
                      </div>
                      {earnings.map((e: any) => (
                        <div key={e.id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-mono text-muted-foreground">
                              Order {e.order_id?.substring(0, 8)}…
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">R{Number(e.net_amount).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              {Number(e.fee_percentage).toFixed(1)}% fee
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews">
              {store && <StoreReviews storeId={store.id} />}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this product. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {store && (
        <ProductFormDialog
          open={showProductForm}
          onOpenChange={setShowProductForm}
          product={editingProduct}
          storeId={store.id}
          categories={categories}
          onSaved={() => {
            setShowProductForm(false);
            fetchStoreData();
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default MyStore;
