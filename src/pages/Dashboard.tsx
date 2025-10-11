import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, FileText, Search, User, TrendingUp, Newspaper, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import QuickActionCard from "@/components/QuickActionCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const Dashboard = () => {
  const navigate = useNavigate();
  
  // Mock data - TODO: Replace with actual data from backend
  const profileCompletion = 100;
  const activeApplications = 2;
  const profileComplete = profileCompletion === 100;

  const quickLinks = [
    {
      icon: Search,
      title: "Find Residences",
      description: "Browse available accommodation",
      gradient: "bg-gradient-primary",
      path: "/findmyres"
    },
    {
      icon: Newspaper,
      title: "Campus News",
      description: "Latest stories and opportunities",
      gradient: "bg-gradient-accent",
      path: "/campus-news"
    },
    {
      icon: FileText,
      title: "My Applications",
      description: "Track your residence applications",
      gradient: "bg-gradient-secondary",
      path: "/dashboard/applications"
    },
    {
      icon: User,
      title: "My Profile",
      description: "Update your information",
      gradient: "bg-gradient-dark",
      path: "/dashboard/profile"
    }
  ];

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Welcome Section */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 md:p-12 text-white shadow-premium">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />
            <div className="relative flex items-center gap-4">
              <Sparkles className="w-12 h-12 animate-float" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Welcome Back!</h1>
                <p className="text-white/90 text-lg">
                  Here's your ResKonnect dashboard overview
                </p>
              </div>
            </div>
          </div>

          {/* Profile Status */}
          <Card className="shadow-card border-l-4 border-l-primary overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <CardHeader className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    Profile Status
                    {profileComplete ? (
                      <CheckCircle2 className="w-6 h-6 text-success" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-warning" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    {profileComplete 
                      ? "Your profile is complete and you can apply for residences" 
                      : "Complete your profile to start applying"}
                  </CardDescription>
                </div>
                {!profileComplete && (
                  <Button 
                    variant="premium" 
                    size="lg"
                    onClick={() => navigate("/setup-profile")}
                  >
                    Complete Profile
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex items-center gap-4">
                <Progress value={profileCompletion} className="flex-1 h-3" />
                <span className="text-lg font-bold text-primary">{profileCompletion}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-3 gap-6">
            <StatCard
              icon={FileText}
              value={activeApplications}
              label="Active Applications"
              gradient="bg-gradient-primary"
              trend={{ value: "2 new", positive: true }}
            />
            <StatCard
              icon={Search}
              value={24}
              label="Available Residences"
              gradient="bg-gradient-secondary"
            />
            <StatCard
              icon={TrendingUp}
              value={0}
              label="Unread Messages"
              gradient="bg-gradient-accent"
            />
          </div>

          {/* Explore Opportunities Banner */}
          <Card className="bg-gradient-accent text-white shadow-premium border-0 overflow-hidden group cursor-pointer" onClick={() => navigate("/campus-news")}>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />
            <CardContent className="p-8 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <Newspaper className="w-16 h-16 group-hover:scale-110 transition-transform" />
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Explore Campus Opportunities</h3>
                    <p className="text-white/90">Latest news, student jobs, and campus events</p>
                  </div>
                </div>
                <Button variant="outline" size="lg" className="bg-white text-primary hover:bg-white/90">
                  Explore Now
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div>
            <h2 className="text-3xl font-bold mb-6 font-display">Quick Actions</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickLinks.map((link) => (
                <QuickActionCard
                  key={link.path}
                  icon={link.icon}
                  title={link.title}
                  description={link.description}
                  gradient={link.gradient}
                  onClick={() => navigate(link.path)}
                />
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-2xl">Recent Activity</CardTitle>
              <CardDescription>Your latest actions and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4 pb-4 border-b last:border-0 group hover:bg-primary/5 -mx-2 px-2 py-2 rounded-lg transition-colors">
                  <div className="w-3 h-3 bg-gradient-primary rounded-full mt-2 group-hover:scale-125 transition-transform shadow-glow" />
                  <div className="flex-1">
                    <p className="font-semibold">Application submitted</p>
                    <p className="text-sm text-muted-foreground">You applied to Campus Heights Residence</p>
                    <p className="text-xs text-muted-foreground mt-1">2 days ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 pb-4 border-b last:border-0 group hover:bg-primary/5 -mx-2 px-2 py-2 rounded-lg transition-colors">
                  <div className="w-3 h-3 bg-gradient-secondary rounded-full mt-2 group-hover:scale-125 transition-transform shadow-glow" />
                  <div className="flex-1">
                    <p className="font-semibold">Profile updated</p>
                    <p className="text-sm text-muted-foreground">Your profile is now 100% complete</p>
                    <p className="text-xs text-muted-foreground mt-1">1 week ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
