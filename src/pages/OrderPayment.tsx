import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Clock, Copy, Upload, Loader2, AlertTriangle, Info, ArrowLeft } from "lucide-react";

export default function OrderPayment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [eft, setEft] = useState<any>(null);
  const [bank, setBank] = useState<any>(null);
  const [countdown, setCountdown] = useState(0);
  const [popFile, setPopFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const [{ data: o }, { data: e }, { data: b }] = await Promise.all([
        supabase.from("shop_orders" as any).select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
        supabase.from("eft_payments" as any).select("*").eq("order_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "eft_bank_details").maybeSingle(),
      ]);
      setOrder(o);
      setEft(e);
      setBank(b?.value);
      setLoading(false);
    })();
  }, [user, id]);

  useEffect(() => {
    if (!eft?.expires_at) return;
    const t = setInterval(() => {
      setCountdown(Math.max(0, Math.floor((new Date(eft.expires_at).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [eft]);

  const copy = (t: string, l: string) => { navigator.clipboard.writeText(t); toast.success(`${l} copied`); };

  const generateNew = async () => {
    if (!user || !order) return;
    const reference = `RK-EFT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const expectedAmount = Number(eft?.expected_amount || order.total_amount);
    const enc = new TextEncoder().encode(`${user.id}|${expectedAmount}|${reference}|${expiresAt}`);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    const fingerprint = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data } = await supabase.from("eft_payments" as any).insert({
      order_id: order.id, user_id: user.id, payment_reference: reference,
      expected_amount: expectedAmount, unique_cents: eft?.unique_cents || 0,
      fingerprint, status: "pending", expires_at: expiresAt,
    } as any).select().single();
    setEft(data);
    toast.success("New payment session generated");
  };

  const upload = async () => {
    if (!user || !popFile || !eft || !order) return;
    setUploading(true);
    try {
      const buf = await popFile.arrayBuffer();
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      const fileHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const ext = popFile.name.split(".").pop();
      const path = `${user.id}/${order.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, popFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);
      await supabase.from("eft_payments" as any).update({
        pop_image_url: urlData.publicUrl, pop_file_hash: fileHash,
        pop_uploaded_at: new Date().toISOString(), status: "uploaded",
      } as any).eq("id", eft.id);
      await supabase.from("shop_orders" as any).update({
        payment_status: "awaiting_verification", pop_url: urlData.publicUrl,
        pop_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      } as any).eq("id", order.id);
      toast.success("Proof uploaded! Admin will verify shortly.");
      navigate("/orders");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally { setUploading(false); }
  };

  if (loading) {
    return <DashboardLayout><div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></DashboardLayout>;
  }
  if (!order || !eft) {
    return <DashboardLayout><div className="p-12 text-center space-y-3">
      <p>Payment not found.</p>
      <Button variant="outline" onClick={() => navigate("/orders")}>Back to Orders</Button>
    </div></DashboardLayout>;
  }

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const expired = countdown <= 0 && eft.status === "pending";

  return (
    <DashboardLayout>
      <SEO title="Complete Payment | ResKonnect" description="Complete your EFT payment to confirm your order." />
      <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/orders")}><ArrowLeft className="w-4 h-4 mr-2" />Back to Orders</Button>
        <div className="text-center">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">EFT Payment Instructions</h1>
          <p className="text-muted-foreground mt-1">Order #{order.order_number}</p>
        </div>

        <Card className={expired ? "border-destructive" : "border-primary"}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1"><Clock className="w-4 h-4" /><span className="text-sm font-medium">{expired ? "Payment Expired" : "Time Remaining"}</span></div>
            <p className={`text-3xl font-mono font-bold ${expired ? "text-destructive" : "text-primary"}`}>
              {expired ? "00:00" : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
            </p>
            {expired && (
              <Button size="sm" className="mt-3" onClick={generateNew}>Generate new payment session</Button>
            )}
          </CardContent>
        </Card>

        {bank ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Bank Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="font-medium">{bank.bank_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Account Holder</span><span className="font-medium">{bank.account_holder}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Account Number</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-medium">{bank.account_number}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(bank.account_number, "Account number")}><Copy className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Branch Code</span><span className="font-mono font-medium">{bank.branch_code}</span></div>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="p-4 text-center text-muted-foreground"><AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" /><p>Banking details not yet configured. Please contact admin.</p></CardContent></Card>
        )}

        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Payment Reference</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-lg font-bold text-primary">{eft.payment_reference}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(eft.payment_reference, "Reference")}><Copy className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">Exact Amount to Pay</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-2xl font-bold text-primary">R{Number(eft.expected_amount).toFixed(2)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(Number(eft.expected_amount).toFixed(2), "Amount")}><Copy className="w-3.5 h-3.5" /></Button>
              </div>
              {eft.unique_cents > 0 && (
                <p className="text-xs text-muted-foreground mt-1">Includes R{(eft.unique_cents / 100).toFixed(2)} unique identifier for faster verification</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 p-3 rounded-lg bg-muted text-sm">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">After paying, upload your proof of payment below. You can close this page and return to it any time from <strong>My Orders</strong> while it's still pending.</p>
        </div>

        {!expired && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Proof of Payment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <input type="file" accept="image/*" onChange={(e) => setPopFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
              {popFile && <p className="text-xs text-muted-foreground">Selected: {popFile.name}</p>}
              <Button className="w-full" onClick={upload} disabled={!popFile || uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Submit Proof of Payment
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}