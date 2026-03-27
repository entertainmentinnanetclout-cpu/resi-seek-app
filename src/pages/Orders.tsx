import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Package, ShoppingBag, Clock, CheckCircle, Truck, XCircle, ChevronDown, MapPin } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline"; step: number }> = {
  pending: { label: "Pending", icon: Clock, variant: "secondary", step: 0 },
  confirmed: { label: "Confirmed", icon: CheckCircle, variant: "default", step: 1 },
  processing: { label: "Processing", icon: Package, variant: "default", step: 2 },
  in_transit: { label: "In Transit", icon: Truck, variant: "default", step: 3 },
  delivered: { label: "Delivered", icon: CheckCircle, variant: "default", step: 4 },
  completed: { label: "Completed", icon: CheckCircle, variant: "default", step: 4 },
  cancelled: { label: "Cancelled", icon: XCircle, variant: "destructive", step: -1 },
};

const trackingSteps = ["Pending", "Confirmed", "Processing", "In Transit", "Delivered"];

const Orders = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  if (shouldBlock) return null;

  const fetchOrders = async () => {
    if (!user) return;
    setIsLoading(true);

    const { data: shopOrders, error: shopError } = await supabase
      .from("shop_orders" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (shopError) console.error("Error fetching orders:", shopError);

    const ordersWithItems = await Promise.all(
      (shopOrders || []).map(async (order: any) => {
        const [{ data: items }, { data: history }] = await Promise.all([
          supabase
            .from("shop_order_items" as any)
            .select("*, products(name, images, price, stores(store_name))")
            .eq("order_id", order.id),
          supabase
            .from("order_status_history")
            .select("*")
            .eq("order_id", order.id)
            .order("created_at", { ascending: true }),
        ]);
        return { ...order, items: items || [], statusHistory: history || [] };
      })
    );

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

  const renderTrackingTimeline = (order: any) => {
    const currentStep = statusConfig[order.status]?.step ?? 0;
    const isCancelled = order.status === "cancelled";

    return (
      <div className="space-y-4 pt-4">
        {/* Step indicator */}
        {!isCancelled && (
          <div className="flex items-center justify-between px-2">
            {trackingSteps.map((step, i) => (
              <div key={step} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  i <= currentStep
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border"
                }`}>
                  {i < currentStep ? "✓" : i + 1}
                </div>
                <span className={`text-[10px] mt-1 text-center ${i <= currentStep ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {step}
                </span>
                {i < trackingSteps.length - 1 && (
                  <div className={`absolute h-0.5 ${i < currentStep ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tracking info */}
        {(order.tracking_number || order.estimated_delivery) && (
          <div className="flex flex-wrap gap-4 text-sm bg-muted/50 rounded-lg p-3">
            {order.tracking_number && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Tracking:</span>
                <span className="font-mono font-medium">{order.tracking_number}</span>
              </div>
            )}
            {order.estimated_delivery && (
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Est. delivery:</span>
                <span className="font-medium">{format(new Date(order.estimated_delivery), "dd MMM yyyy")}</span>
              </div>
            )}
          </div>
        )}

        {/* Status history timeline */}
        {order.statusHistory && order.statusHistory.length > 0 && (
          <div className="border-l-2 border-border ml-4 space-y-3 pl-4">
            {order.statusHistory.map((entry: any) => {
              const cfg = statusConfig[entry.status] || statusConfig.pending;
              const Icon = cfg.icon;
              return (
                <div key={entry.id} className="flex items-start gap-2 relative">
                  <div className="absolute -left-[1.35rem] top-0.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium capitalize">{cfg.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderNewOrder = (order: any) => {
    const status = statusConfig[order.status] || statusConfig.pending;
    const StatusIcon = status.icon;
    const isExpanded = expandedOrder === order.id;

    return (
      <Collapsible key={order.id} open={isExpanded} onOpenChange={() => setExpandedOrder(isExpanded ? null : order.id)}>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <CollapsibleTrigger className="w-full text-left">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-mono text-muted-foreground">#{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={status.variant}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.label}
                  </Badge>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>
            </CollapsibleTrigger>

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

            <CollapsibleContent>
              {renderTrackingTimeline(order)}
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>
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
