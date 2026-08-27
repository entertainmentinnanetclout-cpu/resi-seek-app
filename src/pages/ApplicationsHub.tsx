import { useEffect } from "react";
import { BookOpenCheck, FileCheck2, GraduationCap, Landmark, LockKeyhole, School, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import AssistedApplicationPartnerCard from "@/components/applications/AssistedApplicationPartnerCard";
import ApplicationsHubLegacy from "@/pages/ApplicationsHubLegacy";
import TvetApplicationsHub from "@/pages/TvetApplicationsHub";
import MyApplicationsSummary from "@/pages/MyApplicationsSummary";

const ApplicationsHub = () => {
  const { user, session } = useAuth();
  const signedIn = Boolean(user && session);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const category = params.get("category") || "university";
  const view = params.get("view");
  const journey = params.get("journey");

  useEffect(() => {
    if (view === "mine" && !signedIn) {
      navigate(`/auth?returnTo=${encodeURIComponent("/apply?view=mine")}`, { replace: true });
      return;
    }
    if (signedIn || category === "tvet" || !journey) return;
    const intercept = (event: MouseEvent) => {
      const button = (event.target as HTMLElement)?.closest?.("button");
      if (!button) return;
      const label = (button.textContent || "").toLowerCase();
      if (label.includes("check what i qualify for")) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        navigate(`/auth?returnTo=${encodeURIComponent(`/apply?${params.toString()}`)}`);
      }
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [signedIn, category, navigate, params, view, journey]);

  if (view === "mine") return signedIn ? <MyApplicationsSummary /> : null;

  if (!journey) {
    const paths = [
      { icon: Landmark, title: "University applications", text: "Explore institutions, programmes, APS requirements and what you may qualify for.", action: () => navigate("/apply?category=university&journey=explore") },
      { icon: School, title: "TVET college applications", text: "Explore TVET study options, readiness requirements and application pathways.", action: () => navigate("/apply?category=tvet&journey=explore") },
      { icon: GraduationCap, title: "Private college applications", text: "Explore private college routes and prepare the documents you will need.", action: () => navigate("/apply?category=private_college&journey=explore") },
      { icon: BookOpenCheck, title: "Check APS & eligibility", text: "Understand your APS and use ResKonnect readiness tools before applying.", action: () => navigate("/applications/checker") },
      { icon: FileCheck2, title: "Prepare application documents", text: "Keep your profile and supporting documents ready so assisted application is faster.", action: () => navigate(signedIn ? "/documents" : "/auth?returnTo=/documents") },
    ];
    return <DashboardLayout>
      <SEO title="University & TVET Applications | ResKonnect + Tech-Up" description="Choose your study pathway, check APS and eligibility, prepare documents with ResKonnect and access assisted application support through Tech-Up." />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-violet/10 p-6 md:p-10">
          <div className="max-w-3xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-bold text-primary"><Sparkles className="h-3.5 w-3.5" />APPLICATIONS JOURNEY 2.0</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">What do you want to study or apply for?</h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">ResKonnect helps you understand requirements, APS, course options and document readiness. When you need hands-on application submission assistance, Tech-Up supports the assisted application process.</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => navigate("/apply?category=university&journey=explore")}>Explore study options</Button>{signedIn ? <Button variant="outline" onClick={() => navigate("/apply?view=mine")}>My Applications</Button> : <Button variant="outline" onClick={() => navigate("/auth?returnTo=/apply")}>Sign in / Create Account</Button>}</div></div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{paths.map((item) => <Card key={item.title} className="group cursor-pointer transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg" onClick={item.action}><CardContent className="p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><item.icon className="h-6 w-6" /></div><h2 className="mt-5 text-xl font-black">{item.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p><Button variant="link" className="mt-3 h-auto p-0">Continue →</Button></CardContent></Card>)}</div>

        <AssistedApplicationPartnerCard />
        <Card className="border-primary/20 bg-primary/[0.035]"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">Already know what you need?</p><p className="mt-1 text-sm text-muted-foreground">Create one ResKonnect account, keep your contact details and documents ready, then continue your accommodation and study journey from the same dashboard.</p></div><Button onClick={() => navigate(signedIn ? "/dashboard" : "/auth?mode=signup")}>{signedIn ? "Open Dashboard" : "Create Account"}</Button></CardContent></Card>
      </div>
    </DashboardLayout>;
  }

  if (category === "tvet") return <><AssistedApplicationPartnerCard /><TvetApplicationsHub /></>;
  return <>
    {signedIn && <div className="fixed bottom-5 right-5 z-[79]"><Button variant="outline" className="bg-background/95 shadow-lg backdrop-blur" onClick={() => navigate("/apply?view=mine")}>My Applications</Button></div>}
    {!signedIn && category !== "private" && category !== "private_college" && <div className="fixed bottom-5 left-1/2 z-[80] w-[min(92vw,620px)] -translate-x-1/2 rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LockKeyhole className="h-4 w-4" /></div><div><p className="text-sm font-bold">Sign in for personalised APS and programme results</p><p className="mt-1 text-xs text-muted-foreground">Institution browsing stays public. Personalised results are private and saved to your ResKonnect account.</p></div></div><Button size="sm" onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(`/apply?${params.toString()}`)}`)}>Sign in</Button></div></div>}
    <AssistedApplicationPartnerCard />
    <ApplicationsHubLegacy />
  </>;
};

export default ApplicationsHub;
