import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Bell, ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import SEO from "@/components/SEO";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MarketplaceComingSoon = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      // Best-effort: append to a waitlist row in platform_settings
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "waitlist_marketplace")
        .maybeSingle();
      const list: string[] = Array.isArray((existing as any)?.value?.emails)
        ? (existing as any).value.emails
        : [];
      if (!list.includes(email)) list.push(email);
      await supabase
        .from("platform_settings")
        .upsert({ key: "waitlist_marketplace", value: { emails: list } }, { onConflict: "key" });
      toast.success("You're on the list — we'll notify you when we relaunch.");
      setEmail("");
    } catch (err: any) {
      toast.error("Could not save right now. Try again shortly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <SEO
        title="Marketplace — Coming Soon | ResKonnect"
        description="The ResKonnect student marketplace is temporarily paused while we focus on accommodation. Join the waitlist to be first when we relaunch."
      />
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <Card className="max-w-2xl w-full border-primary/20">
          <CardContent className="p-8 sm:p-12 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold">Marketplace is on pause</h1>
              <p className="text-muted-foreground max-w-lg mx-auto">
                We're doubling down on what matters most right now — helping students find verified accommodation across TUT, TVET colleges and beyond. The student marketplace will be back soon.
              </p>
            </div>

            <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <Input
                type="email"
                required
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={submitting} className="gap-2">
                <Bell className="h-4 w-4" />
                Notify me
              </Button>
            </form>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">In the meantime:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button asChild variant="default" className="gap-2">
                  <Link to="/find">Find accommodation <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/apply">Apply to TUT / NSFAS</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/bursaries">Browse bursaries</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MarketplaceComingSoon;