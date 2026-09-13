import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { safeRelativeTime, safeShortDate } from "@/lib/safeDates";
import { ArrowRight, Bell, BrainCircuit, BriefcaseBusiness, Building2, CheckCircle2, Clock3, FileCheck2, Headphones, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

const safePath = (value?: unknown, fallback = "/dashboard") => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const baseOrigin = typeof window !== "undefined" && /^https?:/i.test(window.location.origin)
      ? window.location.origin
      : "https://www.reskonnect.org";
    const url = new URL(raw, baseOrigin);
    if (url.hostname === "www.reskonnect.org" || url.hostname === "reskonnect.org") {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return fallback;
  }
  return fallback;
};

const MyResKonnectCommandCentre = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [command, service, opportunity] = await Promise.allSettled([
        (supabase as any).rpc("my_reskonnect_command_centre"),
        (supabase as any).rpc("my_reskonnect_service_centre"),
        (supabase as any).rpc("reskonnect_opportunity_feed", { p_query: null, p_type: null, p_limit: 6 }),
      ]);
      const commandResult = command.status === "fulfilled" ? command.value : { data: null, error: command.reason };
      const serviceResult = service.status === "fulfilled" ? service.value : { data: null, error: service.reason };
      const opportunityResult = opportunity.status === "fulfilled" ? opportunity.value : { data: null, error: opportunity.reason };
      if (commandResult.error) console.error("Could not load My ResKonnect command centre", commandResult.error);
      if (serviceResult.error) console.error("Could not load My ResKonnect Service Centre summary", serviceResult.error);
      if (opportunityResult.error) console.error("Could not load RG3 opportunity feed", opportunityResult.error);
      setData({
        ...(commandResult.data || {}),
        service_centre: serviceResult.data || { open_count: 0, requests: [] },
        opportunity_engine: opportunityResult.data || { items: [] },
      });
    } catch (error) {
      console.error("My ResKonnect dashboard load failed safely", error);
      setData({ service_centre: { open_count: 0, requests: [] }, opportunity_engine: { items: [] } });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const profile = data?.profile || {};
  const living = data?.living || {};
  const nextAction = data?.next_action || null;
  const opportunities = Array.isArray(data?.opportunity_engine?.items) ? data.opportunity_engine.items : (Array.isArray(data?.opportunities) ? data.opportunities : []);
  const serviceCentre = data?.service_centre || { open_count: 0, requests: [] };
  const openServiceRequests = Number(serviceCentre.open_count || 0);
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
  const recentApplications = Array.isArray(living?.recent) ? living.recent : [];
  const latestHealth = living?.latest_health || null;
  const firstName = String(profile.full_name || "Student").trim().split(/\s+/)[0] || "Student";
  const healthScore = Number(latestHealth?.score || 0);

  const livingSummary = useMemo(() => {
    const count = Number(living.application_count || 0);
    if (!count) return "Find verified accommodation and start your Living journey.";
    const approved = Number(living.approved_count || 0);
    if (approved) return `${approved} approved accommodation application${approved === 1 ? "" : "s"}.`;
    return `${count} accommodation application${count === 1 ? "" : "s"} in your journey.`;
  }, [living]);

  if (loading) {
    return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Connecting your ResKonnect journey…</p></div></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:py-8 lg:px-8">
      <section className="overflow-hidden rounded-[30px] border bg-[radial-gradient(circle_at_85%_15%,hsl(var(--primary)/0.2),transparent_28%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--muted)/0.45))] p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">MY RESKONNECT · LIVING • AI • OPPORTUNITY</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Good to see you, {firstName}.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">One account for where you live, what you need to understand and the opportunities that move you forward.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} className="w-fit rounded-full"><RefreshCw className="mr-2 h-4 w-4" />Refresh journey</Button>
        </div>
      </section>

      <section>
        <Card className="overflow-hidden border-primary/20 shadow-sm">
          <CardContent className="p-0">
            <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Your next best action</p></div>
                {nextAction ? <>
                  <h2 className="mt-3 text-2xl font-black">{nextAction.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{nextAction.rationale || "Continue the highest-priority action on your ResKonnect journey."}</p>
                </> : <>
                  <h2 className="mt-3 text-2xl font-black">Explore your next ResKonnect step</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">There is no urgent account action right now. Use Living, AI or Opportunity below.</p>
                </>}
              </div>
              <div className="flex items-center border-t bg-primary/[0.035] p-5 lg:border-l lg:border-t-0">
                <Button size="lg" className="w-full rounded-full lg:w-auto" onClick={() => navigate(nextAction ? safePath(nextAction.action_url, "/my-applications") : "/get-started")}>
                  {nextAction ? "Continue" : "Explore ResKonnect"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="overflow-hidden rounded-[26px] border bg-card shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
          <div className="flex items-start gap-4 p-5 sm:p-6">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-300"><Headphones className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Service delivery</p>
              <h2 className="mt-1 text-xl font-black">{openServiceRequests ? `${openServiceRequests} open service request${openServiceRequests === 1 ? "" : "s"}` : "Need ResKonnect help?"}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{openServiceRequests ? "Track verified request status, department routing and customer-visible activity from one place." : "Create one tracked request and follow it from submission to resolution instead of repeating the issue across channels."}</p>
            </div>
          </div>
          <div className="flex items-center border-t bg-muted/25 p-5 lg:border-l lg:border-t-0">
            <Button asChild variant="outline" className="w-full rounded-full lg:w-auto"><Link to="/dashboard/services">{openServiceRequests ? "Track requests" : "Open Service Centre"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Building2 className="h-5 w-5" /></div><Badge variant="outline">Living</Badge></div>
            <h2 className="mt-5 text-xl font-black">Your place to live</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{livingSummary}</p>
            {latestHealth && <div className="mt-4 rounded-2xl bg-muted/50 p-3"><div className="flex items-center justify-between text-xs"><span>Application readiness</span><strong>{healthScore}%</strong></div><Progress value={healthScore} className="mt-2 h-2" /></div>}
            <Button asChild variant="outline" className="mt-5 w-full rounded-full"><Link to={Number(living.application_count || 0) ? "/my-applications" : "/findmyres"}>{Number(living.application_count || 0) ? "Track Living journey" : "Find accommodation"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden border-violet-500/20 transition hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-700 dark:text-violet-300"><BrainCircuit className="h-5 w-5" /></div><Badge variant="outline">AI</Badge></div>
            <h2 className="mt-5 text-xl font-black">Understand your next move</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">Ask ResKonnect AI about accommodation, applications, your account journey and verified opportunities.</p>
            <div className="mt-4 rounded-2xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">Account-aware answers use your authenticated ResKonnect context without exposing other users' records.</div>
            <Button asChild className="mt-5 w-full rounded-full"><Link to="/ai">Ask ResKonnect AI<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><BriefcaseBusiness className="h-5 w-5" /></div><Badge variant="outline">Opportunity</Badge></div>
            <h2 className="mt-5 text-xl font-black">What comes next</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{opportunities.length ? `${opportunities.length} verified current opportunities are ready to explore.` : "Explore bursaries, WIL and verified opportunity pathways."}</p>
            <div className="mt-4 rounded-2xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">{profile.course ? `Your course context: ${profile.course}` : "Add your course to improve opportunity relevance."}</div>
            <Button asChild variant="outline" className="mt-5 w-full rounded-full"><Link to="/opportunities">Explore opportunities<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      </section>

      {latestHealth && Array.isArray(latestHealth.missing_items) && latestHealth.missing_items.length > 0 && (
        <section className="rounded-[26px] border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" /><h2 className="text-lg font-black">Application readiness</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">These are live missing items from your current application health score.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {latestHealth.missing_items.slice(0, 6).map((item: any) => <button key={item.key || item.label} type="button" onClick={() => navigate(safePath(item.url, "/my-applications"))} className="flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/[0.025]"><span className="text-sm font-semibold">{item.label || "Complete required item"}</span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Opportunity feed</p><h2 className="mt-1 text-xl font-black">Relevant things to explore</h2></div><BriefcaseBusiness className="h-5 w-5 text-muted-foreground" /></div>
            <div className="mt-4 space-y-2">
              {opportunities.length ? opportunities.slice(0, 5).map((item: any) => <Link key={`${item.source_type || item.kind}-${item.id}`} to={safePath(item.to_path, "/opportunities")} className="block rounded-2xl border p-4 transition hover:border-primary/35 hover:bg-primary/[0.025]"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.organisation || item.opportunity_type || item.kind}</p></div>{(item.closing_date || item.closes_at) && <Badge variant="secondary">{safeShortDate(item.closing_date || item.closes_at)}</Badge>}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.match_reason || "Current verified opportunity on ResKonnect"}</p></Link>) : <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No current verified opportunities match this snapshot yet. Open the Opportunity Engine to search the live catalog.</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Your journey</p><h2 className="mt-1 text-xl font-black">Recent verified activity</h2></div><Clock3 className="h-5 w-5 text-muted-foreground" /></div>
            <div className="mt-4 space-y-3">
              {timeline.length ? timeline.slice(0, 7).map((item: any) => <div key={item.id} className="flex gap-3"><div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><p className="text-sm font-semibold">{item.title}</p>{item.summary && <p className="truncate text-xs text-muted-foreground">{item.summary}</p>}<p className="mt-1 text-[10px] text-muted-foreground">{safeRelativeTime(item.occurred_at)}</p></div></div>) : <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Your verified ResKonnect activity will appear here as you use services.</p>}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><h2 className="text-lg font-black">Latest updates</h2></div>
            <div className="mt-4 space-y-2">
              {notifications.length ? notifications.slice(0, 5).map((item: any) => <Link key={item.id} to="/dashboard/updates" className="flex items-start gap-3 rounded-2xl border p-3 transition hover:bg-muted/40">{item.is_read ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}<div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.message}</p></div></Link>) : <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">You're all caught up. Important account updates will appear here.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Living overview</p>
            <h2 className="mt-1 text-xl font-black">Accommodation applications</h2>
            <div className="mt-4 space-y-2">
              {recentApplications.length ? recentApplications.map((app: any) => <Link key={app.id} to="/my-applications" className="flex items-center justify-between gap-4 rounded-2xl border p-3 transition hover:bg-muted/40"><div className="min-w-0"><p className="truncate text-sm font-semibold">{app.residence_name || "Accommodation application"}</p><p className="text-xs capitalize text-muted-foreground">{String(app.status || "submitted").replaceAll("_", " ")}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>) : <div className="rounded-2xl border border-dashed p-5"><p className="text-sm text-muted-foreground">No accommodation applications yet.</p><Button asChild variant="link" className="mt-2 h-auto p-0"><Link to="/findmyres">Find accommodation <ArrowRight className="ml-1 h-4 w-4" /></Link></Button></div>}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default MyResKonnectCommandCentre;
