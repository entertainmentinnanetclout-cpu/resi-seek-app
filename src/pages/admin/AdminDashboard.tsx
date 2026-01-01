import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileText, ShoppingBag, Eye, TrendingUp, Clock, CheckCircle, AlertCircle, Package } from "lucide-react";
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
        
        // Log any errors from individual queries
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
          .select("*, residence:residences(name)")
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
    { icon: Building2, label: "Total Residences", value: stats.totalResidences, color: "text-primary", bgColor: "bg-primary/10" },
    { icon: Users, label: "Registered Users", value: stats.totalUsers, color: "text-green-500", bgColor: "bg-green-500/10" },
    { icon: ShoppingBag, label: "Marketplace Listings", value: stats.totalListings, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    { icon: Eye, label: "Total Page Views", value: stats.totalViews, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
  ];

  const alertStats = [
    { 
      icon: Clock, 
      label: "Pending Applications", 
      value: stats.pendingApplications, 
      color: "text-warning", 
      bgColor: "bg-warning/10",
      link: "/admin/applications",
      urgent: stats.pendingApplications > 0
    },
    { 
      icon: AlertCircle, 
      label: "Unverified Listings", 
      value: stats.unverifiedListings, 
      color: "text-destructive", 
      bgColor: "bg-destructive/10",
      link: "/admin/marketplace",
      urgent: stats.unverifiedListings > 0
    },
    { 
      icon: CheckCircle, 
      label: "Approved Applications", 
      value: stats.approvedApplications, 
      color: "text-success", 
      bgColor: "bg-success/10",
      link: "/admin/applications"
    },
    { 
      icon: FileText, 
      label: "Total Applications", 
      value: stats.totalApplications, 
      color: "text-blue-500", 
      bgColor: "bg-blue-500/10",
      link: "/admin/applications"
    },
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
      
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard Overview</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening on ResKonnect.
          </p>
        </div>

        {/* Alert Stats - Items needing attention */}
        {(stats.pendingApplications > 0 || stats.unverifiedListings > 0) && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                Items Requiring Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {alertStats.filter(s => s.urgent).map((stat, index) => (
                  <Link key={index} to={stat.link || "#"}>
                    <div className={`p-4 rounded-lg ${stat.bgColor} hover:opacity-80 transition-opacity cursor-pointer`}>
                      <div className="flex items-center gap-2 mb-2">
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        <span className={`text-2xl font-bold ${stat.color}`}>
                          {loading ? "..." : stat.value}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {mainStats.map((stat, index) => (
            <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className={`text-3xl font-bold ${stat.color}`}>
                      {loading ? "..." : stat.value.toLocaleString()}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {alertStats.map((stat, index) => (
            <Link key={index} to={stat.link || "#"}>
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className={`text-xl font-bold ${stat.color}`}>
                        {loading ? "..." : stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Applications */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Applications</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/applications">View All</Link>
                </Button>
              </div>
              <CardDescription>Latest student applications</CardDescription>
            </CardHeader>
            <CardContent>
              {recentApplications.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No applications yet</p>
              ) : (
                <div className="space-y-3">
                  {recentApplications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <div>
                        <p className="font-medium">{app.profile?.full_name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">{app.residence?.name}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(app.status)}`}>
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Link to="/admin/residences" className="p-4 border rounded-lg hover:bg-secondary transition-colors text-center">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Manage Residences</p>
                </Link>
                <Link to="/admin/applications" className="p-4 border rounded-lg hover:bg-secondary transition-colors text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm font-medium">Review Applications</p>
                </Link>
                <Link to="/admin/slides" className="p-4 border rounded-lg hover:bg-secondary transition-colors text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">Edit Hero Slides</p>
                </Link>
                <Link to="/admin/marketplace" className="p-4 border rounded-lg hover:bg-secondary transition-colors text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <p className="text-sm font-medium">Moderate Marketplace</p>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Content Overview</CardTitle>
            <CardDescription>Platform content statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-secondary/30 rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats.activeBursaries}</p>
                <p className="text-sm text-muted-foreground">Active Bursaries</p>
              </div>
              <div className="text-center p-4 bg-secondary/30 rounded-lg">
                <p className="text-2xl font-bold text-green-500">{stats.activeDiscounts}</p>
                <p className="text-sm text-muted-foreground">Student Discounts</p>
              </div>
              <div className="text-center p-4 bg-secondary/30 rounded-lg">
                <p className="text-2xl font-bold text-purple-500">{stats.totalListings}</p>
                <p className="text-sm text-muted-foreground">Marketplace Items</p>
              </div>
              <div className="text-center p-4 bg-secondary/30 rounded-lg">
                <p className="text-2xl font-bold text-cyan-500">{stats.totalViews}</p>
                <p className="text-sm text-muted-foreground">Page Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;