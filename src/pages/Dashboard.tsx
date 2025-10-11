import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, ArrowRight, FileText, Search, User } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
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
      path: "/findmyres",
      variant: "default" as const
    },
    {
      icon: FileText,
      title: "My Applications",
      description: "Track your residence applications",
      path: "/dashboard/applications",
      variant: "outline" as const
    },
    {
      icon: User,
      title: "My Profile",
      description: "Update your information",
      path: "/dashboard/profile",
      variant: "outline" as const
    }
  ];

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Welcome Section */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome Back!</h1>
            <p className="text-muted-foreground">
              Here's an overview of your ResKonnect account
            </p>
          </div>

          {/* Profile Status */}
          <Card className="shadow-card border-l-4 border-l-primary">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Profile Status
                    {profileComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-warning" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {profileComplete 
                      ? "Your profile is complete and you can apply for residences" 
                      : "Complete your profile to start applying"}
                  </CardDescription>
                </div>
                {!profileComplete && (
                  <Button 
                    variant="accent" 
                    size="sm"
                    onClick={() => navigate("/setup-profile")}
                  >
                    Complete Profile
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Progress value={profileCompletion} className="flex-1" />
                <span className="text-sm font-medium">{profileCompletion}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {activeApplications}
                  </div>
                  <p className="text-sm text-muted-foreground">Active Applications</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">
                    24
                  </div>
                  <p className="text-sm text-muted-foreground">Available Residences</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">
                    0
                  </div>
                  <p className="text-sm text-muted-foreground">Unread Messages</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Quick Links</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Card 
                    key={link.path}
                    className="shadow-card hover:shadow-hover transition-smooth cursor-pointer"
                    onClick={() => navigate(link.path)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold mb-1">{link.title}</h3>
                          <p className="text-sm text-muted-foreground">{link.description}</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest actions and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="font-medium">Application submitted</p>
                    <p className="text-sm text-muted-foreground">You applied to Campus Heights Residence</p>
                    <p className="text-xs text-muted-foreground mt-1">2 days ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="font-medium">Profile updated</p>
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
