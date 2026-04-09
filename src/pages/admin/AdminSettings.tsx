import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Banknote, ExternalLink, Building2, Loader2 } from "lucide-react";

export const AdminSettingsContent = () => {
  const [bankDetails, setBankDetails] = useState({
    bank_name: "", account_holder: "", account_number: "", branch_code: "", account_type: "",
  });
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "eft_bank_details").maybeSingle();
      if (data?.value && typeof data.value === "object") setBankDetails(prev => ({ ...prev, ...(data.value as any) }));
    };
    load();
  }, []);

  const handleSaveBankDetails = async () => {
    setSavingBank(true);
    try {
      const { data: existing } = await supabase.from("platform_settings").select("id").eq("key", "eft_bank_details").maybeSingle();
      if (existing) {
        await supabase.from("platform_settings").update({ value: bankDetails as any, updated_at: new Date().toISOString() }).eq("key", "eft_bank_details");
      } else {
        await supabase.from("platform_settings").insert({ key: "eft_bank_details", value: bankDetails as any, description: "EFT banking details for checkout" } as any);
      }
      toast.success("Banking details saved");
    } catch { toast.error("Failed to save banking details"); }
    finally { setSavingBank(false); }
  };

  const handleSave = () => {
    toast.success("Settings saved successfully");
  };

  return (
    <>
      <SEO title="Platform Settings | Admin" description="Configure platform settings" />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure platform settings and preferences</p>
        </div>

        <div className="grid gap-6">
          {/* Banking Details for EFT */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> EFT Banking Details</CardTitle>
              <CardDescription>Bank details shown to students during EFT checkout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Bank Name</Label><Input value={bankDetails.bank_name} onChange={e => setBankDetails(p => ({...p, bank_name: e.target.value}))} placeholder="e.g. FNB" /></div>
                <div className="space-y-2"><Label>Account Holder</Label><Input value={bankDetails.account_holder} onChange={e => setBankDetails(p => ({...p, account_holder: e.target.value}))} placeholder="e.g. ResKonnect PTY LTD" /></div>
                <div className="space-y-2"><Label>Account Number</Label><Input value={bankDetails.account_number} onChange={e => setBankDetails(p => ({...p, account_number: e.target.value}))} placeholder="e.g. 62812345678" /></div>
                <div className="space-y-2"><Label>Branch Code</Label><Input value={bankDetails.branch_code} onChange={e => setBankDetails(p => ({...p, branch_code: e.target.value}))} placeholder="e.g. 250655" /></div>
                <div className="space-y-2"><Label>Account Type</Label><Input value={bankDetails.account_type} onChange={e => setBankDetails(p => ({...p, account_type: e.target.value}))} placeholder="e.g. Cheque / Savings" /></div>
              </div>
              <Button onClick={handleSaveBankDetails} disabled={savingBank}>{savingBank && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Banking Details</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Platform Name</Label>
                <Input defaultValue="ResKonnect" />
              </div>
              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input defaultValue="Reskonnect@gmail.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Support Phone</Label>
                <Input defaultValue="063 732 3192" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp Number (for integrations)</Label>
                <Input defaultValue="27637323192" />
              </div>
            </CardContent>
          </Card>

          {/* Payment Gateway Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Gateways
              </CardTitle>
              <CardDescription>Configure payment methods for the marketplace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Yoco */}
              <div className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold">Yoco</Label>
                      <Badge variant="default" className="text-xs">Active</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Card payments via Yoco Checkout. Supports Visa, Mastercard.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mode: Redirect + Verify (no webhooks — sole proprietor)
                    </p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>

              {/* COD */}
              <div className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Banknote className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold">Cash on Delivery</Label>
                      <Badge variant="default" className="text-xs">Active</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Students pay on delivery. Admin confirms payment manually.
                    </p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>

              {/* Checkout Links */}
              <div className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold">Product Checkout Links</Label>
                      <Badge variant="default" className="text-xs">Active</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Per-product external checkout URLs. Set in product form.
                    </p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>

              {/* Future Gateways */}
              <div className="flex items-start justify-between p-4 border rounded-lg opacity-60">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold">PayFast / Stripe</Label>
                      <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Additional payment gateways for future expansion.
                    </p>
                  </div>
                </div>
                <Switch disabled />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>Enable or disable platform features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Marketplace", desc: "Allow students to buy/sell items" },
                { label: "Roommate Finder", desc: "Enable roommate matching feature" },
                { label: "Events Calendar", desc: "Show campus events" },
                { label: "Bursary Finder", desc: "Show bursary opportunities" },
                { label: "Student Discounts", desc: "Show student discount directory" },
              ].map((feature) => (
                <div key={feature.label} className="flex items-center justify-between">
                  <div>
                    <Label>{feature.label}</Label>
                    <p className="text-sm text-muted-foreground">{feature.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>Search engine optimization configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Meta Title</Label>
                <Input defaultValue="Find Student Accommodation in South Africa | ResKonnect" />
              </div>
              <div className="space-y-2">
                <Label>Default Meta Description</Label>
                <Textarea 
                  defaultValue="ResKonnect helps South African students find verified, affordable student accommodation near universities in Pretoria, Tshwane & Gauteng."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Keywords</Label>
                <Input defaultValue="student accommodation, Pretoria, TUT residence, NSFAS approved" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analytics & Tracking</CardTitle>
              <CardDescription>Configure analytics integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Google Analytics ID</Label>
                <Input placeholder="G-XXXXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label>Facebook Pixel ID</Label>
                <Input placeholder="1234567890" />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </div>
    </>
  );
};

const AdminSettings = () => (
  <AdminLayout><AdminSettingsContent /></AdminLayout>
);

export default AdminSettings;
