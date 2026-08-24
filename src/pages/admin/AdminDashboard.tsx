import { useCallback, useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, AlertCircle, Ban, Bell, Briefcase, Building2, Calendar, CheckCircle,
  Database, Eye, FileText, Gift, GraduationCap, Handshake, Image, KeyRound, Layers,
  MapPin, Newspaper, Package, Percent, RefreshCw, ShoppingBag, Store, TrendingUp,
  Users, Wifi, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

interface OverviewStats {
  totalResidences: number;
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  totalUsers: number;
  totalListings: number;
  unverifiedListings: number;
  totalViews: number;
  activeBursaries: number;
  activeDiscounts: number;
  totalStores: number;
  totalWilApps: number;
  pendingWilApps: number;
  totalPortals: number;
  totalHamperOrders: number;
  totalDiscountOrders: number;
  totalSlides: number;
  totalNews: number;
  totalEvents: number;
  totalSections: number;
  totalAvailableSpots: number;
  fullResidences: number;
  unresolvedAlerts: number;
  publishedPartners: number;
  generatedAt: string | null;
}

const initialStats: OverviewStats = {
  totalResidences: 0,
  totalApplications: 0,
  pendingApplications: 0,
  approvedApplications: 0,
  rejectedApplications: 0,
  totalUsers: 0,
  totalListings: 0,
  unverifiedListings: 0,
  totalViews: 0,
  activeBursaries: 0,
  activeDiscounts: 0,
  totalStores: 0,
  totalWilApps: 0,
  pendingWilApps: 0,
  totalPortals: 0,
  totalHamperOrders: 0,
  totalDiscountOrders: 0,
  totalSlides: 0,
  totalNews: 0,
  totalEvents: 0,
  totalSections: 0,
  totalAvailableSpots: 0,
  fullResidences: 0,
  unresolvedAlerts: 0,
  publishedPartners: 0,
  generatedAt: null,
};

const AdminDashboard = () => {
  const { isGodMode, staffRole, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<OverviewStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !isGodMode) {
      if (staffRole === "tvet_lead") navigate("/tvet-dashboard");
      else navigate("/dashboard");
    }
  }, [isGodMode, authLoading, staffRole, navigate]);

  const fetchOverview = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      setOverviewError(null);
      const { data, error } = await (supabase as any).rpc("admin_dashboard_overview");
      if (error) throw error;

      const payload = typeof data === "string" ? JSON.parse(data) : (data || {});
      setStats((previous) => ({ ...previous, ...(payload.metrics || {}) }));
      setRecentApplications(Array.isArray(payload.recentApplications) ? payload.recentApplications : []);
      setRecentEvents(Array.isArray(payload.recentEvents) ? payload.recentEvents : []);
      setAlerts(Array.isArray(payload.alerts) ? payload.alerts : []);
    } catch (error: any) {
      console.error("[AdminDashboard] Backend overview failed:", error);
      setOverviewError(error?.message || "The backend overview could not be loaded.");
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview(true);

    const refresh = () => void fetchOverview(true);
    const channel = supabase
      .channel("admin-overview-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "residences" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "residence_portal_accounts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_listings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "wil_applications" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "partner_showcase" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_alerts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "system_events" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_slides" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "campus_news" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, refresh)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchOverview]);

  if (loading || authLoading || !isGodMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Database className="h-5 w-5 animate-pulse text-primary" />
          Loading live platform overview…
        </div>
      </div>
    );
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "approved": return "bg-success/20 text-success";
      case "rejected": return "bg-destructive/20 text-destructive";
      case "documents_required": return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
      case "under_review": return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
      case "conditionally_approved": return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
      case "submitted": return "bg-warning/20 text-warning";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "NEW_APPLICATION": return <FileText className="h-3.5 w-3.5 text-blue-500" />;
      case "NEW_ORDER": return <ShoppingBag className="h-3.5 w-3.5 text-green-500" />;
      case "RESIDENCE_FULL": return <Ban className="h-3.5 w-3.5 text-destructive" />;
      default: return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const v = (n: number) => Number(n || 0).toLocaleString("en-ZA");
  const generatedAt = stats.generatedAt ? new Date(stats.generatedAt) : null;

  const MetricGrid = ({ items, columns = "lg:grid-cols-6" }: { items: any[]; columns?: string }) => (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${columns}`}>
      {items.map((item, index) => (
        <Link key={`${item.label}-${index}`} to={item.path}>
          <Card className="h-full cursor-pointer border-border/70 transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
            <CardContent className="p-3.5">
              <div className="mb-1 flex items-center gap-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className={`text-lg font-black ${item.color}`}>{v(item.value)}</span>
              </div>
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );

  return (
    <AdminLayout>
      <SEO title="Platform Overview | Admin | ResKonnect" description="Live backend-powered ResKonnect operations overview." noIndex />

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Platform Overview</h1>
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary"><Wifi className="h-3 w-3" /> LIVE BACKEND</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">One backend aggregate for accommodation, applications, users, commerce, media, WIL, alerts and partnerships.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {generatedAt && <span className="text-xs text-muted-foreground">Synced {generatedAt.toLocaleString("en-ZA")}</span>}
            <Button variant="outline" onClick={() => void fetchOverview(false)} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Syncing…" : "Refresh overview"}
            </Button>
          </div>
        </div>

        {overviewError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div><p className="text-sm font-bold text-destructive">Backend overview unavailable</p><p className="text-xs text-muted-foreground">{overviewError}</p></div>
              </div>
              <Button size="sm" variant="outline" onClick={() => void fetchOverview(false)}>Retry</Button>
            </CardContent>
          </Card>
        )}

        {(stats.pendingApplications > 0 || stats.unverifiedListings > 0 || stats.pendingWilApps > 0 || stats.fullResidences > 0 || stats.unresolvedAlerts > 0) && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-warning" /><span className="text-sm font-bold">Needs attention</span></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  stats.pendingApplications > 0 && { label: "Active app reviews", value: stats.pendingApplications, path: "/admin/operations?tab=applications" },
                  stats.unverifiedListings > 0 && { label: "Unverified listings", value: stats.unverifiedListings, path: "/admin/commerce?tab=marketplace" },
                  stats.fullResidences > 0 && { label: "Full residences", value: stats.fullResidences, path: "/admin/operations?tab=residences" },
                  stats.pendingWilApps > 0 && { label: "WIL pending", value: stats.pendingWilApps, path: "/admin/system?tab=wil" },
                  stats.unresolvedAlerts > 0 && { label: "System alerts", value: stats.unresolvedAlerts, path: "/admin/system?tab=system-status" },
                ].filter(Boolean).map((item: any) => (
                  <Link key={item.label} to={item.path} className="rounded-xl bg-warning/10 p-3 transition hover:bg-warning/15">
                    <p className="text-xl font-black text-warning">{v(item.value)}</p><p className="text-xs text-muted-foreground">{item.label}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Find My Res intelligence</h2>
          <MetricGrid columns="lg:grid-cols-5" items={[
            { icon: Layers, label: "Active Sections", value: stats.totalSections, path: "/admin/operations?tab=residences", color: "text-violet-500" },
            { icon: MapPin, label: "Available Spots", value: stats.totalAvailableSpots, path: "/admin/operations?tab=residences", color: "text-green-500" },
            { icon: Ban, label: "Full Residences", value: stats.fullResidences, path: "/admin/operations?tab=residences", color: "text-destructive" },
            { icon: Eye, label: "Residence Events", value: stats.totalViews, path: "/admin/analytics", color: "text-orange-500" },
            { icon: Bell, label: "Unresolved Alerts", value: stats.unresolvedAlerts, path: "/admin/system?tab=system-status", color: "text-warning" },
          ]} />
        </div>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Operations</h2>
          <MetricGrid items={[
            { icon: Building2, label: "Residences", value: stats.totalResidences, path: "/admin/operations?tab=residences", color: "text-primary" },
            { icon: KeyRound, label: "Active Portals", value: stats.totalPortals, path: "/admin/operations?tab=portals", color: "text-purple-500" },
            { icon: FileText, label: "Applications", value: stats.totalApplications, path: "/admin/operations?tab=applications", color: "text-blue-500" },
            { icon: CheckCircle, label: "Approved", value: stats.approvedApplications, path: "/admin/operations?tab=applications", color: "text-green-500" },
            { icon: AlertCircle, label: "Rejected", value: stats.rejectedApplications, path: "/admin/operations?tab=applications", color: "text-red-500" },
            { icon: Users, label: "Users", value: stats.totalUsers, path: "/admin/operations?tab=users", color: "text-cyan-500" },
          ]} />
        </div>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Commerce & opportunities</h2>
          <MetricGrid items={[
            { icon: ShoppingBag, label: "Listings", value: stats.totalListings, path: "/admin/commerce?tab=marketplace", color: "text-purple-500" },
            { icon: Store, label: "Stores", value: stats.totalStores, path: "/admin/commerce?tab=stores", color: "text-indigo-500" },
            { icon: Percent, label: "Active Discounts", value: stats.activeDiscounts, path: "/admin/commerce?tab=discounts", color: "text-pink-500" },
            { icon: Package, label: "Discount Orders", value: stats.totalDiscountOrders, path: "/admin/commerce?tab=discount-orders", color: "text-orange-500" },
            { icon: Gift, label: "Hamper Orders", value: stats.totalHamperOrders, path: "/admin/commerce?tab=hampers", color: "text-amber-500" },
            { icon: Briefcase, label: "WIL Applications", value: stats.totalWilApps, path: "/admin/system?tab=wil", color: "text-teal-500" },
          ]} />
        </div>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Content & partnerships</h2>
          <MetricGrid columns="lg:grid-cols-5" items={[
            { icon: Image, label: "Active Hero Slides", value: stats.totalSlides, path: "/admin/media?tab=slides", color: "text-pink-500" },
            { icon: Newspaper, label: "Published News", value: stats.totalNews, path: "/admin/media?tab=news", color: "text-teal-500" },
            { icon: Calendar, label: "Events", value: stats.totalEvents, path: "/admin/media?tab=events", color: "text-violet-500" },
            { icon: GraduationCap, label: "Active Bursaries", value: stats.activeBursaries, path: "/admin/media?tab=bursaries", color: "text-emerald-500" },
            { icon: Handshake, label: "Published Showcase", value: stats.publishedPartners, path: "/admin/career-education", color: "text-primary" },
          ]} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Recent Applications</CardTitle><Button variant="outline" size="sm" asChild><Link to="/admin/operations?tab=applications">View All</Link></Button></div></CardHeader>
            <CardContent>
              {recentApplications.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No applications recorded.</p> : (
                <div className="space-y-2">{recentApplications.map((app) => (
                  <div key={app.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 p-3">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{app.student_name || "Unknown applicant"}</p><p className="truncate text-xs text-muted-foreground">{app.residence_name || "Accommodation"}{app.student_number ? ` · ${app.student_number}` : ""}</p></div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${getStatusBadgeClass(app.status)}`}>{String(app.status || "unknown").replace(/_/g, " ")}</span>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Live Activity</CardTitle></CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No system events recorded yet.</p> : (
                <div className="space-y-2">{recentEvents.map((evt: any) => (
                  <div key={evt.id} className="flex items-start gap-2 rounded-lg bg-secondary/20 p-2.5">{getEventIcon(evt.type)}<div className="min-w-0 flex-1"><p className="text-xs font-semibold">{String(evt.type || "SYSTEM_EVENT").replace(/_/g, " ")}</p><p className="text-[10px] text-muted-foreground">{evt.entity || "system"} · {new Date(evt.created_at).toLocaleString("en-ZA")}</p></div></div>
                ))}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Admin Alerts</CardTitle></CardHeader>
            <CardContent>
              {alerts.length === 0 ? <div className="rounded-xl bg-success/5 p-4 text-center text-sm text-muted-foreground"><CheckCircle className="mx-auto mb-2 h-5 w-5 text-success" />No unresolved admin alerts.</div> : (
                <div className="space-y-2">{alerts.map((alert: any) => (
                  <div key={alert.id} className="rounded-lg border border-warning/20 bg-warning/5 p-3"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div><p className="text-xs font-bold">{alert.title || "Admin alert"}</p>{alert.description && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{alert.description}</p>}<p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{alert.severity || "notice"}</p></div></div></div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/15 bg-primary/[0.025]">
          <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {[
                { icon: Building2, label: "Residences", path: "/admin/operations?tab=residences" },
                { icon: FileText, label: "Applications", path: "/admin/operations?tab=applications" },
                { icon: Users, label: "Users", path: "/admin/operations?tab=users" },
                { icon: Handshake, label: "Partners", path: "/admin/career-education" },
                { icon: Package, label: "Commerce", path: "/admin/commerce" },
                { icon: Image, label: "Media", path: "/admin/media" },
                { icon: TrendingUp, label: "Analytics", path: "/admin/analytics" },
                { icon: Zap, label: "System", path: "/admin/system" },
              ].map((action) => (
                <Link key={action.label} to={action.path} className="flex flex-col items-center rounded-xl border bg-background p-3 text-center transition hover:border-primary/30 hover:bg-primary/5"><action.icon className="mb-1 h-5 w-5 text-primary" /><span className="text-xs font-semibold">{action.label}</span></Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
