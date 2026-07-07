import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Users, CheckCircle2, Trophy, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function RecruitLanding() {
  const navigate = useNavigate();

  const steps = [
    { icon: <Users className="w-6 h-6" />, title: "1. Share your link", body: "Every recruiter gets a unique referral link and RKSR code." },
    { icon: <CheckCircle2 className="w-6 h-6" />, title: "2. Students apply", body: "Anyone who signs up and applies for accommodation is tracked to you." },
    { icon: <Trophy className="w-6 h-6" />, title: "3. Get paid", body: "Earn R200 for every verified placement, plus a R3,000 bonus for every 10." },
  ];

  return (
    <PublicLayout>
      <SEO title="Recruitment Programme | ResKonnect" description="Refer students looking for accommodation and earn cash rewards." />

      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-20 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-medium animate-fade-in">
            <Sparkles className="w-4 h-4" /> ResKonnect Recruitment Programme
          </div>
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight">
            Refer students. <span className="text-primary">Earn cash.</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Help students find verified accommodation and get rewarded.
            Earn <span className="font-bold text-foreground text-2xl mx-1">R200</span> per placement.
            Unlock <span className="font-bold text-foreground text-2xl mx-1">R3,000</span> bonus every 10 successful referrals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg hover:shadow-xl transition-all" onClick={() => navigate("/recruit/auth")}>
              Become a Recruiter <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full" onClick={() => navigate("/recruit/auth?mode=login")}>
              Sign in to Dashboard
            </Button>
          </div>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
          {steps.map((s, i) => (
            <Card key={i} className="border-none bg-secondary/50 backdrop-blur-sm hover:bg-secondary/80 transition-colors">
              <CardContent className="p-8 space-y-4">
                <div className="rounded-2xl bg-primary text-primary-foreground w-12 h-12 flex items-center justify-center shadow-lg">
                  {s.icon}
                </div>
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call to action */}
        <div className="bg-primary rounded-3xl p-8 sm:p-16 text-center text-primary-foreground space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent)]" />
          <h2 className="text-3xl sm:text-4xl font-bold relative z-10">Ready to start earning?</h2>
          <p className="text-lg opacity-90 max-w-xl mx-auto relative z-10">
            Join hundreds of recruiters nationwide and build your income while helping students find their next home.
          </p>
          <div className="relative z-10">
            <Button size="lg" variant="secondary" className="h-14 px-10 text-lg rounded-full" onClick={() => navigate("/recruit/auth")}>
              Get Started Now
            </Button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
