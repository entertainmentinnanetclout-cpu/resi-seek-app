import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Clock3, ExternalLink, FileText, ImagePlus, Inbox, Mail, MapPin, RefreshCw, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getResidenceApplicationRef, getResidenceApplicationStatusLabel } from "@/lib/residenceApplications";
import SEO from "@/components/SEO";
import ResidenceSupplyReadiness from "@/components/residence/ResidenceSupplyReadiness";
import type { ResidencePortalContext } from "./ResidenceLayout";

interface Stats {
  total: number;
  new: number;
  docsRequired: number;
  underReview: number;
  approved: number;
  closed: number;
  nsfas: number;
  reservations2027: number;
}

interface RecentApplication {
  id: string;
  status: string;
  funding_type: string | null;
  created_at: string | null;
  user_id: string;
  full_name: string | null;
}

const ResidenceDashboard = () => {
  const navigate = useNavigate();
  const { residence } = useOutletContext<ResidencePortalContext>();
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, docsRequired: 0, underReview: 0, approved: 0, closed: 0, nsfas: 0, reservations2027: 0 });
  const [recent, setRecent] = useState<RecentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!residence?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const [appsRes, reservationsRes] = await Promise.all([
        supabase.from("applications").select("id, status, funding_type, created_at, user_id").eq("residence_id", residence.id).order("created_at", { ascending: false }),
        (supabase as any).rpc("get_residence_portal_reservations", { p_residence_id: residence.id, p_year: 2027 }),
      ]);
      if (appsRes.error) throw appsRes.error;

      const applications = appsRes.data || [];
      const reservations = reservationsRes.error ? [] : (reservationsRes.data || []);
      setStats({
        total: applications.length,
        new: applications.filter((app) => app.status === "submitted").length,
        docsRequired: applications.filter((app) => app.status === "documents_required").length,
        underReview: applications.filter((app) => app.status === "under_review").length,
        approved: applications.filter((app) => ["conditionally_approved", "approved"].includes(app.status || "")).length,
        closed: applications.filter((app) => ["rejected", "withdrawn"].includes(app.status || "")).length,
        nsfas: applications.filter((app) => app.funding_type === "nsfas").length,
        reservations2027: reservations.filter((row: any) => row.status !== "cancelled").length,
      });

      const recentRows = applications.slice(0, 6);
      const userIds = Array.from(new Set(recentRows.map((app) => app.user_id).filter(Boolean))) as string[];
      let profileMap = new Map<string, string | null>();
      if (userIds.length) {
        const { data: profiles, error: profileError } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        if (profileError) throw profileError;
        profileMap = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));
      }
      setRecent(recentRows.map((app) => ({ ...app, user_id: app.user_id as string, full_name: profileMap.get(app.user_id as string) || null })));
    } catch (err) {
      console.error("Residence dashboard load failed:", err);
      setError("Applications or reservation intelligence could not be loaded. Your portal access is still active; please retry.");
    } finally {
      setIsLoading(false);
    }
  }, [residence?.id]);

  useEffect(() => {
    if (!residence?.id) return;
    void load();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 120_000);
    const channel = supabase.channel(`residence-dashboard-apps-${residence.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `residence_id=eq.${residence.id}` }, () => void load())
      .subscribe();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); void supabase.removeChannel(channel); };
  }, [residence?.id, load]);

  if (!residence) return <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Loading your residence...</div>;

  const needsAttention = stats.new + stats.docsRequired;
  const statCards = [
    { label: "2027 reservations", value: stats.reservations2027, icon: CalendarDays, target: "/residence/reservations-2027", note: "Current reservation interest" },
    { label: "All applications", value: stats.total, icon: Inbox, target: "/residence/inbox", note: "For this residence" },
    { label: "New", value: stats.new, icon: AlertCircle, target: "/residence/inbox?status=new", note: "Ready to review" },
    { label: "Needs documents", value: stats.docsRequired, icon: FileText, target: "/residence/inbox?status=documents_required", note: "Waiting on applicant" },
    { label: "Under review", value: stats.underReview, icon: Clock3, target: "/residence/inbox?status=under_review", note: "In progress" },
    { label: "Approved", value: stats.approved, icon: CheckCircle2, target: "/residence/inbox?status=approved", note: "Conditional + final" },
    { label: "NSFAS", value: stats.nsfas, icon: FileText, target: "/residence/inbox?funding=nsfas", note: "Funding type" },
  ];

  return (
    <>
      <SEO noIndex title={`${residence.name} Residence Portal | ResKonnect`} description={`Manage accommodation applications and 2027 reservations for ${residence.name}.`} />
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rk-skeuo-frame relative isolate overflow-hidden rounded-[26px] bg-[linear-gradient(125deg,#182d4b,#123d64)] text-white shadow-[0_22px_52px_rgba(8,28,49,.18)]">
          {residence.cover_image_url||residence.image_url?<img src={residence.cover_image_url||residence.image_url||""} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30"/>:null}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1e37]/95 via-[#0b1e37]/85 to-[#0b1e37]/30"/>
          <div className="relative z-10 flex flex-col gap-4 p-6 sm:p-8 lg:p-10">
           <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#f1c08b]"><Sparkles className="h-4 w-4"/>ResKonnect Property OS</p>
           <div className="max-w-xl"><h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">Your property. <span className="text-[#f3c18d]">Everything connected.</span></h1>
           <p className="mt-3 text-sm leading-6 text-white/80">See your student enquiries, review applications, manage inventory and shape how {residence.name} appears to students — from one workspace.</p></div>
           <div className="flex flex-wrap gap-2">
            <Button onClick={()=>navigate("/residence/inbox?status=new")} className="rk-clay-action"><Inbox className="mr-2 h-4 w-4"/>Review applications</Button>
            <Button onClick={()=>navigate("/residence/listing/wizard")} className="border border-white/25 bg-white/10 text-white hover:bg-white/20"><ImagePlus className="mr-2 h-4 w-4"/>Improve listing</Button>
            <Button asChild className="border border-white/25 bg-white/10 text-white hover:bg-white/20"><a href={`/find-my-res/${residence.id}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4"/>Public view</a></Button>
           </div>
          </div>
        </section>
        <div className="rk-stagger-list grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
           {label:"Applications",detail:"Review student documents and decisions",to:"/residence/inbox",icon:Inbox},
           {label:"Reservations",detail:"Manage the 2027 interest pipeline",to:"/residence/reservations-2027",icon:CalendarDays},
           {label:"Listing studio",detail:"Edit photos, room options and profile",to:"/residence/listing/wizard",icon:ImagePlus},
           {label:"Communications",detail:"Reach applicants from the email desk",to:"/residence/communications",icon:Mail},
          ].map(item=><button type="button" key={item.label} onClick={()=>navigate(item.to)}
           className="rk-neo-panel rk-motion-card flex items-start gap-3 rounded-[18px] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#aebfd0] hover:shadow-md">
           <span className="rounded-xl bg-[#f8ecde] p-2.5 text-[#a56d35]"><item.icon className="h-5 w-5"/></span>
           <span className="min-w-0"><span className="block text-sm font-black">{item.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span></span>
           <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted-foreground"/>
          </button>)}
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><p className="text-sm font-semibold text-primary">ResKonnect Property OS</p><h1 className="mt-1 text-3xl font-black tracking-tight">{residence.name}</h1><p className="mt-2 text-sm text-muted-foreground">Manage applications, funding mix and 2027 reservation demand for this accommodation.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh</Button><Button variant="outline" onClick={() => navigate("/residence/reservations-2027")}><CalendarDays className="mr-2 h-4 w-4" /> 2027 Reservations</Button><Button onClick={() => navigate("/residence/inbox?status=new")}><Inbox className="mr-2 h-4 w-4" /> Review applications{needsAttention > 0 ? ` (${needsAttention})` : ""}</Button></div>
        </div>

        <ResidenceSupplyReadiness residenceId={residence.id} />

        {stats.reservations2027 > 0 && !error && <Card className="border-[#F5B32F]/35 bg-gradient-to-r from-[#071326] via-[#0c1c34] to-[#12386a] text-white"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-black"><CalendarDays className="h-4 w-4 text-[#F5B32F]" /> 2027 reservation demand is live</div><p className="mt-1 text-sm text-white/70">{stats.reservations2027} active reservation{stats.reservations2027 === 1 ? "" : "s"} currently recorded for {residence.name}. Use this demand to plan rooms, pricing and follow-up.</p></div><Button className="bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]/90" onClick={() => navigate("/residence/reservations-2027")}>Open 2027 intake <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card>}

        {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button></CardContent></Card>}

        <div className="rk-stagger-list grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statCards.map((item) => <Card key={item.label} role="button" tabIndex={0} aria-label={`${item.label}: ${isLoading?"loading":item.value}. Open detail`} className="rk-neo-stat rk-motion-card cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md" onClick={() => navigate(item.target)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();navigate(item.target);}}}><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">{item.label}</p><p className="mt-2 text-3xl font-black">{isLoading ? "—" : item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.note}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><item.icon className="h-5 w-5" /></div></div></CardContent></Card>)}</div>

        <Card><CardHeader className="flex flex-row items-center justify-between gap-4"><div><CardTitle>Recent applications</CardTitle><CardDescription>Newest submissions for {residence.name}</CardDescription></div><Button variant="outline" size="sm" onClick={() => navigate("/residence/inbox")}>View all <ArrowRight className="ml-2 h-4 w-4" /></Button></CardHeader><CardContent>{isLoading ? <div className="py-10 text-center text-sm text-muted-foreground">Loading applications...</div> : recent.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><Inbox className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold">No applications yet</p><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">When a student applies to this residence, their application will appear here automatically.</p></div> : <div className="divide-y">{recent.map((app) => <button key={app.id} type="button" onClick={() => navigate(`/residence/application/${app.id}`)} className="flex w-full items-center gap-3 px-1 py-4 text-left transition hover:bg-muted/40 sm:px-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{app.full_name || "Applicant"}</p><p className="mt-0.5 text-xs text-muted-foreground">Ref {getResidenceApplicationRef(app.id)} · {app.created_at ? new Date(app.created_at).toLocaleDateString("en-ZA") : "Date unavailable"}</p></div>{app.funding_type && <Badge variant="outline" className="hidden uppercase sm:inline-flex">{app.funding_type}</Badge>}<Badge variant={app.status === "rejected" ? "destructive" : app.status === "approved" ? "default" : "secondary"}>{getResidenceApplicationStatusLabel(app.status)}</Badge></button>)}</div>}</CardContent></Card>
      </div>
    </>
  );
};

export default ResidenceDashboard;
