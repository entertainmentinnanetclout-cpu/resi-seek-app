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
import { Copy, Share2, Users, DollarSign, Loader2, Gift } from "lucide-react";

export default function Referrals() {
  const { user } = useAuth();
  const [code, setCode] = useState<any>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupBonus, setSignupBonus] = useState(10);
  const [salePct, setSalePct] = useState(5);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: codeData } = await supabase.rpc("get_or_create_referral_code" as any);
      setCode(codeData);
      const { data: e } = await supabase.from("referral_earnings" as any).select("*").eq("referrer_user_id", user.id).order("created_at", { ascending: false });
      setEarnings(e || []);
      const { data: s } = await supabase.from("platform_settings").select("key,value").in("key", ["referral_signup_bonus","referral_sale_percentage"]);
      s?.forEach((r: any) => {
        if (r.key === "referral_signup_bonus") setSignupBonus(Number(r.value) || 10);
        if (r.key === "referral_sale_percentage") setSalePct(Number(r.value) || 5);
      });
      setLoading(false);
    })();
  }, [user]);

  const link = code ? `${window.location.origin}/auth?ref=${code.code}` : "";
  const totalAvailable = earnings.filter((e) => e.status === "available").reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid = earnings.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.amount), 0);

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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center"><Users className="w-5 h-5 mx-auto text-primary" /><p className="text-2xl font-bold mt-1">{code?.signup_count || 0}</p><p className="text-xs text-muted-foreground">Signups</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><DollarSign className="w-5 h-5 mx-auto text-green-600" /><p className="text-2xl font-bold mt-1">{code?.sale_count || 0}</p><p className="text-xs text-muted-foreground">Sales</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">R{totalAvailable.toFixed(2)}</p><p className="text-xs text-muted-foreground">Available</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">R{totalPaid.toFixed(2)}</p><p className="text-xs text-muted-foreground">Paid out</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Earnings history</CardTitle></CardHeader>
          <CardContent>
            {earnings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No earnings yet. Share your code to start earning.</p>
            ) : (
              <div className="space-y-2">
                {earnings.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-medium capitalize">{e.source_type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">R{Number(e.amount).toFixed(2)}</p>
                      <Badge variant={e.status === "paid" ? "default" : "secondary"}>{e.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}