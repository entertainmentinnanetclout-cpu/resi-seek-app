import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Package, Truck, Clock, CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { safeFormatDate } from "@/lib/utils";

interface DiscountOrder {
  id: string;
  discount_id: string;
  quantity: number;
  total_price: number;
  status: string;
  delivery_address: string | null;
  notes: string | null;
  created_at: string;
  discount?: { name: string; provider: string; image_url: string | null };
}

const orderStatuses = [
  { value: "pending", label: "Pending", icon: Clock, color: "text-warning" },
  { value: "confirmed", label: "Confirmed", icon: CheckCircle, color: "text-primary" },
  { value: "processing", label: "Processing", icon: Package, color: "text-primary" },
  { value: "ready", label: "Ready for Pickup", icon: Package, color: "text-success" },
  { value: "delivered", label: "Delivered", icon: Truck, color: "text-success" },
  { value: "cancelled", label: "Cancelled", icon: XCircle, color: "text-destructive" },
];

const MyDiscountOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<DiscountOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("discount_orders")
        .select(`
          *,
          discount:student_discounts!fk_discount_orders_discount(name, provider, image_url)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    if (user) {
      const channel = supabase
        .channel("my-discount-orders")
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "discount_orders",
          filter: `user_id=eq.${user.id}`
        }, fetchOrders)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const cancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
      const { error } = await supabase
        .from("discount_orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("status", "pending"); // Can only cancel pending orders

      if (error) throw error;
      toast.success("Order cancelled");
      fetchOrders();
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order");
    }
  };

  const getStatusConfig = (status: string) => {
    return orderStatuses.find(s => s.value === status) || orderStatuses[0];
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      processing: "default",
      ready: "default",
      delivered: "default",
      cancelled: "destructive",
    };
    const config = getStatusConfig(status);
    return <Badge variant={variants[status] || "secondary"}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO title="My Discount Orders | ResKonnect" description="Track your discount orders" />

      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/discounts")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShoppingBag className="w-8 h-8 text-primary" />
              My Orders
            </h1>
            <p className="text-muted-foreground">Track your discount orders</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
              <p className="text-muted-foreground mb-4">Browse our student discounts and place your first order!</p>
              <Button onClick={() => navigate("/discounts")}>Browse Discounts</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const StatusIcon = statusConfig.icon;

              return (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {order.discount?.image_url ? (
                        <img 
                          src={order.discount.image_url} 
                          alt={order.discount.name} 
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">{order.discount?.name}</h3>
                            <p className="text-sm text-muted-foreground">{order.discount?.provider}</p>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <span>Qty: {order.quantity}</span>
                          <span className="font-semibold">R{order.total_price?.toLocaleString()}</span>
                        </div>

                        <p className="text-xs text-muted-foreground mt-1">
                          Ordered: {safeFormatDate(order.created_at)}
                        </p>

                        {order.delivery_address && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Delivery: {order.delivery_address}
                          </p>
                        )}

                        {/* Progress tracker */}
                        <div className="mt-4 flex items-center gap-2">
                          {["pending", "confirmed", "processing", "ready", "delivered"].map((step, index) => {
                            const isActive = orderStatuses.findIndex(s => s.value === order.status) >= index;
                            const isCancelled = order.status === "cancelled";
                            return (
                              <div key={step} className="flex items-center">
                                <div className={`w-3 h-3 rounded-full ${isCancelled ? 'bg-destructive/30' : isActive ? 'bg-success' : 'bg-muted'}`} />
                                {index < 4 && (
                                  <div className={`w-8 h-0.5 ${isCancelled ? 'bg-destructive/30' : isActive ? 'bg-success' : 'bg-muted'}`} />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {order.status === "pending" && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-3 text-destructive"
                            onClick={() => cancelOrder(order.id)}
                          >
                            Cancel Order
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyDiscountOrders;
