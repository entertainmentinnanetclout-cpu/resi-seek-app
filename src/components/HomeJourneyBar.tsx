import { BrainCircuit, BriefcaseBusiness, Building2, Home, LayoutDashboard, Sparkles, UserRoundPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const journeys = [
  { icon: Home, label: "Living", path: "/living", primary: true },
  { icon: BrainCircuit, label: "Ask ResKonnect AI", path: "/ai" },
  { icon: BriefcaseBusiness, label: "Opportunity", path: "/opportunities" },
  { icon: Sparkles, label: "Get Started", path: "/get-started" },
];

const HomeJourneyBar = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  return (
    <section className="border-b bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Start here</p><h2 className="text-lg font-black sm:text-xl">What do you need today?</h2></div>
          <p className="text-xs text-muted-foreground">Choose a pillar or tell ResKonnect what you need — one account connects the journey.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {journeys.map((item) => (
            <Button key={item.path} variant={item.primary ? "default" : "outline"} className="h-auto min-h-14 justify-start gap-2 whitespace-normal px-3 py-3 text-left" onClick={() => navigate(item.path)}>
              <item.icon className="h-4 w-4 shrink-0" /><span className="text-xs font-bold sm:text-sm">{item.label}</span>
            </Button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {authLoading ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">Checking account…</span>
          ) : user ? (
            <button type="button" onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80"><LayoutDashboard className="h-3.5 w-3.5" />My ResKonnect</button>
          ) : (
            <button type="button" onClick={() => navigate("/auth")} className="inline-flex items-center gap-1.5 font-semibold hover:text-primary"><UserRoundPlus className="h-3.5 w-3.5" />Sign in / Create Account</button>
          )}
          <button type="button" onClick={() => navigate("/residence/login")} className="inline-flex items-center gap-1.5 font-semibold hover:text-primary"><Building2 className="h-3.5 w-3.5" />Landlord Portal</button>
          <button type="button" onClick={() => navigate("/creator-partners")} className="font-semibold hover:text-primary">Creator Partner Programme</button>
        </div>
      </div>
    </section>
  );
};

export default HomeJourneyBar;
