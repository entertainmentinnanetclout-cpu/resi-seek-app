import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingBag, Clock, CheckCircle, Truck, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

interface Order {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  quantity: number;
  total_price: number;
  buyer_notes: string | null;
  delivery_address: string | null;
  buyer_phone: string | null;
  created_at: string;
  listing?: {
    item_name: string;
    images: string[];
  };
  seller?: {
    full_name: string;
  };
  buyer?: {
    full_name: string;
  };
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-500" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "bg-blue-500" },
  in_transit: { label: "In Transit", icon: Truck, color: "bg-purple-500" },
  delivered: { label: "Delivered", icon: Package, color: "bg-green-500" },
  completed: { label: "Completed", icon: CheckCircle, color: "bg-green-600" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-destructive" },
};

const Orders = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    setIsLoading(true);

    const { data, error } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
      setIsLoading(false);
      return;
    }

    // Fetch related data
    const ordersWithData = await Promise.all(
      (data || []).map(async (order) => {
        // Get listing
        const { data: listing } = await supabase
          .from("marketplace_listings")
          .select("item_name, images")
          .eq("id", order.listing_id)
          .maybeSingle();

        // Get seller profile
        const { data: seller } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", order.seller_id)
          .maybeSingle();

        return { ...order, listing, seller };
      })
    );

    setOrders(ordersWithData);
    setIsLoading(false);
  };

  if (shouldBlock) return null;

  const activeOrders = orders.filter(
    (o) => !["completed", "cancelled"].includes(o.status)
  );
  const pastOrders = orders.filter((o) =>
    ["completed", "cancelled"].includes(o.status)
  );

  const renderOrder = (order: Order) => {
    const status = statusConfig[order.status] || statusConfig.pending;
    const StatusIcon = status.icon;

    return (
      <Card key={order.id}>
        <CardContent className="p-4">
          <div className="flex gap-4">
            {order.listing?.images?.[0] ? (
              <img
                src={order.listing.images[0]}
                alt={order.listing.item_name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">
                {order.listing?.item_name || "Unknown Item"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Seller: {order.seller?.full_name || "Unknown"}
              </p>
              <p className="text-lg font-bold text-primary mt-1">
                R{order.total_price.toLocaleString()}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`${status.color} text-white`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(order.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>

          {order.buyer_notes && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Note:</span> {order.buyer_notes}
              </p>
            </div>
          )}
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
            <p className="text-muted-foreground mt-1">
              Track your marketplace purchases
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No orders yet</h3>
                <p className="text-muted-foreground mt-2">
                  When you make purchases from the marketplace, they'll appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="active" className="space-y-4">
              <TabsList>
                <TabsTrigger value="active">
                  Active ({activeOrders.length})
                </TabsTrigger>
                <TabsTrigger value="past">
                  Past ({pastOrders.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4">
                {activeOrders.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">No active orders</p>
                    </CardContent>
                  </Card>
                ) : (
                  activeOrders.map(renderOrder)
                )}
              </TabsContent>

              <TabsContent value="past" className="space-y-4">
                {pastOrders.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">No past orders</p>
                    </CardContent>
                  </Card>
                ) : (
                  pastOrders.map(renderOrder)
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Orders;
