import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, FileText, Search, User, X, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import HeroCarousel from "@/components/HeroCarousel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";
import { useRealtimeApplications } from "@/hooks/useRealtimeApplications";
import { useState, useMemo } from "react";
import heroAccommodation from "@/assets/hero-accommodation.jpg";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useRealtimeProfile(user);
  const { applications, loading: applicationsLoading } = useRealtimeApplications(user);
  const [showFabMenu, setShowFabMenu] = useState(false);

  const profileCompletion = useMemo(() => {
      if (!profile) return 0;
      const fields = [
          { name: 'full_name', weight: 20 },
          { name: 'student_number', weight: 20 },
          { name: 'phone', weight: 15 },
          { name: 'campus', weight: 15 },
          { name: 'course', weight: 10 },
          { name: 'year_of_study', weight: 10 },
          { name: 'id_copy_status', weight: 5 },
          { name: 'proof_of_registration_status', weight: 5 },
      ];
      const completedValue = fields.reduce((acc, field) => {
          if (profile[field.name] && profile[field.name] !== '') {
              return acc + field.weight;
          }
          return acc;
      }, 0);
      return Math.round(completedValue);
  }, [profile]);

  const profileIsComplete = profileCompletion >= 90;

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
  ];

  const quickLinks = [
        {
            icon: User,
            title: "My Profile",
            description: "Keep your details and documents up-to-date.",
            gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
            path: "/dashboard/profile",
            action: () => navigate("/dashboard/profile"),
        },
        {
            icon: Search,
            title: "Find Accommodation",
            description: "Browse and apply to 100+ verified residences.",
            gradient: "bg-gradient-to-br from-green-500 to-teal-600",
            path: "/findmyres",
            action: () => navigate("/findmyres"),
        },
        {
            icon: FileText,
            title: "Track Applications",
            description: "Check the status of all your applications.",
            gradient: "bg-gradient-to-br from-purple-500 to-pink-600",
            path: "/dashboard/applications",
            action: () => navigate("/dashboard/applications"),
        },
  ];

  const fabActions = [
      { icon: Search, label: 'Apply', action: () => navigate('/findmyres') },
      { icon: FileText, label: 'Track', action: () => navigate('/dashboard/applications') },
      { icon: User, label: 'Profile', action: () => navigate('/dashboard/profile') },
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
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <HeroCarousel slides={carouselSlides} autoPlay={true} interval={6000} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <Card className="shadow-lg border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="text-2xl">Application Status</CardTitle>
                    <CardDescription>
                      You have {applications.length} active application{applications.length !== 1 && 's'}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {applications.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span>Pending: {applications.filter(a => a.status === 'submitted').length}</span>
                                <span>Approved: {applications.filter(a => a.status === 'approved').length}</span>
                                <span>Rejected: {applications.filter(a => a.status === 'rejected').length}</span>
                            </div>
                            <Progress value={(applications.filter(a => a.status !== 'submitted').length / applications.length) * 100} />
                            <Button onClick={() => navigate('/dashboard/applications')}>View All Applications</Button>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-muted-foreground mb-4">You haven't applied anywhere yet.</p>
                            <Button onClick={() => navigate('/findmyres')}>Browse Residences</Button>
                        </div>
                    )}
                  </CardContent>
                </Card>
            </div>
            
            <div className="lg:col-span-1">
              <Card className="shadow-lg border-l-4 border-l-accent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    Profile Status
                    {profileIsComplete ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-yellow-500" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {profileIsComplete
                      ? "Your profile is ready for applications."
                      : "Complete your profile to start applying."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Progress value={profileCompletion} className="flex-1 h-3" />
                    <span className="text-lg font-bold text-accent">{profileCompletion}%</span>
                  </div>
                   {!profileIsComplete && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate("/dashboard/profile")}
                        className="w-full mt-4"
                      >
                        Complete Profile
                      </Button>
                    )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                  <div
                      key={link.path}
                      className={`relative overflow-hidden rounded-lg shadow-lg transform transition-transform hover:scale-105 active:scale-95 cursor-pointer ${link.gradient} text-white p-6 flex flex-col justify-between h-40`}
                      onClick={link.action}>
                      <div className="flex items-center gap-4">
                          <link.icon className="w-8 h-8 shrink-0" />
                          <div>
                              <h3 className="text-xl font-bold">{link.title}</h3>
                              <p className="text-sm opacity-90">{link.description}</p>
                          </div>
                      </div>
                  </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      
      <div className="md:hidden fixed bottom-6 right-6 z-50">
          {showFabMenu && (
              <div className="flex flex-col items-center gap-3 mb-3">
                  {fabActions.map((fab, index) => (
                      <div key={index} className="flex items-center gap-2">
                          <span className="bg-card text-card-foreground text-sm py-1 px-3 rounded-lg shadow-md">{fab.label}</span>
                          <Button onClick={fab.action} size="icon" className="rounded-full shadow-lg bg-secondary text-secondary-foreground">
                              <fab.icon className="w-5 h-5"/>
                          </Button>
                      </div>
                  ))}
              </div>
          )}
          <Button
              onClick={() => setShowFabMenu(!showFabMenu)}
              className="rounded-full shadow-lg w-16 h-16 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform">
              {showFabMenu ? <X className="w-7 h-7" /> : <Plus className="w-7 h-7" />}
          </Button>
      </div>

    </DashboardLayout>
  );
};

export default Dashboard;
