import SEO from "@/components/SEO";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Banknote, Loader2, CheckCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

const Checkout = () => {
  const shouldBlock = useAdminRedirect();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [formData, setFormData] = useState({
    delivery_address: "",
    delivery_phone: "",
    notes: "",
  });

  if (shouldBlock) return null;

  const handleCheckout = async () => {
    if (!user) return;
    if (!formData.delivery_address || !formData.delivery_phone) {
      toast.error("Please fill in delivery address and phone number");
      return;
    }
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderNumber = `RK-${Date.now().toString(36).toUpperCase()}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("shop_orders" as any)
        .insert({
          user_id: user.id,
          order_number: orderNumber,
          status: "pending",
          payment_method: paymentMethod,
          payment_status: paymentMethod === "cod" ? "pending" : "awaiting_payment",
          total_amount: total,
          delivery_address: formData.delivery_address,
          delivery_phone: formData.delivery_phone,
          notes: formData.notes,
        } as any)
        .select("id")
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item: any) => ({
        order_id: (order as any).id,
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        store_id: item.products?.stores?.id || item.products?.store_id,
        quantity: item.quantity,
        price: Number(item.products?.price || 0),
      })).filter((oi: any) => oi.store_id);

      if (orderItems.length > 0) {
        await supabase.from("shop_order_items" as any).insert(orderItems as any);
      }

      // Create payment record
      await supabase.from("payments" as any).insert({
        order_id: (order as any).id,
        payment_method: paymentMethod,
        payment_gateway: paymentMethod === "yoco" ? "yoco" : null,
        payment_status: "pending",
        amount: total,
      } as any);

      // Create initial status history
      await supabase.from("order_status_history" as any).insert({
        order_id: (order as any).id,
        status: "pending",
        updated_by: user.id,
        note: "Order placed",
      } as any);

      // If Yoco, create checkout session and redirect
      if (paymentMethod === "yoco") {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const baseUrl = `https://${projectId}.supabase.co/functions/v1`;
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch(`${baseUrl}/yoco-checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            order_id: (order as any).id,
            success_url: `${window.location.origin}/orders`,
            cancel_url: `${window.location.origin}/checkout`,
          }),
        });

        const yocoData = await res.json();
        if (!res.ok) throw new Error(yocoData.error || "Failed to create payment session");

        // Clear cart before redirect
        await clearCart();
        window.location.href = yocoData.redirectUrl;
        return;
      }

      // COD flow
      await clearCart();
      toast.success("Order placed successfully!");
      navigate("/orders");
    } catch (error: any) {
      console.error("Checkout error:", error);
      const msg = error && typeof error === "object" && "message" in error
        ? (error as any).message
        : String(error);
      toast.error(msg || "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto text-center py-16">
            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
            <Button onClick={() => navigate("/marketplace")} className="mt-4">Browse Marketplace</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO title="Checkout | ResKonnect" description="Complete your order." />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/cart")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cart
          </Button>

          <h1 className="text-2xl sm:text-3xl font-bold">Checkout</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Delivery */}
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Delivery Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.delivery_address}
                      onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                      placeholder="Room number, residence name, campus..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={formData.delivery_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, delivery_phone: e.target.value }))}
                      placeholder="e.g., 0712345678"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Order Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Special delivery instructions..."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                    <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="flex items-center gap-3 cursor-pointer flex-1">
                        <Banknote className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">Cash on Delivery</p>
                          <p className="text-sm text-muted-foreground">Pay when your order arrives</p>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-not-allowed opacity-50">
                      <RadioGroupItem value="payfast" id="payfast" disabled />
                      <Label htmlFor="payfast" className="flex items-center gap-3 flex-1">
                        <CreditCard className="w-5 h-5" />
                        <div>
                          <p className="font-medium">PayFast</p>
                          <p className="text-sm text-muted-foreground">Coming soon</p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <div>
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="truncate flex-1 text-muted-foreground">
                        {item.products?.name} × {item.quantity}
                      </span>
                      <span>R{(Number(item.products?.price || 0) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">R{total.toFixed(2)}</span>
                  </div>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleCheckout}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      `Place Order — R${total.toFixed(2)}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Checkout;
