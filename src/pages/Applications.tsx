import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeApplications } from "@/hooks/useRealtimeApplications";
import { supabase } from "@/integrations/supabase/client";

// Applications page - view all residence applications
const Applications = () => {
  const { user } = useAuth();
  const { applications, loading: applicationsLoading, error } = useRealtimeApplications(user);
  const [detailedApplications, setDetailedApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">My Applications</h1>
            <p className="text-muted-foreground">
              Track your residence applications and their status
            </p>
          </div>

          {/* Applications List */}
          {loading ? (
            <p>Loading applications...</p>
          ) : detailedApplications.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Eye className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Applications Yet</h3>
                <p className="text-muted-foreground mb-6">
                  You haven't applied to any residences yet. Start browsing to find your perfect accommodation!
                </p>
                <Button variant="default">Find Residences</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {detailedApplications.map((application) => (
                <Card key={application.id} className="shadow-card hover:shadow-hover transition-smooth">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{application.residence?.name}</CardTitle>
                        <CardDescription>{application.residence?.address}</CardDescription>
                      </div>
                      {getStatusBadge(application.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Price</p>
                        <p className="font-semibold">
                          R{typeof application.residence?.price === 'number' ? application.residence.price.toLocaleString() : application.residence?.price}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Application Date</p>
                        <p className="font-semibold">
                          {new Date(application.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm">{application.notes ?? 'No notes provided'}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Applications;
