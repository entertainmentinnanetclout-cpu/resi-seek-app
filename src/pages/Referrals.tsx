import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Share2, Users, DollarSign, Loader2, Gift, Link as LinkIcon, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Referrals() {
  const { user } = useAuth();
  const [code, setCode] = useState<any>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupBonus, setSignupBonus] = useState(10);
  const [salePct, setSalePct] = useState(5);

  // Affiliate link generator state
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get-or-create referral code inline (no RPC dependency).
      let { data: codeData } = await supabase
        .from("referral_codes" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!codeData) {
        const newCode = `RK${user.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
        const { data: created } = await supabase
          .from("referral_codes" as any)
          .insert({ user_id: user.id, code: newCode, is_active: true } as any)
          .select("*")
          .single();
        codeData = created;
      }
      setCode(codeData);
      const { data: e } = await supabase.from("referral_earnings" as any).select("*").eq("referrer_user_id", user.id).order("created_at", { ascending: false });
      setEarnings(e || []);
      const { data: s } = await supabase.from("platform_settings").select("key,value").in("key", ["referral_signup_bonus","referral_sale_percent"]);
      s?.forEach((r: any) => {
        const v: any = r.value;
        if (r.key === "referral_signup_bonus") setSignupBonus(Number(v?.amount ?? v) || 10);
        if (r.key === "referral_sale_percent") setSalePct(Number(v?.percent ?? v) || 5);
      });

      // Fetch products for link generator
      const { data: p } = await supabase.from("products").select("id, name").eq("is_active", true).limit(50);
      setProducts(p || []);

      setLoading(false);
    })();
  }, [user]);

  const link = code ? `${window.location.origin}/auth?ref=${code.code}` : "";
  const totalAvailable = earnings.filter((e) => e.status === "available" || e.status === "confirmed").reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid = earnings.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.amount), 0);
  const signupEarnings = earnings.filter((e) => e.source_type === 'signup' && (e.status === 'available' || e.status === 'confirmed')).reduce((s, e) => s + Number(e.amount), 0);

  const productAffiliateLink = selectedProduct && code
    ? `${window.location.origin}/product/${selectedProduct.id}?ref=${code.code}`
    : "";

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied"); };
  const share = async () => {
    const text = `Join ResKonnect with my code ${code?.code} — find verified student accommodation, deals & more. ${link}`;
    if (navigator.share) { try { await navigator.share({ title: "ResKonnect", text, url: link }); } catch {} }
    else { copy(text); }
  };

  if (loading) return <DashboardLayout><div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <SEO title="Referrals & Earnings | ResKonnect" description="Earn cash by inviting students to ResKonnect." />
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Gift className="w-7 h-7 text-primary" />Refer & Earn</h1>
          <p className="text-muted-foreground">Earn R{signupBonus} per new signup and {salePct}% of every sale they make.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Your referral code</CardTitle><CardDescription>Share this link or code with fellow students.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={code?.code || ""} readOnly className="font-mono text-lg uppercase tracking-widest" />
                <Button variant="outline" onClick={() => copy(code?.code || "")}><Copy className="w-4 h-4" /></Button>
              </div>
              <div className="flex gap-2">
                <Input value={link} readOnly />
                <Button variant="outline" onClick={() => copy(link)}><Copy className="w-4 h-4" /></Button>
                <Button onClick={share}><Share2 className="w-4 h-4 mr-2" />Share</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signup Credits</CardTitle>
              <CardDescription>Rewards for successful student referrals.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">R{signupEarnings.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">available credit</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Credits are earned when students sign up using your link.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LinkIcon className="w-5 h-5" /> Product Affiliate Links</CardTitle>
            <CardDescription>Generate a direct link to a specific product with your referral code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={productSearchOpen} className="w-full sm:w-[300px] justify-between">
                    {selectedProduct ? selectedProduct.name : "Select a product..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search products..." />
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {products.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => {
                            setSelectedProduct(p);
                            setProductSearchOpen(false);
                          }}
                        >
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>

              {productAffiliateLink && (
                <div className="flex-1 flex gap-2">
                  <Input value={productAffiliateLink} readOnly />
                  <Button variant="outline" onClick={() => copy(productAffiliateLink)}><Copy className="w-4 h-4" /></Button>
                </div>
              )}
            </div>
            {selectedProduct && (
              <p className="text-xs text-muted-foreground italic">
                Users clicking this link will carry your referral through to checkout.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center"><Users className="w-5 h-5 mx-auto text-primary" /><p className="text-2xl font-bold mt-1">{code?.signup_count || 0}</p><p className="text-xs text-muted-foreground">Signups</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><DollarSign className="w-5 h-5 mx-auto text-green-600" /><p className="text-2xl font-bold mt-1">{code?.sale_count || 0}</p><p className="text-xs text-muted-foreground">Sales</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">R{totalAvailable.toFixed(2)}</p><p className="text-xs text-muted-foreground">Available</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">R{totalPaid.toFixed(2)}</p><p className="text-xs text-muted-foreground">Paid out</p></CardContent></Card>
        </div>

        <Tabs defaultValue="ledger" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ledger">Referral Ledger</TabsTrigger>
            <TabsTrigger value="signups">Signup Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger">
            <Card>
              <CardHeader>
                <CardTitle>Commission History</CardTitle>
                <CardDescription>Direct earnings from referred sales.</CardDescription>
              </CardHeader>
              <CardContent>
                {earnings.filter(e => e.source_type === 'sale').length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No sale commissions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {earnings.filter(e => e.source_type === 'sale').map((e) => (
                      <div key={e.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <p className="font-medium">Sale Commission</p>
                          <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">R{Number(e.amount).toFixed(2)}</p>
                          <Badge variant={e.status === "paid" ? "default" : e.status === "available" || e.status === "confirmed" ? "secondary" : "outline"}>
                            {e.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signups">
            <Card>
              <CardHeader>
                <CardTitle>Signup Activity</CardTitle>
                <CardDescription>History of student signups using your link.</CardDescription>
              </CardHeader>
              <CardContent>
                {earnings.filter(e => e.source_type === 'signup').length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No signups yet.</p>
                ) : (
                  <div className="space-y-2">
                    {earnings.filter(e => e.source_type === 'signup').map((e) => (
                      <div key={e.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <p className="font-medium text-sm">New Student Referral</p>
                          <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">R{Number(e.amount).toFixed(2)}</p>
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {e.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}