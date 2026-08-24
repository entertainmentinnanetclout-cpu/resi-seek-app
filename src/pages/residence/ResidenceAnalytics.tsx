import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, FileText, Inbox, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getResidenceApplicationStatusLabel, RESIDENCE_APPLICATION_STATUS_META } from "@/lib/residenceApplications";
import SEO from "@/components/SEO";
import type { ResidencePortalContext } from "./ResidenceLayout";

interface AnalyticsRow {
  status: string;
  funding_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const ResidenceAnalytics = () => {
  const navigate = useNavigate();
  const { residence } = useOutletContext<ResidencePortalContext>();
  const [applications, setApplications] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!residence?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from("applications")
        .select("status, funding_type, created_at, updated_at")
        .eq("residence_id", residence.id)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setApplications((data || []) as AnalyticsRow[]);
    } catch (err) {
      console.error("Residence analytics load failed:", err);
      setError("Analytics could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, [residence?.id]);

  useEffect(() => {
    if (!residence?.id) return;
    void load();
    const channel = supabase
      .channel(`residence-analytics-${residence.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `residence_id=eq.${residence.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [residence?.id, load]);

  const analytics = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastMonthEnd = thisMonthStart - 1;

    const thisMonth = applications.filter((app) => app.created_at && new Date(app.created_at).getTime() >= thisMonthStart).length;
    const lastMonth = applications.filter((app) => {
      if (!app.created_at) return false;
      const time = new Date(app.created_at).getTime();
      return time >= lastMonthStart && time <= lastMonthEnd;
    }).length;

    const approved = applications.filter((app) => ["conditionally_approved", "approved"].includes(app.status)).length;
    const decided = applications.filter((app) => ["conditionally_approved", "approved", "rejected"].includes(app.status)).length;
    const nsfas = applications.filter((app) => app.funding_type === "nsfas").length;
    const pending = applications.filter((app) => ["submitted", "documents_required", "under_review"].includes(app.status)).length;

    const statusCounts = new Map<string, number>();
    applications.forEach((app) => statusCounts.set(app.status, (statusCounts.get(app.status) || 0) + 1));
    const fundingCounts = new Map<string, number>();
    applications.forEach((app) => {
      const type = app.funding_type || "unspecified";
      fundingCounts.set(type, (fundingCounts.get(type) || 0) + 1);
    });

    return {
      total: applications.length,
      thisMonth,
      lastMonth,
      approved,
      pending,
      nsfas,
      approvalRate: decided ? Math.round((approved / decided) * 100) : 0,
      statusCounts: Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1]),
      fundingCounts: Array.from(fundingCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [applications]);

  if (!residence) return <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">Loading your residence...</div>;

  const monthChange = analytics.lastMonth > 0
    ? Math.round(((analytics.thisMonth - analytics.lastMonth) / analytics.lastMonth) * 100)
    : null;

  return (
    <>
      <SEO noIndex title={`Application Analytics | ${residence.name} | ResKonnect`} description={`Application insights for ${residence.name}.`} />
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">{residence.name}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Application analytics</h1>
            <p className="mt-2 text-sm text-muted-foreground">A simple operational view of applications submitted to this accommodation.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
            <Button onClick={() => navigate("/residence/inbox")}><Inbox className="mr-2 h-4 w-4" /> Open applications</Button>
          </div>
        </div>

        {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-5 text-sm text-destructive">{error}</CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">Total applications</p><p className="mt-2 text-3xl font-black">{loading ? "—" : analytics.total}</p><p className="mt-1 text-xs text-muted-foreground">All time</p></div><Users className="h-5 w-5 text-primary" /></div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">This month</p><p className="mt-2 text-3xl font-black">{loading ? "—" : analytics.thisMonth}</p><p className="mt-1 text-xs text-muted-foreground">{monthChange === null ? "No previous-month baseline" : `${monthChange >= 0 ? "+" : ""}${monthChange}% vs last month`}</p></div><Clock3 className="h-5 w-5 text-primary" /></div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">Approval rate</p><p className="mt-2 text-3xl font-black">{loading ? "—" : `${analytics.approvalRate}%`}</p><p className="mt-1 text-xs text-muted-foreground">Of decided applications</p></div><CheckCircle2 className="h-5 w-5 text-primary" /></div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">NSFAS applications</p><p className="mt-2 text-3xl font-black">{loading ? "—" : analytics.nsfas}</p><p className="mt-1 text-xs text-muted-foreground">{analytics.total ? `${Math.round((analytics.nsfas / analytics.total) * 100)}% of total` : "0% of total"}</p></div><FileText className="h-5 w-5 text-primary" /></div></CardContent></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Status breakdown</CardTitle><CardDescription>Current application pipeline</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {analytics.statusCounts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No application data yet.</p> : analytics.statusCounts.map(([status, count]) => {
                const percentage = analytics.total ? Math.round((count / analytics.total) * 100) : 0;
                const group = RESIDENCE_APPLICATION_STATUS_META[status]?.group;
                return <button key={status} type="button" onClick={() => navigate(`/residence/inbox?status=${group === "all" || !group ? "all" : group}`)} className="w-full rounded-xl border p-4 text-left transition hover:border-primary/30 hover:bg-muted/30"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{getResidenceApplicationStatusLabel(status)}</p><p className="mt-1 text-xs text-muted-foreground">{percentage}% of applications</p></div><Badge variant={status === "rejected" ? "destructive" : status === "approved" ? "default" : "secondary"}>{count}</Badge></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div></button>;
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Funding breakdown</CardTitle><CardDescription>How applicants intend to fund accommodation</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {analytics.fundingCounts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No funding data yet.</p> : analytics.fundingCounts.map(([funding, count]) => {
                const percentage = analytics.total ? Math.round((count / analytics.total) * 100) : 0;
                return <button key={funding} type="button" onClick={() => navigate(`/residence/inbox?funding=${funding}`)} className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition hover:border-primary/30 hover:bg-muted/30"><div><p className="font-semibold capitalize">{funding}</p><p className="mt-1 text-xs text-muted-foreground">{percentage}% of applications</p></div><Badge variant="outline">{count}</Badge></button>;
              })}
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/15 bg-primary/[0.035]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-bold">{analytics.pending} application{analytics.pending === 1 ? "" : "s"} still in the active pipeline</p><p className="mt-1 text-sm text-muted-foreground">Submitted, documents required and under-review applications should be handled first.</p></div>
            <Button variant="outline" onClick={() => navigate("/residence/inbox?status=new")}>Review pipeline <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ResidenceAnalytics;
