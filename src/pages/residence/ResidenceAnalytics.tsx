import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, FileText, Inbox, RefreshCw, Target, TrendingUp, Users } from "lucide-react";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { ResidencePortalContext } from "./ResidenceLayout";

const ResidenceAnalytics = () => {
  const navigate = useNavigate();
  const { residence } = useOutletContext<ResidencePortalContext>();
  const [applications, setApplications] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [demand, setDemand] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!residence?.id) return;
    setLoading(true);
    const db = supabase as any;
    const [apps, resv, crm, demandRes] = await Promise.all([
      supabase.from("applications").select("status,funding_type,created_at,updated_at").eq("residence_id", residence.id).order("created_at", { ascending: false }),
      db.from("accommodation_reservations").select("status,funding_type,academic_year,created_at").eq("residence_id", residence.id).order("created_at", { ascending: false }),
      db.from("residence_leads").select("stage,source_type,funding_type,created_at,updated_at").eq("residence_id", residence.id).order("created_at", { ascending: false }),
      db.rpc("get_residence_demand_summary", { _residence_id: residence.id }),
    ]);
    if (!apps.error) setApplications(apps.data || []);
    if (!resv.error) setReservations(resv.data || []);
    if (!crm.error) setLeads(crm.data || []);
    if (!demandRes.error) setDemand(demandRes.data || {});
    setLoading(false);
  }, [residence?.id]);

  useEffect(() => {
    void load();
    if (!residence?.id) return;
    const channel = supabase.channel(`residence-analytics-v2-${residence.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `residence_id=eq.${residence.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "accommodation_reservations", filter: `residence_id=eq.${residence.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "residence_leads", filter: `residence_id=eq.${residence.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [residence?.id, load]);

  const analytics = useMemo(() => {
    const approved = applications.filter((a) => ["approved","conditionally_approved"].includes(a.status)).length;
    const decided = applications.filter((a) => ["approved","conditionally_approved","rejected"].includes(a.status)).length;
    const res2027 = reservations.filter((r) => Number(r.academic_year) === 2027 && r.status !== "cancelled");
    const placed = leads.filter((l) => l.stage === "placed").length;
    const activeLeads = leads.filter((l) => l.stage !== "lost").length;
    const contacted = leads.filter((l) => !["new","lost"].includes(l.stage)).length;
    const nsfas = [...applications, ...res2027].filter((r) => r.funding_type === "nsfas").length;
    const privateCount = [...applications, ...res2027].filter((r) => r.funding_type === "private").length;
    const statuses = new Map<string, number>();
    leads.forEach((l) => statuses.set(l.stage, (statuses.get(l.stage) || 0) + 1));
    return {
      apps: applications.length, approved, approvalRate: decided ? Math.round(approved / decided * 100) : 0,
      reservations2027: res2027.length, placed, activeLeads, contacted,
      placementRate: leads.length ? Math.round(placed / leads.length * 100) : 0,
      contactRate: activeLeads ? Math.round(contacted / activeLeads * 100) : 0,
      nsfas, privateCount, stages: [...statuses.entries()].sort((a,b) => b[1]-a[1]),
    };
  }, [applications, reservations, leads]);

  if (!residence) return <div className="py-16 text-center text-sm text-muted-foreground">Loading residence analytics…</div>;
  const metric = (label: string, value: any, note: string, Icon: any) => <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{loading ? "—" : value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div><Icon className="h-5 w-5 text-primary" /></div></CardContent></Card>;

  return <>
    <SEO noIndex title={`Growth Analytics | ${residence.name} | ResKonnect`} description={`Applications, 2027 reservations, demand and placement conversion for ${residence.name}.`} />
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-primary">Landlord Portal 2.0</p><h1 className="mt-1 text-3xl font-black">Growth & conversion analytics</h1><p className="mt-2 text-sm text-muted-foreground">See application demand, 2027 reservations, lead conversion and anonymised market demand in one view.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button><Button onClick={() => navigate("/residence/crm")}><Target className="mr-2 h-4 w-4" />Open CRM</Button></div></div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metric("Applications", analytics.apps, `${analytics.approvalRate}% approval rate`, FileText)}
        {metric("2027 reservations", analytics.reservations2027, "Active reservation interest", CalendarDays)}
        {metric("Active leads", analytics.activeLeads, `${analytics.contactRate}% contacted`, Users)}
        {metric("Placed tenants", analytics.placed, `${analytics.placementRate}% lead-to-placement`, CheckCircle2)}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Funding demand</CardTitle><CardDescription>Applications + 2027 reservation interest</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between rounded-xl bg-muted/40 p-4"><span className="font-semibold">NSFAS-funded</span><Badge>{analytics.nsfas}</Badge></div><div className="flex items-center justify-between rounded-xl bg-muted/40 p-4"><span className="font-semibold">Private / self-funded</span><Badge variant="outline">{analytics.privateCount}</Badge></div><p className="text-xs leading-5 text-muted-foreground">These groups use separate accommodation pricing. Do not assume the published private price is the funded rate.</p></CardContent></Card>

        <Card><CardHeader><CardTitle>CRM pipeline</CardTitle><CardDescription>Current prospect stages</CardDescription></CardHeader><CardContent className="space-y-2">{analytics.stages.length ? analytics.stages.map(([stage,count]) => <button key={stage} onClick={() => navigate(`/residence/crm?stage=${stage}`)} className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:border-primary/30"><span className="font-semibold capitalize">{stage.replace(/_/g," ")}</span><Badge variant="secondary">{count}</Badge></button>) : <p className="py-8 text-center text-sm text-muted-foreground">CRM data will appear as students apply or reserve.</p>}</CardContent></Card>

        <Card className="border-primary/20 bg-primary/[0.025]"><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Demand Network</CardTitle><CardDescription>Anonymised demand around this residence</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-background p-3"><p className="text-2xl font-black">{demand.searching || 0}</p><p className="text-xs text-muted-foreground">Searching</p></div><div className="rounded-xl bg-background p-3"><p className="text-2xl font-black">{demand["2027"] || 0}</p><p className="text-xs text-muted-foreground">2027 demand</p></div><div className="rounded-xl bg-background p-3"><p className="text-2xl font-black">{demand.nsfas || 0}</p><p className="text-xs text-muted-foreground">NSFAS</p></div><div className="rounded-xl bg-background p-3"><p className="text-2xl font-black">{demand.private || 0}</p><p className="text-xs text-muted-foreground">Private</p></div></div>{demand.average_budget && <p className="text-xs text-muted-foreground">Average declared private budget: R{Number(demand.average_budget).toLocaleString("en-ZA")}/month.</p>}</CardContent></Card>
      </div>

      <Card className="border-primary/15"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Turn analytics into action</p><p className="mt-1 text-sm text-muted-foreground">Keep room prices verified, follow up new leads and monitor 2027 demand weekly.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => navigate("/residence/inventory")}>Manage pricing</Button><Button onClick={() => navigate("/residence/inbox")}><Inbox className="mr-2 h-4 w-4" />Applications <ArrowRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card>
    </div>
  </>;
};

export default ResidenceAnalytics;
