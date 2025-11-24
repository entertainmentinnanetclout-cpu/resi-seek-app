import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, Eye, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeApplications } from "@/hooks/useRealtimeApplications";
import { supabase } from "@/integrations/supabase/client";

const Applications = () => {
  const { user } = useAuth();
  const { applications, loading: applicationsLoading, error } = useRealtimeApplications(user);
  const [detailedApplications, setDetailedApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchDetails = async () => {
      if (applicationsLoading || !applications.length) {
        setLoading(applicationsLoading);
        if (!applications.length) setDetailedApplications([]);
        return;
      }

      setLoading(true);
      const residenceIds = applications.map(app => app.residence_id);
      const { data: residences, error: resError } = await supabase
        .from('residences')
        .select('*')
        .in('id', residenceIds);

      if (resError) {
        console.error("Error fetching residence details:", resError);
        setLoading(false);
        return;
      }

      const detailed = applications.map(app => {
        const residence = residences.find(res => res.id === app.residence_id);
        return { ...app, residence };
      });

      setDetailedApplications(detailed);
      setLoading(false);
    };

    fetchDetails();
  }, [applications, applicationsLoading]);

  const filteredApplications = detailedApplications.filter(app => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm ? app.residence?.name.toLowerCase().includes(searchTermLower) : true;
      const matchesFilter = statusFilter !== "all" ? app.status === statusFilter : true;
      return matchesSearch && matchesFilter;
  });

  const getStatusProps = (status: string) => {
    switch (status) {
      case "submitted": return { Icon: Clock, color: "yellow", label: "Pending", step: 1 };
      case "approved": return { Icon: CheckCircle2, color: "green", label: "Approved", step: 2 };
      case "rejected": return { Icon: XCircle, color: "red", label: "Rejected", step: 2 };
      default: return { Icon: Clock, color: "gray", label: "Unknown", step: 0 };
    }
  };

  const ApplicationCard = ({ application }: { application: any }) => {
      const { Icon, color, label, step } = getStatusProps(application.status);
      const steps = ["Submitted", "Decision"];
      return (
        <Card className={`bg-surface shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-${color}-500`}>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-foreground">{application.residence?.name}</CardTitle>
                        <CardDescription>{application.residence?.address}</CardDescription>
                    </div>
                    <Badge variant="outline" className={`border-${color}-500/50 bg-${color}-500/10 text-${color}-700`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                        {steps.map((s, i) => <span key={i} className={i + 1 <= step ? `text-${color}-600 font-semibold` : ""}>{s}</span>)}
                    </div>
                    <div className="relative w-full h-1 bg-gray-200 rounded-full">
                        <div className={`absolute top-0 left-0 h-1 bg-${color}-500 rounded-full transition-all duration-500`} style={{ width: `${step / steps.length * 100}%` }}></div>
                    </div>
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                    {/* ... content ... */}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                    <Button variant="outline">View Details</Button>
                </div>
            </CardContent>
        </Card>
      )
  }

  const SkeletonLoader = () => (
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-surface shadow-sm animate-pulse">
                <CardHeader><div className="h-6 bg-gray-300 rounded w-3/4"></div><div className="h-4 mt-2 bg-gray-300 rounded w-1/2"></div></CardHeader>
                <CardContent><div className="h-10 bg-gray-300 rounded"></div><div className="mt-4 pt-4 border-t h-8 bg-gray-300 rounded w-24"></div></CardContent>
            </Card>
        ))}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 bg-background">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-foreground">My Applications</h1>
            <p className="text-muted-foreground">Track your residence applications and their status</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input placeholder="Search by residence name..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex gap-2">
                  <Button variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}><Filter className="w-4 h-4 mr-2"/>All</Button>
                  <Button variant={statusFilter === "submitted" ? "default" : "outline"} onClick={() => setStatusFilter("submitted")}>Pending</Button>
                  <Button variant={statusFilter === "approved" ? "default" : "outline"} onClick={() => setStatusFilter("approved")}>Approved</Button>
                  <Button variant={statusFilter === "rejected" ? "default" : "outline"} onClick={() => setStatusFilter("rejected")}>Rejected</Button>
              </div>
          </div>
          {loading ? <SkeletonLoader /> : filteredApplications.length === 0 ? (
            <Card className="bg-surface shadow-sm text-center py-12">
              <Eye className="w-12 h-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Applications Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">Your search or filter returned no results.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredApplications.map((application) => <ApplicationCard key={application.id} application={application} />)}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Applications;
