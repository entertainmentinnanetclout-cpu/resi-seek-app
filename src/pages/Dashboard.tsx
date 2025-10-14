import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, FileText, Search, User, TrendingUp, Newspaper, ShoppingBag } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import QuickActionCard from "@/components/QuickActionCard";
import HeroCarousel from "@/components/HeroCarousel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import heroAccommodation from "@/assets/hero-accommodation.jpg";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [profileData, setProfileData] = useState<any>(null);
  const [listingsCount, setListingsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Fetch profile data
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setProfileData(profile);

        // Fetch user's marketplace listings count
        const { count } = await supabase
          .from("marketplace_listings")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        setListingsCount(count || 0);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  // Calculate profile completion
  const profileCompletion = profileData
    ? Math.round(
        (Object.values(profileData).filter(
          (val) => val !== null && val !== ""
        ).length /
          Object.keys(profileData).length) *
          100
      )
    : 0;
  
  const profileComplete = profileCompletion === 100;

  // Carousel slides for marketing
  const carouselSlides = [
    {
      image: heroAccommodation,
      title: "Find Your Perfect Res",
      description: "Discover comfortable, affordable student accommodation near your campus",
      cta: {
        text: "Browse Residences",
        action: () => navigate("/findmyres")
      }
    },
    {
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=600&fit=crop",
      title: "Student Grocery Discounts",
      description: "Save up to 30% on grocery hampers specially curated for students",
      cta: {
        text: "Get Discounts",
        action: () => navigate("/campus-news")
      }
    },
    {
      image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=600&fit=crop",
      title: "Promote Your Products",
      description: "List your items on our marketplace and reach thousands of students",
      cta: {
        text: "Create Listing",
        action: () => navigate("/marketplace")
      }
    }
  ];

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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 md:p-8 flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Hero Carousel */}
          <HeroCarousel slides={carouselSlides} autoPlay={true} interval={6000} />

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
              icon={ShoppingBag}
              value={listingsCount}
              label="My Marketplace Listings"
              gradient="bg-gradient-primary"
            />
            <StatCard
              icon={Search}
              value={profileCompletion}
              label="Profile Completion"
              gradient="bg-gradient-secondary"
              trend={
                profileComplete
                  ? { value: "Complete", positive: true }
                  : undefined
              }
            />
            <StatCard
              icon={Newspaper}
              value="Live"
              label="Campus Updates"
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

        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
