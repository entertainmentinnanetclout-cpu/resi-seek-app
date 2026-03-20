import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileText, ShoppingBag, Eye, Clock, CheckCircle, AlertCircle, Package, Activity, Star, GraduationCap, Image, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const AdminDashboard = () => {
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
  });
  const [loading, setLoading] = useState(true);
  const [recentApplications, setRecentApplications] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('[AdminDashboard] Fetching stats...');
        
        const [residences, applications, profiles, listings, analytics, bursaries, discounts] = await Promise.all([
          supabase.from("residences").select("id", { count: "exact", head: true }),
          supabase.from("applications").select("id, status"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("marketplace_listings").select("id, verified"),
          supabase.from("residence_analytics").select("id", { count: "exact", head: true }),
          supabase.from("bursaries").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("student_discounts").select("id", { count: "exact", head: true }).eq("is_active", true),
        ]);
        
        if (residences.error) console.error('[AdminDashboard] Residences error:', residences.error);
        if (applications.error) console.error('[AdminDashboard] Applications error:', applications.error);
        if (profiles.error) console.error('[AdminDashboard] Profiles error:', profiles.error);
        if (listings.error) console.error('[AdminDashboard] Listings error:', listings.error);
        
        console.log('[AdminDashboard] Stats loaded:', {
          residences: residences.count,
          applications: applications.data?.length,
          profiles: profiles.count,
          listings: listings.data?.length,
        });

        const pendingCount = applications.data?.filter(a => a.status === "submitted" || a.status === "pending").length || 0;
        const approvedCount = applications.data?.filter(a => a.status === "approved").length || 0;
        const unverifiedCount = listings.data?.filter(l => !l.verified).length || 0;

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
        });

        // Fetch recent applications
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

    // Realtime subscription for live updates
    const channel = supabase
      .channel('admin-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_listings' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residences' }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const mainStats = [
    { icon: Building2, label: "Residences", value: stats.totalResidences, color: "text-primary", bgColor: "bg-primary/10" },
    { icon: Users, label: "Users", value: stats.totalUsers, color: "text-green-500", bgColor: "bg-green-500/10" },
    { icon: ShoppingBag, label: "Listings", value: stats.totalListings, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    { icon: Eye, label: "Views", value: stats.totalViews, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
  ];

  const alertStats = [
    { 
      icon: Clock, 
      label: "Pending", 
      value: stats.pendingApplications, 
      color: "text-warning", 
      bgColor: "bg-warning/10",
      link: "/admin/applications",
      urgent: stats.pendingApplications > 0
    },
    { 
      icon: AlertCircle, 
      label: "Unverified", 
      value: stats.unverifiedListings, 
      color: "text-destructive", 
      bgColor: "bg-destructive/10",
      link: "/admin/marketplace",
      urgent: stats.unverifiedListings > 0
    },
    { 
      icon: CheckCircle, 
      label: "Approved", 
      value: stats.approvedApplications, 
      color: "text-success", 
      bgColor: "bg-success/10",
      link: "/admin/applications"
    },
    { 
      icon: FileText, 
      label: "Total Apps", 
      value: stats.totalApplications, 
      color: "text-blue-500", 
      bgColor: "bg-blue-500/10",
      link: "/admin/applications"
    },
  ];

  const quickActions = [
    { icon: Building2, label: "Residences", path: "/admin/residences", color: "text-primary" },
    { icon: FileText, label: "Applications", path: "/admin/applications", color: "text-blue-500" },
    { icon: Star, label: "Top 30", path: "/admin/residences?tab=trusted", color: "text-yellow-500" },
    { icon: Activity, label: "System", path: "/admin/system-status", color: "text-green-500" },
    { icon: GraduationCap, label: "Bursaries", path: "/admin/bursaries", color: "text-purple-500" },
    { icon: Package, label: "Market", path: "/admin/marketplace", color: "text-orange-500" },
    { icon: Image, label: "Slides", path: "/admin/slides", color: "text-pink-500" },
    { icon: Newspaper, label: "News", path: "/admin/news", color: "text-teal-500" },
  ];

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "approved": return "bg-success/20 text-success";
      case "rejected": return "bg-destructive/20 text-destructive";
      case "pending":
      case "submitted": return "bg-warning/20 text-warning";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <AdminLayout>
      <SEO
        title="Admin Dashboard | ResKonnect Management"
        description="Manage ResKonnect platform - residences, applications, users, and content."
      />
      
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome back! Here's your overview.
          </p>
        </div>

        {/* Alert Stats - Mobile optimized */}
        {(stats.pendingApplications > 0 || stats.unverifiedListings > 0) && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                {alertStats.filter(s => s.urgent).map((stat, index) => (
                  <Link key={index} to={stat.link || "#"}>
                    <div className={`p-3 rounded-lg ${stat.bgColor} hover:opacity-80 transition-opacity cursor-pointer`}>
                      <div className="flex items-center gap-2">
                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                        <span className={`text-xl font-bold ${stat.color}`}>
                          {loading ? "..." : stat.value}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Stats Grid - Mobile 2x2 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {mainStats.map((stat, index) => (
            <Card key={index} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 sm:p-3 rounded-full ${stat.bgColor} shrink-0`}>
                    <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xl sm:text-2xl font-bold ${stat.color} truncate`}>
                      {loading ? "..." : stat.value.toLocaleString()}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Secondary Stats - Scrollable on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible">
          {alertStats.map((stat, index) => (
            <Link key={index} to={stat.link || "#"} className="flex-shrink-0 w-32 sm:w-auto">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-lg sm:text-xl font-bold ${stat.color}`}>
                        {loading ? "..." : stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions - Mobile grid */}
        <Card>
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              {quickActions.map((action, index) => (
                <Link key={index} to={action.path} className="flex flex-col items-center p-2 sm:p-4 border rounded-lg hover:bg-secondary transition-colors text-center">
                  <action.icon className={`w-5 h-5 sm:w-7 sm:h-7 mb-1 sm:mb-2 ${action.color}`} />
                  <span className="text-xs sm:text-sm font-medium truncate w-full">{action.label}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Applications & Content Stats - Stack on mobile */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Applications */}
          <Card>
            <CardHeader className="pb-3 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg">Recent Applications</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/applications">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {recentApplications.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">No applications yet</p>
              ) : (
                <div className="space-y-2">
                  {recentApplications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-2 sm:p-3 bg-secondary/30 rounded-lg gap-2">
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

          {/* Content Overview */}
          <Card>
            <CardHeader className="pb-3 px-4 pt-4">
              <CardTitle className="text-base sm:text-lg">Content Overview</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Platform content stats</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold text-primary">{stats.activeBursaries}</p>
                  <p className="text-xs text-muted-foreground">Bursaries</p>
                </div>
                <div className="text-center p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold text-green-500">{stats.activeDiscounts}</p>
                  <p className="text-xs text-muted-foreground">Discounts</p>
                </div>
                <div className="text-center p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold text-purple-500">{stats.totalListings}</p>
                  <p className="text-xs text-muted-foreground">Market Items</p>
                </div>
                <div className="text-center p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold text-cyan-500">{stats.totalViews}</p>
                  <p className="text-xs text-muted-foreground">Page Views</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
