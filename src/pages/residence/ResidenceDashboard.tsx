import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { 
  Inbox, Clock, CheckCircle, XCircle, FileText, 
  TrendingUp, Users, AlertCircle, ArrowRight 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";

interface ResidenceContext {
  residence: { id: string; name: string } | null;
}

interface Stats {
  total: number;
  new: number;
  docsRequired: number;
  underReview: number;
  approved: number;
  declined: number;
  nsfasCount: number;
}

interface RecentApplication {
  id: string;
  status: string;
  funding_type: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

const ResidenceDashboard = () => {
  const navigate = useNavigate();
  const { residence } = useOutletContext<ResidenceContext>();
  const [stats, setStats] = useState<Stats>({
    total: 0, new: 0, docsRequired: 0, underReview: 0, approved: 0, declined: 0, nsfasCount: 0
  });
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!residence?.id) return;

    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch all applications for this residence
        const { data: applications, error } = await supabase
          .from('applications')
          .select('id, status, funding_type, created_at, user_id')
          .eq('residence_id', residence.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch profiles
        const userIds = [...new Set((applications || []).map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]));

        // Calculate stats
        const newStats: Stats = {
          total: applications?.length || 0,
          new: applications?.filter(a => a.status === 'new' || a.status === 'submitted').length || 0,
          docsRequired: applications?.filter(a => a.status === 'docs_required').length || 0,
          underReview: applications?.filter(a => a.status === 'under_review' || a.status === 'ready_for_review').length || 0,
          approved: applications?.filter(a => a.status === 'provisionally_approved' || a.status === 'approved').length || 0,
          declined: applications?.filter(a => a.status === 'declined' || a.status === 'rejected').length || 0,
          nsfasCount: applications?.filter(a => a.funding_type === 'nsfas').length || 0,
        };
        setStats(newStats);

        // Set recent applications (top 5) with profiles
        const recentApps = (applications || []).slice(0, 5).map(app => ({
          ...app,
          profiles: profileMap.get(app.user_id) || null
        }));
        setRecentApplications(recentApps as RecentApplication[]);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();

    // Subscribe to changes
    const channel = supabase
      .channel('residence-dashboard')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'applications',
          filter: `residence_id=eq.${residence.id}`
        },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [residence?.id]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'new': { label: 'New', variant: 'default' },
      'submitted': { label: 'Submitted', variant: 'default' },
      'docs_required': { label: 'Docs Required', variant: 'secondary' },
      'ready_for_review': { label: 'Ready', variant: 'outline' },
      'under_review': { label: 'Reviewing', variant: 'outline' },
      'provisionally_approved': { label: 'Approved', variant: 'default' },
      'approved': { label: 'Approved', variant: 'default' },
      'declined': { label: 'Declined', variant: 'destructive' },
      'rejected': { label: 'Rejected', variant: 'destructive' },
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const maskName = (name: string) => {
    if (!name) return 'Unknown';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return name;
  };

  if (!residence) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading residence information...</p>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`${residence.name} Dashboard | ResKonnect`}
        description="Manage your residence applications"
      />
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground">
            Here's an overview of your applications for {residence.name}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/residence/inbox')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border-orange-200 dark:border-orange-800" onClick={() => navigate('/residence/inbox?status=new')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">New Applications</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{isLoading ? '...' : stats.new}</div>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/residence/inbox?status=under_review')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Under Review</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.underReview}</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border-green-200 dark:border-green-800" onClick={() => navigate('/residence/inbox?status=approved')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{isLoading ? '...' : stats.approved}</div>
              <p className="text-xs text-muted-foreground">This period</p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">NSFAS Applications</CardTitle>
              <FileText className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.nsfasCount}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? `${Math.round((stats.nsfasCount / stats.total) * 100)}% of total` : '0%'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Docs Required</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.docsRequired}</div>
              <p className="text-xs text-muted-foreground">Awaiting documents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Declined</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.declined}</div>
              <p className="text-xs text-muted-foreground">This period</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Applications</CardTitle>
              <CardDescription>Latest applications received</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/residence/inbox')}>
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : recentApplications.length === 0 ? (
              <p className="text-muted-foreground">No applications yet</p>
            ) : (
              <div className="space-y-4">
                {recentApplications.map((app) => (
                  <div 
                    key={app.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/residence/application/${app.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{maskName(app.profiles?.full_name || 'Unknown')}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(app.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {app.funding_type === 'nsfas' && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                          NSFAS
                        </Badge>
                      )}
                      {getStatusBadge(app.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button onClick={() => navigate('/residence/inbox?status=new')}>
              <AlertCircle className="mr-2 h-4 w-4" />
              Review New Applications ({stats.new})
            </Button>
            <Button variant="outline" onClick={() => navigate('/residence/inbox?status=docs_required')}>
              <FileText className="mr-2 h-4 w-4" />
              Pending Documents ({stats.docsRequired})
            </Button>
            <Button variant="outline" onClick={() => navigate('/residence/analytics')}>
              <TrendingUp className="mr-2 h-4 w-4" />
              View Analytics
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ResidenceDashboard;
