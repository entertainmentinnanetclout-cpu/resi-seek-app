import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Package, ShoppingBag, Clock, CheckCircle, Truck, XCircle, ChevronDown, MapPin, Loader2, Upload, FileText } from "lucide-react";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState<string | null>(null);

  // PoP upload state
  const [popOrderId, setPopOrderId] = useState<string | null>(null);
  const [popFile, setPopFile] = useState<File | null>(null);
  const [popRef, setPopRef] = useState("");
  const [isSubmittingPop, setIsSubmittingPop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verify Yoco payment on return — polls up to 10 times (30s)
  const verifyPayment = useCallback(async (orderId: string) => {
    setIsVerifying(true);
    setVerifyFailed(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      let verified = false;

      for (let attempt = 0; attempt < 10; attempt++) {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/yoco-verify-payment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ order_id: orderId }),
          }
        );

        const result = await res.json();

        if (result.verified) {
          verified = true;
          toast.success("Payment confirmed! Your order has been processed.");
          break;
        }

        // Wait 3 seconds before retrying
        if (attempt < 9) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      if (!verified) {
        setVerifyFailed(orderId);
        toast.info("Payment not yet confirmed. You can upload proof of payment below.");
      }
    } catch (err: any) {
      console.error("Payment verification error:", err);
      setVerifyFailed(orderId);
      toast.error("Could not verify payment automatically.");
    } finally {
      setIsVerifying(false);
      fetchOrders();
    }
  }, []);

  // Handle Yoco payment return
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const orderId = searchParams.get("order_id");

    if (paymentStatus === "success" && orderId) {
      verifyPayment(orderId);
      searchParams.delete("payment");
      searchParams.delete("order_id");
      setSearchParams(searchParams, { replace: true });
    } else if (paymentStatus === "cancelled") {
      toast.info("Payment was cancelled. Your order is still pending.");
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

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

  const handleSubmitPop = async () => {
    if (!user || !popOrderId) return;
    if (!popFile && !popRef) {
      toast.error("Please upload a screenshot or enter a reference number");
      return;
    }

    setIsSubmittingPop(true);
    try {
      let imageUrl: string | null = null;

      if (popFile) {
        const ext = popFile.name.split(".").pop();
        const path = `pop/${user.id}/${popOrderId}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, popFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("payment_proofs" as any).insert({
        order_id: popOrderId,
        user_id: user.id,
        image_url: imageUrl,
        reference_number: popRef || null,
        status: "pending",
      } as any);

      if (error) throw error;

      // Update order status
      await supabase
        .from("shop_orders" as any)
        .update({ payment_status: "awaiting_verification", updated_at: new Date().toISOString() } as any)
        .eq("id", popOrderId);

      toast.success("Proof of payment submitted! Admin will review shortly.");
      setPopOrderId(null);
      setPopFile(null);
      setPopRef("");
      setVerifyFailed(null);
      fetchOrders();
    } catch (err: any) {
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      toast.error(`Failed to submit: ${msg}`);
    } finally {
      setIsSubmittingPop(false);
    }
  };

  const activeOrders = orders.filter(o => !["completed", "cancelled", "delivered"].includes(o.status));
  const pastOrders = orders.filter(o => ["completed", "cancelled", "delivered"].includes(o.status));

  const renderTrackingTimeline = (order: any) => {
    const currentStep = statusConfig[order.status]?.step ?? 0;
    const isCancelled = order.status === "cancelled";

    return (
      <div className="space-y-4 pt-4">
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
              </div>
            ))}
          </div>
        )}

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
    const needsPop = (order.payment_method === "yoco" || order.payment_method === "eft") && 
      ["awaiting_payment", "awaiting_verification"].includes(order.payment_status) &&
      order.status === "pending";

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
              <span className="text-sm text-muted-foreground">
                {order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method === "eft" ? "EFT / Bank Transfer" : order.payment_method === "yoco" ? "Card (Yoco)" : order.payment_method}
              </span>
              <span className="font-bold text-primary">R{Number(order.total_amount).toFixed(2)}</span>
            </div>

            {/* PoP upload for unverified Yoco orders */}
            {needsPop && (
              <div className="mt-3 p-3 border border-dashed rounded-lg bg-muted/30 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <FileText className="w-4 h-4" />
                  Payment not confirmed? Upload proof of payment
                </div>
                {popOrderId === order.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Screenshot / Receipt</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setPopFile(e.target.files?.[0] || null)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-3.5 h-3.5 mr-2" />
                        {popFile ? popFile.name : "Choose file"}
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Transaction Reference</Label>
                      <Input
                        placeholder="e.g. YC-ABC123"
                        value={popRef}
                        onChange={(e) => setPopRef(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSubmitPop} disabled={isSubmittingPop} className="flex-1">
                        {isSubmittingPop ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                        Submit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setPopOrderId(null); setPopFile(null); setPopRef(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setPopOrderId(order.id)}>
                    Upload Proof of Payment
                  </Button>
                )}
              </div>
            )}

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

          {isVerifying && (
            <Card>
              <CardContent className="p-6 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-muted-foreground">Verifying your payment…</span>
              </CardContent>
            </Card>
          )}

          {verifyFailed && !isVerifying && (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300">Payment verification pending</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                      We couldn't automatically confirm your payment. Expand your order below to upload proof of payment.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
