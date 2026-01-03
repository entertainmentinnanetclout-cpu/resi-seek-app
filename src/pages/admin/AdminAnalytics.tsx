import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, Home, TrendingUp, Calendar, Award } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Legend
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const AdminAnalytics = () => {
  const [dateRange, setDateRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalApplications: 0,
    totalResidences: 0,
    totalBursaries: 0,
    pendingApplications: 0,
    approvedApplications: 0
  });
  const [applicationTrends, setApplicationTrends] = useState<any[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<any[]>([]);
  const [popularResidences, setPopularResidences] = useState<any[]>([]);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const days = parseInt(dateRange);
    const startDate = subDays(new Date(), days);

    try {
      // Fetch counts
      const [usersRes, appsRes, residencesRes, bursariesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("id, status", { count: "exact" }),
        supabase.from("residences").select("id", { count: "exact", head: true }),
        supabase.from("bursaries").select("id", { count: "exact", head: true }).eq("is_active", true)
      ]);

      const applications = appsRes.data || [];
      const pending = applications.filter(a => a.status === "pending").length;
      const approved = applications.filter(a => a.status === "approved").length;

      setStats({
        totalUsers: usersRes.count || 0,
        totalApplications: appsRes.count || 0,
        totalResidences: residencesRes.count || 0,
        totalBursaries: bursariesRes.count || 0,
        pendingApplications: pending,
        approvedApplications: approved
      });

      // Status breakdown for pie chart
      const statusCounts: Record<string, number> = {};
      applications.forEach(app => {
        statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      });
      setStatusBreakdown(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

      // Application trends over time
      const { data: trendData } = await supabase
        .from("applications")
        .select("created_at")
        .gte("created_at", startDate.toISOString());

      const dateInterval = eachDayOfInterval({ start: startDate, end: new Date() });
      const trendMap: Record<string, number> = {};
      dateInterval.forEach(date => {
        trendMap[format(date, "MMM dd")] = 0;
      });

      (trendData || []).forEach(app => {
        const dateKey = format(new Date(app.created_at), "MMM dd");
        if (trendMap[dateKey] !== undefined) {
          trendMap[dateKey]++;
        }
      });

      setApplicationTrends(Object.entries(trendMap).map(([date, count]) => ({ date, applications: count })));

      // User growth over time
      const { data: userGrowthData } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", startDate.toISOString());

      const userGrowthMap: Record<string, number> = {};
      dateInterval.forEach(date => {
        userGrowthMap[format(date, "MMM dd")] = 0;
      });

      (userGrowthData || []).forEach(user => {
        const dateKey = format(new Date(user.created_at), "MMM dd");
        if (userGrowthMap[dateKey] !== undefined) {
          userGrowthMap[dateKey]++;
        }
      });

      let cumulative = 0;
      setUserGrowth(Object.entries(userGrowthMap).map(([date, count]) => {
        cumulative += count;
        return { date, users: cumulative, newUsers: count };
      }));

      // Popular residences
      const { data: appsByResidence } = await supabase
        .from("applications")
        .select("residence_id, residences(name)")
        .gte("created_at", startDate.toISOString());

      const residenceCounts: Record<string, { name: string; count: number }> = {};
      (appsByResidence || []).forEach((app: any) => {
        const id = app.residence_id;
        const name = app.residences?.name || "Unknown";
        if (!residenceCounts[id]) {
          residenceCounts[id] = { name, count: 0 };
        }
        residenceCounts[id].count++;
      });

      const sortedResidences = Object.values(residenceCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setPopularResidences(sortedResidences.map(r => ({ name: r.name, applications: r.count })));

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    // Realtime subscription for live updates
    const channel = supabase
      .channel("analytics-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, fetchAnalytics)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchAnalytics)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  const StatCard = ({ title, value, icon: Icon, description, color = "primary" }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? "..." : value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <SEO title="Analytics | Admin" description="Platform analytics and insights" />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Platform Analytics</h1>
            <p className="text-muted-foreground">Monitor platform performance and trends</p>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Total Users" value={stats.totalUsers} icon={Users} />
          <StatCard title="Applications" value={stats.totalApplications} icon={FileText} />
          <StatCard title="Residences" value={stats.totalResidences} icon={Home} />
          <StatCard title="Active Bursaries" value={stats.totalBursaries} icon={Award} />
          <StatCard title="Pending Apps" value={stats.pendingApplications} icon={Calendar} description="Awaiting review" />
          <StatCard title="Approved Apps" value={stats.approvedApplications} icon={TrendingUp} description="Successfully approved" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Application Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Application Trends</CardTitle>
              <CardDescription>Daily applications over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
                ) : applicationTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={applicationTrends}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="applications" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Application Status Breakdown</CardTitle>
              <CardDescription>Distribution by status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
                ) : statusBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* User Growth */}
          <Card>
            <CardHeader>
              <CardTitle>User Growth</CardTitle>
              <CardDescription>Cumulative user registrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
                ) : userGrowth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={userGrowth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="users" 
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary) / 0.2)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Popular Residences */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Popular Residences</CardTitle>
              <CardDescription>Most applied-to residences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
                ) : popularResidences.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={popularResidences} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="applications" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No applications yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
