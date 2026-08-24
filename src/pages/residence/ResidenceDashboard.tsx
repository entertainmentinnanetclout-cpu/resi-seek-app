import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileText, Inbox, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getResidenceApplicationRef, getResidenceApplicationStatusLabel } from "@/lib/residenceApplications";
import SEO from "@/components/SEO";
import type { ResidencePortalContext } from "./ResidenceLayout";

interface Stats {
  total: number;
  new: number;
  docsRequired: number;
  underReview: number;
  approved: number;
  closed: number;
  nsfas: number;
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
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, docsRequired: 0, underReview: 0, approved: 0, closed: 0, nsfas: 0 });
  const [recent, setRecent] = useState<RecentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!residence?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: appsError } = await supabase
        .from("applications")
        .select("id, status, funding_type, created_at, user_id")
        .eq("residence_id", residence.id)
        .order("created_at", { ascending: false });
      if (appsError) throw appsError;

      const applications = data || [];
      setStats({
        total: applications.length,
        new: applications.filter((app) => app.status === "submitted").length,
        docsRequired: applications.filter((app) => app.status === "documents_required").length,
        underReview: applications.filter((app) => app.status === "under_review").length,
        approved: applications.filter((app) => ["conditionally_approved", "approved"].includes(app.status || "")).length,
        closed: applications.filter((app) => ["rejected", "withdrawn"].includes(app.status || "")).length,
        nsfas: applications.filter((app) => app.funding_type === "nsfas").length,
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
      setError("Applications could not be loaded. Your portal access is still active; please retry.");
    } finally {
      setIsLoading(false);
    }
  }, [residence?.id]);

  useEffect(() => {
    if (!residence?.id) return;
    void load();

    const channel = supabase
      .channel(`residence-dashboard-${residence.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `residence_id=eq.${residence.id}` }, () => void load())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [residence?.id, load]);

  if (!residence) {
    return <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Loading your residence...</div>;
  }

  const needsAttention = stats.new + stats.docsRequired;
  const statCards = [
    { label: "All applications", value: stats.total, icon: Inbox, target: "/residence/inbox", note: "For this residence" },
    { label: "New", value: stats.new, icon: AlertCircle, target: "/residence/inbox?status=new", note: "Ready to review" },
    { label: "Needs documents", value: stats.docsRequired, icon: FileText, target: "/residence/inbox?status=documents_required", note: "Waiting on applicant" },
    { label: "Under review", value: stats.underReview, icon: Clock3, target: "/residence/inbox?status=under_review", note: "In progress" },
    { label: "Approved", value: stats.approved, icon: CheckCircle2, target: "/residence/inbox?status=approved", note: "Conditional + final" },
    { label: "NSFAS", value: stats.nsfas, icon: FileText, target: "/residence/inbox?funding=nsfas", note: "Funding type" },
  ];

  return (
    <>
      <SEO noIndex title={`${residence.name} Residence Portal | ResKonnect`} description={`Manage accommodation applications for ${residence.name}.`} />
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Residence administration</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">{residence.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Everything here is scoped to applications submitted to this accommodation.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh</Button>
            <Button onClick={() => navigate("/residence/inbox?status=new")}><Inbox className="mr-2 h-4 w-4" /> Review applications{needsAttention > 0 ? ` (${needsAttention})` : ""}</Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button></CardContent></Card>
        )}

        {needsAttention > 0 && !error && (
          <Card className="border-primary/20 bg-primary/[0.045]">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><AlertCircle className="h-5 w-5" /></div><div><p className="font-bold">{needsAttention} application{needsAttention === 1 ? "" : "s"} need attention</p><p className="mt-1 text-sm text-muted-foreground">Open new applications first, then follow up on missing documents.</p></div></div>
              <Button onClick={() => navigate("/residence/inbox?status=new")} className="shrink-0">Start reviewing <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statCards.map((item) => (
            <Card key={item.label} className="cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md" onClick={() => navigate(item.target)}>
              <CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">{item.label}</p><p className="mt-2 text-3xl font-black">{isLoading ? "—" : item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.note}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><item.icon className="h-5 w-5" /></div></div></CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div><CardTitle>Recent applications</CardTitle><CardDescription>Newest submissions for {residence.name}</CardDescription></div>
            <Button variant="outline" size="sm" onClick={() => navigate("/residence/inbox")}>View all <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading applications...</div>
            ) : recent.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center"><Inbox className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold">No applications yet</p><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">When a student applies to this residence, their application will appear here automatically.</p></div>
            ) : (
              <div className="divide-y">
                {recent.map((app) => (
                  <button key={app.id} type="button" onClick={() => navigate(`/residence/application/${app.id}`)} className="flex w-full items-center gap-3 px-1 py-4 text-left transition hover:bg-muted/40 sm:px-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{app.full_name || "Applicant"}</p><p className="mt-0.5 text-xs text-muted-foreground">Ref {getResidenceApplicationRef(app.id)} · {app.created_at ? new Date(app.created_at).toLocaleDateString("en-ZA") : "Date unavailable"}</p></div>
                    {app.funding_type && <Badge variant="outline" className="hidden uppercase sm:inline-flex">{app.funding_type}</Badge>}
                    <Badge variant={app.status === "rejected" ? "destructive" : app.status === "approved" ? "default" : "secondary"}>{getResidenceApplicationStatusLabel(app.status)}</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ResidenceDashboard;
