import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileText, ShoppingBag, Eye, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalResidences: 0,
    totalApplications: 0,
    pendingApplications: 0,
    totalUsers: 0,
    totalListings: 0,
    totalViews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [residences, applications, profiles, listings, analytics] = await Promise.all([
          supabase.from("residences").select("id", { count: "exact", head: true }),
          supabase.from("applications").select("id, status", { count: "exact" }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("marketplace_listings").select("id", { count: "exact", head: true }),
          supabase.from("residence_analytics").select("id", { count: "exact", head: true }),
        ]);

        const pendingCount = applications.data?.filter(a => a.status === "submitted" || a.status === "pending").length || 0;

        setStats({
          totalResidences: residences.count || 0,
          totalApplications: applications.count || 0,
          pendingApplications: pendingCount,
          totalUsers: profiles.count || 0,
          totalListings: listings.count || 0,
          totalViews: analytics.count || 0,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { icon: Building2, label: "Total Residences", value: stats.totalResidences, color: "text-primary" },
    { icon: FileText, label: "Total Applications", value: stats.totalApplications, color: "text-blue-500" },
    { icon: FileText, label: "Pending Review", value: stats.pendingApplications, color: "text-warning" },
    { icon: Users, label: "Registered Users", value: stats.totalUsers, color: "text-green-500" },
    { icon: ShoppingBag, label: "Marketplace Listings", value: stats.totalListings, color: "text-purple-500" },
    { icon: Eye, label: "Total Page Views", value: stats.totalViews, color: "text-cyan-500" },
  ];

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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {statCards.map((stat, index) => (
            <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className={`text-3xl font-bold ${stat.color}`}>
                      {loading ? "..." : stat.value.toLocaleString()}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full bg-secondary ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <a href="/admin/residences" className="p-4 border rounded-lg hover:bg-secondary transition-colors text-center">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Manage Residences</p>
              </a>
              <a href="/admin/applications" className="p-4 border rounded-lg hover:bg-secondary transition-colors text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-sm font-medium">Review Applications</p>
              </a>
              <a href="/admin/slides" className="p-4 border rounded-lg hover:bg-secondary transition-colors text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm font-medium">Edit Hero Slides</p>
              </a>
              <a href="/admin/bursaries" className="p-4 border rounded-lg hover:bg-secondary transition-colors text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-sm font-medium">Manage Bursaries</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
