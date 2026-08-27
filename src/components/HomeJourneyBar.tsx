import { Building2, CalendarDays, FileCheck2, Search, Target, UserRoundPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const journeys = [
  { icon: Search, label: "Find Accommodation", path: "/find", primary: true },
  { icon: CalendarDays, label: "Reserve for 2027", path: "/find?reserve=2027" },
  { icon: FileCheck2, label: "Start an Application", path: "/apply" },
  { icon: Target, label: "Tell Us What You Need", path: "/accommodation-request" },
];

const HomeJourneyBar = () => {
  const navigate = useNavigate();
  return (
    <section className="border-b bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Start here</p><h2 className="text-lg font-black sm:text-xl">What do you need today?</h2></div>
          <p className="text-xs text-muted-foreground">New or returning — choose a task and ResKonnect takes you to the right flow.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {journeys.map((item) => (
            <Button key={item.path} variant={item.primary ? "default" : "outline"} className="h-auto min-h-14 justify-start gap-2 whitespace-normal px-3 py-3 text-left" onClick={() => navigate(item.path)}>
              <item.icon className="h-4 w-4 shrink-0" /><span className="text-xs font-bold sm:text-sm">{item.label}</span>
            </Button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <button type="button" onClick={() => navigate("/auth")} className="inline-flex items-center gap-1.5 font-semibold hover:text-primary"><UserRoundPlus className="h-3.5 w-3.5" />Sign in / Create Account</button>
          <button type="button" onClick={() => navigate("/residence/login")} className="inline-flex items-center gap-1.5 font-semibold hover:text-primary"><Building2 className="h-3.5 w-3.5" />Landlord Portal</button>
          <button type="button" onClick={() => navigate("/creator-partners")} className="font-semibold hover:text-primary">Creator Partner Programme</button>
        </div>
      </div>
    </section>
  );
};

export default HomeJourneyBar;
