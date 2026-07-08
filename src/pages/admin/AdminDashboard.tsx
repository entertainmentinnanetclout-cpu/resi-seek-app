import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, Users, FileText, ShoppingBag, Eye, CheckCircle, AlertCircle,
  Package, Activity, Star, GraduationCap, Image, Newspaper, Briefcase,
  Store, KeyRound, Gift, Percent, TrendingUp, Zap, Calendar, Layers,
  MapPin, Ban, Bell
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const { isGodMode, staffRole, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isGodMode) {
      if (staffRole === 'tvet_lead') {
        navigate('/tvet-dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isGodMode, authLoading, staffRole, navigate]);
  const [stats, setStats] = useState({
    totalResidences: 0,
    totalApplications: 0,
    pendingApplications: 0,
    approvedApplications: 0,
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
    // FindMyRes stats
    totalSections: 0,
    totalAvailableSpots: 0,
    fullResidences: 0,
    // Alerts
    unresolvedAlerts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentApplications, setRecentApplications] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          residences, applications, profiles, listings, analytics,
          bursaries, discounts, stores, wilApps, portals,
          hamperOrders, discountOrders, slides, news, events,
          sections, residenceData, alertsData, systemEventsData
        ] = await Promise.all([
          supabase.from("residences").select("id", { count: "exact", head: true }),
          supabase.from("applications").select("id, status"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("marketplace_listings").select("id, verified"),
          supabase.from("residence_analytics").select("id", { count: "exact", head: true }),
          supabase.from("bursaries").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("student_discounts").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("stores").select("id", { count: "exact", head: true }),
          supabase.from("wil_applications" as any).select("id, status"),
          supabase.from("residence_portal_accounts").select("residence_id", { count: "exact", head: true }),
          supabase.from("hamper_orders").select("id", { count: "exact", head: true }),
          supabase.from("discount_orders").select("id", { count: "exact", head: true }),
          supabase.from("hero_slides").select("id", { count: "exact", head: true }),
          supabase.from("campus_news").select("id", { count: "exact", head: true }),
          supabase.from("events").select("id", { count: "exact", head: true }),
          // FindMyRes stats
          supabase.from("residence_sections").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("residences").select("available_spots"),
          // Enterprise tables (may not exist yet on external)
          supabase.from("admin_alerts" as any).select("id", { count: "exact", head: true }).eq("resolved", false),
          supabase.from("system_events" as any).select("id, type, entity, metadata, created_at").order("created_at", { ascending: false }).limit(10),
        ]);

        const pendingCount = applications.data?.filter(a => a.status === "submitted" || a.status === "pending").length || 0;
        const approvedCount = applications.data?.filter(a => a.status === "approved").length || 0;
        const unverifiedCount = listings.data?.filter(l => !l.verified).length || 0;
        const wilData = wilApps.data as any[] || [];
        const pendingWil = wilData.filter((w: any) => w.status === "submitted").length;

        // Calculate FindMyRes stats
        const resData = residenceData.data || [];
        const totalSpots = resData.reduce((sum: number, r: any) => sum + (r.available_spots || 0), 0);
        const fullCount = resData.filter((r: any) => r.available_spots === 0).length;

        setStats({
          totalResidences: residences.count || 0,
          totalApplications: applications.data?.length || 0,
          pendingApplications: pendingCount,
          approvedApplications: approvedCount,
          totalUsers: profiles.count || 0,
          totalListings: listings.data?.length || 0,
          unverifiedListings: unverifiedCount,
          totalViews: analytics.count || 0,
          activeBursaries: bursaries.count || 0,
          activeDiscounts: discounts.count || 0,
          totalStores: stores.count || 0,
          totalWilApps: wilData.length,
          pendingWilApps: pendingWil,
          totalPortals: portals.count || 0,
          totalHamperOrders: hamperOrders.count || 0,
          totalDiscountOrders: discountOrders.count || 0,
          totalSlides: slides.count || 0,
          totalNews: news.count || 0,
          totalEvents: events.count || 0,
          totalSections: sections.count || 0,
          totalAvailableSpots: totalSpots,
          fullResidences: fullCount,
          unresolvedAlerts: alertsData.count || 0,
        });

        // Recent system events
        if (systemEventsData.data) {
          setRecentEvents(systemEventsData.data as any[]);
        }

        // Alerts
        if (alertsData.data) {
          setAlerts((alertsData.data as any[]).slice(0, 5));
        }

        const { data: recentApps } = await supabase
          .from("applications")
          .select("*, residence:residences!fk_applications_residence(name)")
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentApps) {
          const appsWithProfiles = await Promise.all(
            recentApps.map(async (app) => {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", app.user_id)
                .maybeSingle();
              return { ...app, profile };
            })
          );
          setRecentApplications(appsWithProfiles);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    const channel = supabase
      .channel('admin-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_listings' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residences' }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading || authLoading || !isGodMode) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Verifying God Mode access...</div>
      </div>
    );
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "approved": return "bg-success/20 text-success";
      case "rejected": return "bg-destructive/20 text-destructive";
      case "pending":
      case "submitted": return "bg-warning/20 text-warning";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "NEW_APPLICATION": return <FileText className="w-3.5 h-3.5 text-blue-500" />;
      case "NEW_ORDER": return <ShoppingBag className="w-3.5 h-3.5 text-green-500" />;
      case "RESIDENCE_FULL": return <Ban className="w-3.5 h-3.5 text-destructive" />;
      default: return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const v = (n: number) => loading ? "..." : n.toLocaleString();

  return (
    <AdminLayout>
      <SEO title="God Mode Dashboard | ResKonnect" description="Full platform control centre." />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold">God Mode</h1>
              <Badge variant="outline" className="text-xs border-primary text-primary">
                <Zap className="w-3 h-3 mr-1" /> ADMIN
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Full platform control centre</p>
          </div>
        </div>

        {/* Alerts Banner */}
        {(stats.pendingApplications > 0 || stats.unverifiedListings > 0 || stats.pendingWilApps > 0 || stats.fullResidences > 0) && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-warning" />
                <span className="font-semibold text-sm">Needs Attention</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stats.pendingApplications > 0 && (
                  <Link to="/admin/operations?tab=applications">
                    <div className="p-3 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors">
                      <p className="text-xl font-bold text-warning">{v(stats.pendingApplications)}</p>
                      <p className="text-xs text-muted-foreground">Pending Apps</p>
                    </div>
                  </Link>
                )}
                {stats.unverifiedListings > 0 && (
                  <Link to="/admin/commerce?tab=marketplace">
                    <div className="p-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors">
                      <p className="text-xl font-bold text-destructive">{v(stats.unverifiedListings)}</p>
                      <p className="text-xs text-muted-foreground">Unverified Listings</p>
                    </div>
                  </Link>
                )}
                {stats.fullResidences > 0 && (
                  <Link to="/admin/operations?tab=residences">
                    <div className="p-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors">
                      <p className="text-xl font-bold text-destructive">{v(stats.fullResidences)}</p>
                      <p className="text-xs text-muted-foreground">Full Residences</p>
                    </div>
                  </Link>
                )}
                {stats.pendingWilApps > 0 && (
                  <Link to="/admin/system?tab=wil">
                    <div className="p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                      <p className="text-xl font-bold text-primary">{v(stats.pendingWilApps)}</p>
                      <p className="text-xs text-muted-foreground">WIL Pending</p>
                    </div>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FINDMYRES HUB */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">FindMyRes Intelligence</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Layers, label: "Active Sections", value: stats.totalSections, path: "/admin/operations?tab=residences", color: "text-violet-500" },
              { icon: MapPin, label: "Available Spots", value: stats.totalAvailableSpots, path: "/admin/operations?tab=residences", color: "text-green-500" },
              { icon: Ban, label: "Full Residences", value: stats.fullResidences, path: "/admin/operations?tab=residences", color: "text-destructive" },
              { icon: Bell, label: "Unresolved Alerts", value: stats.unresolvedAlerts, path: "/admin/system?tab=system-status", color: "text-warning" },
            ].map((s, i) => (
              <Link key={i} to={s.path}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                      <span className={`text-lg font-bold ${s.color}`}>{v(s.value)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* OPERATIONS HUB */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Operations Hub</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: Building2, label: "Residences", value: stats.totalResidences, path: "/admin/operations?tab=residences", color: "text-primary" },
              { icon: KeyRound, label: "Portals", value: stats.totalPortals, path: "/admin/operations?tab=portals", color: "text-purple-500" },
              { icon: FileText, label: "Applications", value: stats.totalApplications, path: "/admin/operations?tab=applications", color: "text-blue-500" },
              { icon: CheckCircle, label: "Approved", value: stats.approvedApplications, path: "/admin/operations?tab=applications", color: "text-green-500" },
              { icon: Users, label: "Users", value: stats.totalUsers, path: "/admin/operations?tab=users", color: "text-cyan-500" },
              { icon: Eye, label: "Page Views", value: stats.totalViews, path: "/admin/analytics", color: "text-orange-500" },
            ].map((s, i) => (
              <Link key={i} to={s.path}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                      <span className={`text-lg font-bold ${s.color}`}>{v(s.value)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* COMMERCE HUB */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Commerce Hub</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: ShoppingBag, label: "Listings", value: stats.totalListings, path: "/admin/commerce?tab=marketplace", color: "text-purple-500" },
              { icon: Store, label: "Stores", value: stats.totalStores, path: "/admin/commerce?tab=stores", color: "text-indigo-500" },
              { icon: Percent, label: "Discounts", value: stats.activeDiscounts, path: "/admin/commerce?tab=discounts", color: "text-pink-500" },
              { icon: Package, label: "Discount Orders", value: stats.totalDiscountOrders, path: "/admin/commerce?tab=discount-orders", color: "text-orange-500" },
              { icon: Gift, label: "Hamper Orders", value: stats.totalHamperOrders, path: "/admin/commerce?tab=hampers", color: "text-amber-500" },
              { icon: Briefcase, label: "WIL Apps", value: stats.totalWilApps, path: "/admin/system?tab=wil", color: "text-teal-500" },
            ].map((s, i) => (
              <Link key={i} to={s.path}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                      <span className={`text-lg font-bold ${s.color}`}>{v(s.value)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* MEDIA HUB */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Media Hub</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Image, label: "Hero Slides", value: stats.totalSlides, path: "/admin/media?tab=slides", color: "text-pink-500" },
              { icon: Newspaper, label: "News Articles", value: stats.totalNews, path: "/admin/media?tab=news", color: "text-teal-500" },
              { icon: Calendar, label: "Events", value: stats.totalEvents, path: "/admin/media?tab=events", color: "text-violet-500" },
              { icon: GraduationCap, label: "Bursaries", value: stats.activeBursaries, path: "/admin/media?tab=bursaries", color: "text-emerald-500" },
            ].map((s, i) => (
              <Link key={i} to={s.path}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                      <span className={`text-xl font-bold ${s.color}`}>{v(s.value)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity + Quick Actions + Alerts */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Applications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Applications</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/operations?tab=applications">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentApplications.length === 0 ? (
                <p className="text-centre py-4 text-muted-foreground text-sm">No applications yet</p>
              ) : (
                <div className="space-y-2">
                  {recentApplications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{app.profile?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground truncate">{app.residence?.name}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${getStatusBadgeClass(app.status)}`}>
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Activity Feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Live Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">No events yet. Run ENTERPRISE_SQL.sql to enable.</p>
              ) : (
                <div className="space-y-2">
                  {recentEvents.map((evt: any) => (
                    <div key={evt.id} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/20">
                      {getEventIcon(evt.type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{evt.type.replace(/_/g, " ")}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(evt.created_at).toLocaleString("en-ZA")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: Building2, label: "Residences", path: "/admin/operations?tab=residences", color: "text-primary" },
                  { icon: FileText, label: "Applications", path: "/admin/operations?tab=applications", color: "text-blue-500" },
                  { icon: Layers, label: "Sections", path: "/admin/operations?tab=residences", color: "text-violet-500" },
                  { icon: Activity, label: "System", path: "/admin/system?tab=system-status", color: "text-green-500" },
                  { icon: Package, label: "Market", path: "/admin/commerce?tab=marketplace", color: "text-orange-500" },
                  { icon: Image, label: "Slides", path: "/admin/media?tab=slides", color: "text-pink-500" },
                  { icon: Users, label: "Follow-Up", path: "/admin/operations?tab=follow-up", color: "text-cyan-500" },
                  { icon: TrendingUp, label: "Analytics", path: "/admin/analytics", color: "text-violet-500" },
                ].map((a, i) => (
                  <Link key={i} to={a.path} className="flex flex-col items-center p-2 border rounded-lg hover:bg-secondary transition-colors text-center">
                    <a.icon className={`w-5 h-5 mb-1 ${a.color}`} />
                    <span className="text-xs font-medium truncate w-full">{a.label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
