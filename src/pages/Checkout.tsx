import SEO from "@/components/SEO";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Banknote, Building2, Loader2, CheckCircle, Copy, Clock, Upload, AlertTriangle, Info } from "lucide-react";
import { useCart, unitPriceOf, displayOf } from "@/hooks/useCart";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";
import { TUT_CAMPUSES } from "@/lib/campuses";

// SHA256 hash helper
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate unique cents from user ID (deterministic)
function getUserUniqueCents(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash % 99) + 1; // 1-99 cents
}

const Checkout = () => {
  const shouldBlock = useAdminRedirect();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [deliveryType, setDeliveryType] = useState("campus");
  const [selectedCampus, setSelectedCampus] = useState("");
  const [selectedResidence, setSelectedResidence] = useState("");
  const [residences, setResidences] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [formData, setFormData] = useState({
    delivery_phone: "",
    notes: "",
    honeypot: "", // hidden field
  });

  // EFT state
  const [eftStep, setEftStep] = useState<"checkout" | "instructions">("checkout");
  const [eftData, setEftData] = useState<any>(null);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [countdown, setCountdown] = useState(0);
  const [popFile, setPopFile] = useState<File | null>(null);
  const [isUploadingPop, setIsUploadingPop] = useState(false);

  // Fetch residences for delivery dropdown
  useEffect(() => {
    const fetchResidences = async () => {
      const { data } = await supabase
        .from("residences")
        .select("id, name, campus")
        .order("name");
      setResidences(data || []);
    };
    fetchResidences();
  }, []);

  // Load delivery zones (admin-controlled)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("delivery_zones" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      setZones(data || []);
      if (data && data.length && !selectedZoneId) setSelectedZoneId((data[0] as any).id);
    })();
  }, []);

  // Fetch bank details
  useEffect(() => {
    const fetchBankDetails = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "eft_bank_details")
        .maybeSingle();
      if (data?.value) setBankDetails(data.value as any);
    };
    fetchBankDetails();
  }, []);

  // Countdown timer for EFT
  useEffect(() => {
    if (!eftData?.expires_at) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(eftData.expires_at).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [eftData]);

  if (shouldBlock) return null;

  const deliveryAddress = deliveryType === "campus"
    ? `TUT ${selectedCampus} Campus Drop-off`
    : residences.find((r) => r.id === selectedResidence)?.name || "";

  const selectedZone = zones.find((z: any) => z.id === selectedZoneId);
  const subtotal = total;
  const deliveryFee = (() => {
    if (!selectedZone) return 0;
    if (selectedZone.free_threshold && subtotal >= Number(selectedZone.free_threshold)) return 0;
    return Number(selectedZone.base_fee || 0);
  })();
  const grandTotal = subtotal + deliveryFee;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const handleCheckout = async () => {
    if (!user) return;
    if (!formData.delivery_phone) {
      toast.error("Please enter your phone number");
      return;
    }
    if (deliveryType === "campus" && !selectedCampus) {
      toast.error("Please select a campus for drop-off");
      return;
    }
    if (deliveryType === "residence" && !selectedResidence) {
      toast.error("Please select a residence for delivery");
      return;
    }
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    // Honeypot check
    if (formData.honeypot) {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderNumber = `RK-${Date.now().toString(36).toUpperCase()}`;
      const refCode = (typeof window !== "undefined" && localStorage.getItem("pending_ref")) || null;

      const { data: order, error: orderError } = await supabase
        .from("shop_orders" as any)
        .insert({
          user_id: user.id,
          order_number: orderNumber,
          status: "pending",
          payment_method: paymentMethod,
          payment_status: paymentMethod === "cod" ? "pending" : "awaiting_payment",
          total_amount: grandTotal,
          delivery_zone_id: selectedZoneId || null,
          delivery_fee: deliveryFee,
          referral_code: refCode,
          delivery_address: deliveryAddress,
          delivery_phone: formData.delivery_phone,
          notes: formData.notes,
        } as any)
        .select("id")
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((item: any) => {
        const d = displayOf(item);
        return {
          order_id: (order as any).id,
          item_type: item.item_type || "product",
          product_id: item.item_type === "product" || !item.item_type ? item.product_id : null,
          hamper_id: item.item_type === "hamper" ? item.hamper_id : null,
          hamper_item_id: item.item_type === "hamper_item" ? item.hamper_item_id : null,
          variant_id: item.variant_id || null,
          store_id: item.products?.stores?.id || item.products?.store_id || null,
          quantity: item.quantity,
          price: unitPriceOf(item),
          title_snapshot: d.title,
          image_snapshot: d.image || null,
        };
      });
      if (orderItems.length > 0) {
        await supabase.from("shop_order_items" as any).insert(orderItems as any);
      }

      await supabase.from("payments" as any).insert({
        order_id: (order as any).id,
        payment_method: paymentMethod,
        payment_gateway: paymentMethod === "eft" ? "eft" : null,
        payment_status: "pending",
        amount: grandTotal,
      } as any);

      await supabase.from("order_status_history" as any).insert({
        order_id: (order as any).id,
        status: "pending",
        updated_by: user.id,
        note: "Order placed",
      } as any);

      if (paymentMethod === "eft") {
        // Generate EFT payment
        const uniqueCents = getUserUniqueCents(user.id);
        const expectedAmount = grandTotal + uniqueCents / 100;
        const reference = `RK-EFT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const fingerprint = await sha256(`${user.id}|${expectedAmount}|${reference}|${expiresAt}`);

        const { error: eftError } = await supabase.from("eft_payments" as any).insert({
          order_id: (order as any).id,
          user_id: user.id,
          payment_reference: reference,
          expected_amount: expectedAmount,
          unique_cents: uniqueCents,
          fingerprint,
          status: "pending",
          expires_at: expiresAt,
          device_info: { userAgent: navigator.userAgent, language: navigator.language },
        } as any);

        if (eftError) throw eftError;

        // Log action
        await supabase.from("payment_action_logs" as any).insert({
          eft_payment_id: null,
          order_id: (order as any).id,
          actor_id: user.id,
          actor_type: "user",
          action: "eft_payment_created",
          metadata: { reference, amount: expectedAmount },
        } as any);

        await clearCart();
        // Persist payment screen as a real route so users can resume after closing the tab.
        navigate(`/orders/${(order as any).id}/pay`);
        return;
      }

      // COD flow
      await clearCart();
      try { localStorage.removeItem("pending_ref"); } catch {}
      toast.success("Order placed successfully!");
      navigate("/orders");
    } catch (error: any) {
      console.error("Checkout error:", error);
      const msg =
        error && typeof error === "object" && "message" in error
          ? (error as any).message
          : String(error);
      toast.error(msg || "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePopUpload = async () => {
    if (!user || !popFile || !eftData) return;
    setIsUploadingPop(true);
    try {
      // Hash file for duplicate detection
      const fileBuffer = await popFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
      const fileHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Upload to storage
      const ext = popFile.name.split(".").pop();
      const path = `${user.id}/${eftData.orderId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, popFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);

      // Update EFT payment
      await supabase
        .from("eft_payments" as any)
        .update({
          pop_image_url: urlData.publicUrl,
          pop_file_hash: fileHash,
          pop_uploaded_at: new Date().toISOString(),
          status: "uploaded",
        } as any)
        .eq("payment_reference", eftData.reference);

      // Update order — mirror POP onto shop_orders for admin visibility
      await supabase
        .from("shop_orders" as any)
        .update({
          payment_status: "awaiting_verification",
          pop_url: urlData.publicUrl,
          pop_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", eftData.orderId);

      // Log
      await supabase.from("payment_action_logs" as any).insert({
        order_id: eftData.orderId,
        actor_id: user.id,
        actor_type: "user",
        action: "pop_uploaded",
        metadata: { file_hash: fileHash },
      } as any);

      toast.success("Proof of payment uploaded! Admin will review shortly.");
      navigate("/orders");
    } catch (err: any) {
      const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setIsUploadingPop(false);
    }
  };

  // EFT Instructions Screen
  if (eftStep === "instructions" && eftData) {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    const isExpired = countdown <= 0;

    return (
      <DashboardLayout>
        <SEO title="EFT Payment | ResKonnect" description="Complete your EFT payment" />
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center">
              <Building2 className="w-12 h-12 text-primary mx-auto mb-3" />
              <h1 className="text-2xl font-bold">EFT Payment Instructions</h1>
              <p className="text-muted-foreground mt-1">Order #{eftData.orderNumber}</p>
            </div>

            {/* Countdown */}
            <Card className={isExpired ? "border-destructive" : "border-primary"}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {isExpired ? "Payment Expired" : "Time Remaining"}
                  </span>
                </div>
                <p className={`text-3xl font-mono font-bold ${isExpired ? "text-destructive" : "text-primary"}`}>
                  {isExpired ? "00:00" : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
                </p>
              </CardContent>
            </Card>

            {/* Bank Details */}
            {bankDetails ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Bank Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="font-medium">{bankDetails.bank_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Account Holder</span><span className="font-medium">{bankDetails.account_holder}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Account Number</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-medium">{bankDetails.account_number}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(bankDetails.account_number, "Account number")}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Branch Code</span><span className="font-mono font-medium">{bankDetails.branch_code}</span></div>
                  {bankDetails.account_type && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Account Type</span><span className="font-medium">{bankDetails.account_type}</span></div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p>Banking details not yet configured. Please contact admin.</p>
                </CardContent>
              </Card>
            )}

            {/* Reference & Amount */}
            <Card className="border-primary bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Payment Reference (use as reference when paying)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-lg font-bold text-primary">{eftData.reference}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(eftData.reference, "Reference")}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Exact Amount to Pay</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-2xl font-bold text-primary">R{eftData.expectedAmount.toFixed(2)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(eftData.expectedAmount.toFixed(2), "Amount")}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Amount includes R{(eftData.uniqueCents / 100).toFixed(2)} unique identifier for faster verification
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Info Banner */}
            <div className="flex gap-2 p-3 rounded-lg bg-muted text-sm">
              <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                After making the EFT payment, upload your proof of payment below. Admin will verify and confirm your order.
              </p>
            </div>

            {/* POP Upload */}
            {!isExpired && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Upload Proof of Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPopFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  {popFile && (
                    <p className="text-xs text-muted-foreground">Selected: {popFile.name}</p>
                  )}
                  <Button className="w-full" onClick={handlePopUpload} disabled={!popFile || isUploadingPop}>
                    {isUploadingPop ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Submit Proof of Payment
                  </Button>
                </CardContent>
              </Card>
            )}

            {isExpired && (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">This payment session has expired.</p>
                <Button variant="outline" onClick={() => navigate("/orders")}>View My Orders</Button>
              </div>
            )}

            {/* Hidden honeypot */}
            <div style={{ display: "none" }}>
              <input
                tabIndex={-1}
                autoComplete="off"
                value={formData.honeypot}
                onChange={(e) => setFormData((p) => ({ ...p, honeypot: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (items.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto text-center py-16">
            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
            <Button onClick={() => navigate("/marketplace")} className="mt-4">
              Browse Marketplace
            </Button>
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

          {/* Delivery Info Banner */}
          <div className="flex gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              We deliver to <strong>TUT Campus Drop-offs</strong> and <strong>Listed Residences</strong> only.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Delivery */}
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Delivery Type</Label>
                    <Select value={deliveryType} onValueChange={(v) => { setDeliveryType(v); setSelectedCampus(""); setSelectedResidence(""); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="campus">TUT Campus Drop-off</SelectItem>
                        <SelectItem value="residence">Residence Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {deliveryType === "campus" && (
                    <div className="space-y-2">
                      <Label>Select Campus *</Label>
                      <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                        <SelectTrigger><SelectValue placeholder="Choose campus..." /></SelectTrigger>
                        <SelectContent>
                          {TUT_CAMPUSES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {deliveryType === "residence" && (
                    <div className="space-y-2">
                      <Label>Select Residence *</Label>
                      <Select value={selectedResidence} onValueChange={setSelectedResidence}>
                        <SelectTrigger><SelectValue placeholder="Choose residence..." /></SelectTrigger>
                        <SelectContent>
                          {residences.map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name} {r.campus ? `(${r.campus})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={formData.delivery_phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, delivery_phone: e.target.value }))}
                      placeholder="e.g. 063 732 3192"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Order Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Special delivery instructions..."
                    />
                  </div>

                  {/* Hidden honeypot */}
                  <div style={{ display: "none" }}>
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={formData.honeypot}
                      onChange={(e) => setFormData((p) => ({ ...p, honeypot: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Zone (admin-controlled) */}
              {zones.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Delivery Option & Fees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup value={selectedZoneId} onValueChange={setSelectedZoneId}>
                      {zones.map((z: any) => {
                        const isFree = z.free_threshold && subtotal >= Number(z.free_threshold);
                        const fee = isFree ? 0 : Number(z.base_fee || 0);
                        return (
                          <div key={z.id} className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                            <RadioGroupItem value={z.id} id={`zone-${z.id}`} className="mt-1" />
                            <Label htmlFor={`zone-${z.id}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium">{z.name}</p>
                                <span className="text-sm font-semibold text-primary">
                                  {fee === 0 ? "Free" : `R${fee.toFixed(2)}`}
                                </span>
                              </div>
                              {z.description && <p className="text-xs text-muted-foreground mt-1">{z.description}</p>}
                              {z.free_threshold && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Free over R{Number(z.free_threshold).toFixed(2)}
                                </p>
                              )}
                              {z.conditions && (
                                <p className="text-xs text-muted-foreground mt-1 italic">{z.conditions}</p>
                              )}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </CardContent>
                </Card>
              )}

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
                    <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="eft" id="eft" />
                      <Label htmlFor="eft" className="flex items-center gap-3 cursor-pointer flex-1">
                        <Building2 className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">EFT / Bank Transfer</p>
                          <p className="text-sm text-muted-foreground">Pay via bank transfer with unique reference</p>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-4 border rounded-lg opacity-50 cursor-not-allowed">
                      <RadioGroupItem value="yoco" id="yoco" disabled />
                      <Label htmlFor="yoco" className="flex items-center gap-3 flex-1">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-muted-foreground">Pay with Card (Yoco)</p>
                          <p className="text-sm text-muted-foreground">Visa, Mastercard — secure checkout</p>
                        </div>
                        <Badge variant="outline" className="ml-auto text-xs">Coming Soon</Badge>
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
                        {displayOf(item).title} × {item.quantity}
                      </span>
                      <span>R{(unitPriceOf(item) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>R{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery {selectedZone?.name ? `· ${selectedZone.name}` : ""}</span>
                    <span>{deliveryFee === 0 ? "Free" : `R${deliveryFee.toFixed(2)}`}</span>
                  </div>
                  {paymentMethod === "eft" && user && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Unique identifier</span>
                      <span>+R{(getUserUniqueCents(user.id) / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">
                      R{paymentMethod === "eft" && user
                        ? (grandTotal + getUserUniqueCents(user.id) / 100).toFixed(2)
                        : grandTotal.toFixed(2)}
                    </span>
                  </div>
                  <Button size="lg" className="w-full" onClick={handleCheckout} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      `Place Order — R${paymentMethod === "eft" && user
                        ? (grandTotal + getUserUniqueCents(user.id) / 100).toFixed(2)
                        : grandTotal.toFixed(2)}`
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
