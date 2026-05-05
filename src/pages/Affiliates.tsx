import { Link } from "react-router-dom";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, DollarSign, Users, Share2, CheckCircle } from "lucide-react";

export default function Affiliates() {
  return (
    <PublicLayout>
      <SEO title="Affiliate Program | ResKonnect" description="Earn cash by referring fellow students to ResKonnect — signup bonuses + sale commissions." />
      <div className="container mx-auto px-4 py-12 max-w-5xl space-y-12">
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Gift className="w-4 h-4" /> ResKonnect Affiliate Program
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">Refer fellow students. Earn real cash.</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get paid for every signup and every sale your network makes on ResKonnect.
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <Button size="lg" asChild><Link to="/auth?returnTo=/referrals">Join & Get Your Link</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/marketplace">Browse Marketplace</Link></Button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Users, title: "R10 per signup", desc: "Earn a flat bonus every time someone joins ResKonnect with your code." },
            { icon: DollarSign, title: "5% per sale", desc: "Earn 5% of every product, hamper or item your referrals buy." },
            { icon: Share2, title: "Per-product links", desc: "Generate unique affiliate links for any product on the marketplace." },
          ].map((b) => (
            <Card key={b.title}>
              <CardContent className="p-6">
                <b.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-bold text-lg">{b.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-center">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              "Sign up and grab your unique referral code from the dashboard.",
              "Share your link or per-product link via WhatsApp, TikTok, status — anywhere.",
              "Earn instantly. Track signups, sales and payouts in your Earnings dashboard.",
            ].map((s, i) => (
              <Card key={i}><CardContent className="p-6 flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">{i + 1}</div>
                <p className="text-sm">{s}</p>
              </CardContent></Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-center">FAQ</h2>
          {[
            { q: "Who can join?", a: "Any registered ResKonnect student." },
            { q: "When do I get paid?", a: "Earnings move to 'available' once verified, and are paid out on request." },
            { q: "Are there limits?", a: "No cap on signups or sales — refer as many people as you like." },
          ].map((f) => (
            <Card key={f.q}><CardContent className="p-4">
              <p className="font-semibold flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" />{f.q}</p>
              <p className="text-sm text-muted-foreground mt-1 ml-6">{f.a}</p>
            </CardContent></Card>
          ))}
        </section>

        <section className="text-center py-8">
          <Button size="lg" asChild><Link to="/auth?returnTo=/referrals">Start Earning Today</Link></Button>
        </section>
      </div>
    </PublicLayout>
  );
}