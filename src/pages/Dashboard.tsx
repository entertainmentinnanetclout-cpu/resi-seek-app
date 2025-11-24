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
          .maybeSingle();

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
  
  const profileIsComplete = 
    profileData?.full_name &&
    profileData?.student_number &&
    profileData?.phone &&
    profileData?.campus &&
    profileData?.course &&
    profileData?.year_of_study;

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
            icon: User,
            title: "Complete Profile",
            description: "Finish your profile to apply for housing.",
            gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
            path: "/dashboard/profile",
            action: () => navigate("/dashboard/profile"),
        },
        {
            icon: Search,
            title: "Apply for Accommodation",
            description: "Browse and apply to residences.",
            gradient: "bg-gradient-to-br from-green-500 to-teal-600",
            path: "/findmyres",
            action: () => navigate("/findmyres"),
        },
        {
            icon: FileText,
            title: "Track Applications",
            description: "Check the status of your applications.",
            gradient: "bg-gradient-to-br from-purple-500 to-pink-600",
            path: "/dashboard/applications",
            action: () => navigate("/dashboard/applications"),
        },
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
          <Card className="shadow-card border-l-4 border-l-accent overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
            <CardHeader className="relative">
              <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl text-card-foreground">
                    Profile Status
                    {profileIsComplete ? (
                      <CheckCircle2 className="w-6 h-6 text-success" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-warning" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    {profileIsComplete
                      ? "Your profile is complete and you can apply for residences" 
                      : "Complete your profile to start applying"}
                  </CardDescription>
                </div>
                {!profileIsComplete && (
                  <Button 
                    variant="premium" 
                    size="lg"
                    onClick={() => navigate("/dashboard/profile")}
                    className="w-full md:w-auto"
                  >
                    Complete Profile
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex items-center gap-4">
                <Progress value={profileCompletion} className="flex-1 h-3" />
                <span className="text-lg font-bold text-accent">{profileCompletion}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div>
            <h2 className="text-3xl font-bold mb-6 font-display text-foreground">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                  <div
                      key={link.path}
                      className={`relative overflow-hidden rounded-lg shadow-lg transform transition-transform hover:scale-105 active:scale-95 cursor-pointer ${link.gradient} text-white p-6 flex flex-col justify-between`}
                      onClick={link.action}>
                      <div className="flex items-center gap-4">
                          <link.icon className="w-8 h-8" />
                          <div>
                              <h3 className="text-xl font-bold">{link.title}</h3>
                              <p className="text-sm opacity-80">{link.description}</p>
                          </div>
                      </div>
                  </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      <div className="md:hidden fixed bottom-4 right-4 z-50">
          <Button
              onClick={() => navigate("/findmyres")}
              className="rounded-full shadow-lg text-lg px-6 py-6 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform">
              Apply Now
          </Button>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
