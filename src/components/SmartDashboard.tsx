import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileText,
  Upload,
  Search,
  Clock,
  Star,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface SmartDashboardProps {
  profile: any;
  applications: any[];
  profileCompletion: number;
}

type JourneyStage = "new" | "incomplete" | "ready" | "active" | "approved";

const SmartDashboard = ({ profile, applications, profileCompletion }: SmartDashboardProps) => {
  const navigate = useNavigate();

  // Determine user's journey stage
  const journeyStage = useMemo((): JourneyStage => {
    if (!profile || profileCompletion < 30) return "new";
    if (profileCompletion < 70) return "incomplete";
    if (applications.length === 0) return "ready";
    if (applications.some((a) => a.status === "approved")) return "approved";
    return "active";
  }, [profile, profileCompletion, applications]);

  // Smart suggestions based on journey stage
  const getSmartSuggestions = () => {
    switch (journeyStage) {
      case "new":
        return {
          title: "Welcome to ResKonnect! 🎉",
          subtitle: "Let's get you set up for your accommodation search",
          priority: "high",
          actions: [
            {
              icon: Upload,
              label: "Complete Your Profile",
              description: "Add your student details to start applying",
              path: "/profile",
              variant: "default" as const,
            },
          ],
          tip: "Students with complete profiles get 3x more responses from residences!",
        };
      case "incomplete":
        return {
          title: "Almost There! 📝",
          subtitle: `Your profile is ${profileCompletion}% complete`,
          priority: "medium",
          actions: [
            {
              icon: Upload,
              label: "Finish Your Profile",
              description: "Upload documents and add missing info",
              path: "/profile",
              variant: "default" as const,
            },
            {
              icon: Search,
              label: "Browse Residences",
              description: "Start exploring while you complete your profile",
              path: "/findmyres",
              variant: "outline" as const,
            },
          ],
          tip: "Add your student number and campus to see personalized recommendations!",
        };
      case "ready":
        return {
          title: "You're Ready to Apply! 🚀",
          subtitle: "Your profile is complete - start your accommodation search",
          priority: "success",
          actions: [
            {
              icon: Search,
              label: "Find Your Perfect Res",
              description: "Browse verified residences near your campus",
              path: "/findmyres",
              variant: "default" as const,
            },
            {
              icon: Star,
              label: "View NSFAS Residences",
              description: "See residences that accept NSFAS funding",
              path: "/findmyres?nsfas=true",
              variant: "outline" as const,
            },
          ],
          tip: "Pro tip: Use the compare tool to evaluate up to 3 residences side-by-side!",
        };
      case "active":
        const pendingCount = applications.filter((a) => a.status === "submitted").length;
        return {
          title: `${pendingCount} Application${pendingCount !== 1 ? "s" : ""} Pending ⏳`,
          subtitle: "Your applications are being reviewed",
          priority: "info",
          actions: [
            {
              icon: FileText,
              label: "Track Applications",
              description: "View status and updates",
              path: "/dashboard/applications",
              variant: "default" as const,
            },
            {
              icon: Search,
              label: "Apply to More",
              description: "Increase your chances with more applications",
              path: "/findmyres",
              variant: "outline" as const,
            },
          ],
          tip: "Most residences respond within 3-5 business days. Check your notifications!",
        };
      case "approved":
        return {
          title: "Congratulations! 🎊",
          subtitle: "You have an approved application!",
          priority: "success",
          actions: [
            {
              icon: FileText,
              label: "View Approval Details",
              description: "See next steps and contact info",
              path: "/dashboard/applications",
              variant: "default" as const,
            },
            {
              icon: Upload,
              label: "Upload Final Documents",
              description: "Submit any remaining required documents",
              path: "/profile",
              variant: "outline" as const,
            },
          ],
          tip: "Remember to confirm your spot and pay the deposit within the deadline!",
        };
    }
  };

  const smartData = getSmartSuggestions();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-destructive";
      case "medium":
        return "border-l-yellow-500";
      case "success":
        return "border-l-green-500";
      case "info":
        return "border-l-primary";
      default:
        return "border-l-muted";
    }
  };

  return (
    <Card className={`shadow-lg border-l-4 ${getPriorityColor(smartData.priority)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {smartData.title}
            </CardTitle>
            <CardDescription className="mt-1">{smartData.subtitle}</CardDescription>
          </div>
          {journeyStage === "active" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              In Progress
            </Badge>
          )}
          {journeyStage === "approved" && (
            <Badge className="flex items-center gap-1 bg-green-500">
              <CheckCircle2 className="w-3 h-3" />
              Approved
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(journeyStage === "new" || journeyStage === "incomplete") && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Profile Progress</span>
              <span className="font-medium">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-2" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {smartData.actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              className="flex-1 justify-start h-auto py-3"
              onClick={() => navigate(action.path)}
            >
              <action.icon className="w-5 h-5 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">{action.label}</div>
                <div className="text-xs opacity-80">{action.description}</div>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto shrink-0" />
            </Button>
          ))}
        </div>

        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{smartData.tip}</p>
        </div>

        {journeyStage === "active" && applications.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Application Status</span>
              <Link to="/dashboard/applications" className="text-primary hover:underline">
                View All
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <div className="text-lg font-bold text-yellow-600">
                  {applications.filter((a) => a.status === "submitted").length}
                </div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {applications.filter((a) => a.status === "approved").length}
                </div>
                <div className="text-xs text-muted-foreground">Approved</div>
              </div>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <div className="text-lg font-bold text-destructive">
                  {applications.filter((a) => a.status === "rejected").length}
                </div>
                <div className="text-xs text-muted-foreground">Declined</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SmartDashboard;