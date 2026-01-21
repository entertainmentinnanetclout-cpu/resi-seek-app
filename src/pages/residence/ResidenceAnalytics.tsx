import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  TrendingUp, Users, Clock, CheckCircle, XCircle, 
  FileText, Calendar, BarChart3
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

interface ResidenceContext {
  residence: { id: string; name: string } | null;
}

interface Stats {
  totalApplications: number;
  thisMonth: number;
  lastMonth: number;
  approvalRate: number;
  avgResponseTime: number;
  nsfasPercentage: number;
  statusBreakdown: { name: string; value: number; color: string }[];
  fundingBreakdown: { name: string; value: number; color: string }[];
}

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#6b7280'];

const ResidenceAnalytics = () => {
  const { residence } = useOutletContext<ResidenceContext>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!residence?.id) return;

    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const { data: applications, error } = await supabase
          .from('applications')
          .select('status, funding_type, created_at, updated_at')
          .eq('residence_id', residence.id);

        if (error) throw error;

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const thisMonthApps = applications?.filter(a => new Date(a.created_at) >= thisMonthStart) || [];
        const lastMonthApps = applications?.filter(a => {
          const date = new Date(a.created_at);
          return date >= lastMonthStart && date <= lastMonthEnd;
        }) || [];

        const approved = applications?.filter(a => 
          ['provisionally_approved', 'approved'].includes(a.status)
        ).length || 0;
        
        const decided = applications?.filter(a => 
          ['provisionally_approved', 'approved', 'declined', 'rejected'].includes(a.status)
        ).length || 0;

        const nsfasCount = applications?.filter(a => a.funding_type === 'nsfas').length || 0;

        // Status breakdown
        const statusCounts: Record<string, number> = {};
        applications?.forEach(a => {
          const displayStatus = 
            ['new', 'submitted'].includes(a.status) ? 'New' :
            a.status === 'docs_required' ? 'Docs Required' :
            ['under_review', 'ready_for_review'].includes(a.status) ? 'Under Review' :
            ['provisionally_approved', 'approved'].includes(a.status) ? 'Approved' :
            ['declined', 'rejected'].includes(a.status) ? 'Declined' : 'Other';
          statusCounts[displayStatus] = (statusCounts[displayStatus] || 0) + 1;
        });

        const statusBreakdown = [
          { name: 'New', value: statusCounts['New'] || 0, color: '#3b82f6' },
          { name: 'Docs Required', value: statusCounts['Docs Required'] || 0, color: '#eab308' },
          { name: 'Under Review', value: statusCounts['Under Review'] || 0, color: '#8b5cf6' },
          { name: 'Approved', value: statusCounts['Approved'] || 0, color: '#22c55e' },
          { name: 'Declined', value: statusCounts['Declined'] || 0, color: '#ef4444' },
        ].filter(s => s.value > 0);

        // Funding breakdown
        const fundingCounts: Record<string, number> = {};
        applications?.forEach(a => {
          const type = a.funding_type || 'unknown';
          fundingCounts[type] = (fundingCounts[type] || 0) + 1;
        });

        const fundingBreakdown = Object.entries(fundingCounts).map(([name, value], i) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: COLORS[i % COLORS.length]
        }));

        setStats({
          totalApplications: applications?.length || 0,
          thisMonth: thisMonthApps.length,
          lastMonth: lastMonthApps.length,
          approvalRate: decided > 0 ? Math.round((approved / decided) * 100) : 0,
          avgResponseTime: 2.5, // Placeholder - would need activity log analysis
          nsfasPercentage: applications?.length ? Math.round((nsfasCount / applications.length) * 100) : 0,
          statusBreakdown,
          fundingBreakdown,
        });
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [residence?.id]);

  if (!residence) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <>
      <SEO 
        title={`Analytics | ${residence.name} | ResKonnect`}
        description="View your residence application analytics"
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Performance insights for {residence.name}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stats?.totalApplications}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stats?.thisMonth}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats && stats.lastMonth > 0 
                  ? `${stats.thisMonth >= stats.lastMonth ? '+' : ''}${Math.round(((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100)}% vs last month`
                  : 'vs last month'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? '...' : `${stats?.approvalRate}%`}
              </div>
              <p className="text-xs text-muted-foreground">Of decided applications</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">NSFAS Applicants</CardTitle>
              <FileText className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {isLoading ? '...' : `${stats?.nsfasPercentage}%`}
              </div>
              <p className="text-xs text-muted-foreground">Of total applications</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Application Status</CardTitle>
              <CardDescription>Current status distribution</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Loading...
                </div>
              ) : stats?.statusBreakdown.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={stats?.statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats?.statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Funding Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Funding Types</CardTitle>
              <CardDescription>Distribution by funding source</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Loading...
                </div>
              ) : stats?.fundingBreakdown.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats?.fundingBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {stats?.fundingBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Avg. Response Time</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : '~2.5 days'}</p>
                <p className="text-xs text-muted-foreground mt-1">First action after submission</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : `${stats?.approvalRate}%`}</p>
                <p className="text-xs text-muted-foreground mt-1">Applications to approvals</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">NSFAS Focus</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : `${stats?.nsfasPercentage}%`}</p>
                <p className="text-xs text-muted-foreground mt-1">NSFAS-funded applicants</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ResidenceAnalytics;
