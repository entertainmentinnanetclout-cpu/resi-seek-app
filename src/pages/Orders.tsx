import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingBag, Clock, CheckCircle, Truck, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";
import { useNavigate } from "react-router-dom";

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" },
  confirmed: { label: "Confirmed", icon: CheckCircle, variant: "default" },
  processing: { label: "Processing", icon: Package, variant: "default" },
  in_transit: { label: "In Transit", icon: Truck, variant: "default" },
  delivered: { label: "Delivered", icon: CheckCircle, variant: "default" },
  completed: { label: "Completed", icon: CheckCircle, variant: "default" },
  cancelled: { label: "Cancelled", icon: XCircle, variant: "destructive" },
};

const Orders = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  if (shouldBlock) return null;

  const fetchOrders = async () => {
    if (!user) return;
    setIsLoading(true);

    // Fetch from new shop_orders table
    const { data: shopOrders, error: shopError } = await supabase
      .from("shop_orders" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (shopError) {
      console.error("Error fetching orders:", shopError);
    }

    // Fetch order items for each order
    const ordersWithItems = await Promise.all(
      (shopOrders || []).map(async (order: any) => {
        const { data: items } = await supabase
          .from("shop_order_items" as any)
          .select("*, products(name, images, price, stores(store_name))")
          .eq("order_id", order.id);
        return { ...order, items: items || [] };
      })
    );

    // Also fetch legacy marketplace_orders
    const { data: legacyOrders } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    const legacyWithItems = await Promise.all(
      (legacyOrders || []).map(async (order: any) => {
        const { data: listing } = await supabase
          .from("marketplace_listings")
          .select("item_name, images")
          .eq("id", order.listing_id)
          .maybeSingle();
        return { ...order, _legacy: true, listing };
      })
    );

    setOrders([...ordersWithItems, ...legacyWithItems]);
    setIsLoading(false);
  };

  const activeOrders = orders.filter(o => !["completed", "cancelled", "delivered"].includes(o.status));
  const pastOrders = orders.filter(o => ["completed", "cancelled", "delivered"].includes(o.status));

  const renderNewOrder = (order: any) => {
    const status = statusConfig[order.status] || statusConfig.pending;
    const StatusIcon = status.icon;
    const firstItem = order.items?.[0];

    return (
      <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm font-mono text-muted-foreground">#{order.order_number}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
              </p>
            </div>
            <Badge variant={status.variant}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <div className="space-y-2">
            {order.items?.map((item: any) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-12 h-12 rounded bg-muted overflow-hidden flex-shrink-0">
                  {item.products?.images?.[0] ? (
                    <img src={item.products.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.products?.name || "Product"}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.products?.stores?.store_name} · Qty: {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold">R{Number(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t">
            <span className="text-sm text-muted-foreground">{order.payment_method === "cod" ? "Cash on Delivery" : "PayFast"}</span>
            <span className="font-bold text-primary">R{Number(order.total_amount).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLegacyOrder = (order: any) => {
    const status = statusConfig[order.status] || statusConfig.pending;
    const StatusIcon = status.icon;

    return (
      <Card key={order.id}>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
              {order.listing?.images?.[0] ? (
                <img src={order.listing.images[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-medium truncate">{order.listing?.item_name || "Item"}</h3>
              <p className="text-lg font-bold text-primary">R{Number(order.total_price).toFixed(2)}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={status.variant}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <SEO title="My Orders | ResKonnect" description="Track your marketplace orders" />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My Orders</h1>
            <p className="text-muted-foreground mt-1">Track your marketplace purchases</p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
            </div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No orders yet</h3>
                <p className="text-muted-foreground mt-2">When you make purchases, they'll appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="active" className="space-y-4">
              <TabsList>
                <TabsTrigger value="active">Active ({activeOrders.length})</TabsTrigger>
                <TabsTrigger value="past">Past ({pastOrders.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="space-y-4">
                {activeOrders.length === 0 ? (
                  <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">No active orders</p></CardContent></Card>
                ) : activeOrders.map(o => o._legacy ? renderLegacyOrder(o) : renderNewOrder(o))}
              </TabsContent>
              <TabsContent value="past" className="space-y-4">
                {pastOrders.length === 0 ? (
                  <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">No past orders</p></CardContent></Card>
                ) : pastOrders.map(o => o._legacy ? renderLegacyOrder(o) : renderNewOrder(o))}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Orders;
