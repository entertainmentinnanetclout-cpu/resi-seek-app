import SEO from "@/components/SEO";
import { useNavigate, Link } from "react-router-dom";
import { Search, User, X, Plus, FileText, Heart, ShoppingBag, GraduationCap } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import HeroCarousel from "@/components/HeroCarousel";
import SmartDashboard from "@/components/SmartDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";
import { useRealtimeApplications } from "@/hooks/useRealtimeApplications";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";
import { useState, useMemo } from "react";
import heroAccommodation from "@/assets/hero-accommodation.jpg";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const shouldBlock = useAdminRedirect();
  const { profile, loading: profileLoading } = useRealtimeProfile(user);
  const { applications, loading: applicationsLoading } = useRealtimeApplications(user);
  const [showFabMenu, setShowFabMenu] = useState(false);

  if (shouldBlock) return null;

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      { name: "full_name", weight: 20 },
      { name: "student_number", weight: 20 },
      { name: "phone", weight: 15 },
      { name: "campus", weight: 15 },
      { name: "course", weight: 10 },
      { name: "year_of_study", weight: 10 },
      { name: "id_copy_status", weight: 5 },
      { name: "proof_of_registration_status", weight: 5 },
    ];
    const completedValue = fields.reduce((acc, field) => {
      if (profile[field.name] && profile[field.name] !== "") {
        return acc + field.weight;
      }
      return acc;
    }, 0);
    return Math.round(completedValue);
  }, [profile]);

  const carouselSlides = [
    {
      image: heroAccommodation,
      title: "Find Your Perfect Res",
      description: "Discover comfortable, affordable student accommodation near your campus",
      cta: {
        text: "Browse Residences",
        action: () => navigate("/findmyres"),
      },
    },
    {
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=600&fit=crop",
      title: "Student Grocery Discounts",
      description: "Save up to 30% on grocery hampers specially curated for students",
      cta: {
        text: "Get Discounts",
        action: () => navigate("/discounts"),
      },
    },
  ];

  const quickLinks = [
    {
      icon: Search,
      title: "Find Accommodation",
      description: "Browse verified residences near your campus",
      gradient: "bg-gradient-to-br from-green-500 to-teal-600",
      path: "/findmyres",
    },
    {
      icon: FileText,
      title: "My Applications",
      description: "Track your application status",
      gradient: "bg-gradient-to-br from-purple-500 to-pink-600",
      path: "/applications",
    },
    {
      icon: User,
      title: "My Profile",
      description: "Update your details and documents",
      gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
      path: "/profile",
    },
    {
      icon: Heart,
      title: "Favorites",
      description: "View saved residences",
      gradient: "bg-gradient-to-br from-rose-500 to-red-600",
      path: "/favorites",
    },
    {
      icon: ShoppingBag,
      title: "Marketplace",
      description: "Buy and sell student essentials",
      gradient: "bg-gradient-to-br from-orange-500 to-amber-600",
      path: "/marketplace",
    },
    {
      icon: GraduationCap,
      title: "Bursaries",
      description: "Find funding opportunities",
      gradient: "bg-gradient-to-br from-cyan-500 to-blue-600",
      path: "/bursaries",
    },
  ];

  const fabActions = [
    { icon: Search, label: "Apply", action: () => navigate("/findmyres") },
    { icon: FileText, label: "Track", action: () => navigate("/applications") },
    { icon: User, label: "Profile", action: () => navigate("/profile") },
  ];

  const loading = profileLoading || applicationsLoading;

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
      <SEO
        title="Student Dashboard | Manage Your Accommodation | ResKonnect"
        description="Track your residence applications, manage your profile and documents, and stay connected with landlords on ResKonnect."
        keywords="student dashboard, accommodation tracker, residence application status"
      />
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Hero Carousel */}
          <HeroCarousel slides={carouselSlides} autoPlay={true} interval={6000} />

          {/* Smart Dashboard - Contextual Section */}
          <SmartDashboard
            profile={profile}
            applications={applications}
            profileCompletion={profileCompletion}
          />

          {/* Quick Actions Grid */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                <Link to={link.path} key={link.path}>
                  <div
                    className={`relative overflow-hidden rounded-xl shadow-lg transform transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ${link.gradient} text-white p-4 sm:p-5 flex flex-col justify-between h-28 sm:h-32`}
                  >
                    <div className="flex items-start gap-3">
                      <link.icon className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
                      <div>
                        <h3 className="text-sm sm:text-base font-bold leading-tight">{link.title}</h3>
                        <p className="text-xs sm:text-sm opacity-90 mt-0.5 line-clamp-2">{link.description}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* SEO Text Block */}
          <Card className="bg-card/50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-2">Your Student Accommodation Hub</h3>
              <p className="text-muted-foreground text-sm">
                The ResKonnect dashboard is designed to simplify student housing. Track your applications, manage documents, and stay updated on communication from landlords, all in one place. Our AI-powered ResBot is available 24/7 to answer your questions about accommodation, NSFAS, and more.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile FAB Menu */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        {showFabMenu && (
          <div className="flex flex-col items-center gap-3 mb-3">
            {fabActions.map((fab, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="bg-card text-card-foreground text-sm py-1 px-3 rounded-lg shadow-md">
                  {fab.label}
                </span>
                <Button
                  onClick={fab.action}
                  size="icon"
                  className="rounded-full shadow-lg bg-secondary text-secondary-foreground"
                >
                  <fab.icon className="w-5 h-5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button
          onClick={() => setShowFabMenu(!showFabMenu)}
          className="rounded-full shadow-lg w-14 h-14 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform"
        >
          {showFabMenu ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
