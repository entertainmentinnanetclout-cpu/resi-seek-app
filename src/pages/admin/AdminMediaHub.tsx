import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Image,
  Newspaper,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  Eye,
  EyeOff,
  TrendingUp,
  Plus,
  Clock,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminSlidesContent } from "./AdminSlides";
import { AdminNewsContent } from "./AdminNews";
import { AdminEventsContent } from "./AdminEvents";
import { AdminBursariesContent } from "./AdminBursaries";
import { AdminMarketplaceBannersContent } from "./AdminMarketplaceBanners";
import { formatDistanceToNow, format, isPast, isFuture } from "date-fns";

interface MediaStats {
  slides: { total: number; active: number; landing: number; dashboard: number; news: number };
  newsArticles: { total: number; published: number; drafts: number };
  events: { total: number; upcoming: number; past: number };
  bursaries: { total: number; active: number; expiringSoon: number };
}

interface RecentItem {
  id: string;
  type: "slide" | "news" | "event" | "bursary";
  title: string;
  status: string;
  date: string;
  meta?: string;
}

const tabs = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "slides", label: "Hero Slides", icon: Image },
  { value: "banners", label: "Marketplace Banners", icon: Image },
  { value: "news", label: "News", icon: Newspaper },
  { value: "events", label: "Events", icon: Calendar },
  { value: "bursaries", label: "Bursaries", icon: GraduationCap },
];

const AdminMediaHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeTab === "overview") {
      fetchDashboardData();
    }
  }, [activeTab]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [slidesRes, newsRes, eventsRes, bursariesRes] = await Promise.all([
        supabase.from("hero_slides").select("id, title, is_active, slide_location, created_at, updated_at"),
        supabase.from("campus_news").select("id, title, is_published, created_at, updated_at, category"),
        supabase.from("events").select("id, title, event_date, created_at, campus"),
        supabase.from("bursaries").select("id, name, is_active, deadline, created_at, provider"),
      ]);

      const slides = slidesRes.data || [];
      const news = newsRes.data || [];
      const events = eventsRes.data || [];
      const bursaries = bursariesRes.data || [];

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const computedStats: MediaStats = {
        slides: {
          total: slides.length,
          active: slides.filter(s => s.is_active).length,
          landing: slides.filter(s => s.slide_location === "landing").length,
          dashboard: slides.filter(s => s.slide_location === "dashboard").length,
          news: slides.filter(s => s.slide_location === "news").length,
        },
        newsArticles: {
          total: news.length,
          published: news.filter(n => n.is_published).length,
          drafts: news.filter(n => !n.is_published).length,
        },
        events: {
          total: events.length,
          upcoming: events.filter(e => isFuture(new Date(e.event_date))).length,
          past: events.filter(e => isPast(new Date(e.event_date))).length,
        },
        bursaries: {
          total: bursaries.length,
          active: bursaries.filter(b => b.is_active).length,
          expiringSoon: bursaries.filter(b => b.deadline && new Date(b.deadline) <= thirtyDaysFromNow && isFuture(new Date(b.deadline))).length,
        },
      };

      setStats(computedStats);

      // Build recent activity feed (last 10 items across all content types)
      const recent: RecentItem[] = [
        ...slides.map(s => ({
          id: s.id,
          type: "slide" as const,
          title: s.title,
          status: s.is_active ? "active" : "inactive",
          date: s.updated_at || s.created_at,
          meta: s.slide_location,
        })),
        ...news.map(n => ({
          id: n.id,
          type: "news" as const,
          title: n.title,
          status: n.is_published ? "published" : "draft",
          date: n.updated_at || n.created_at,
          meta: n.category,
        })),
        ...events.map(e => ({
          id: e.id,
          type: "event" as const,
          title: e.title,
          status: isFuture(new Date(e.event_date)) ? "upcoming" : "past",
          date: e.created_at,
          meta: e.campus || undefined,
        })),
        ...bursaries.map(b => ({
          id: b.id,
          type: "bursary" as const,
          title: b.name,
          status: b.is_active ? "active" : "inactive",
          date: b.created_at,
          meta: b.provider,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 12);

      setRecentItems(recent);
    } catch (err) {
      console.error("Error fetching media stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const typeIcon: Record<string, React.ElementType> = {
    slide: Image,
    news: Newspaper,
    event: Calendar,
    bursary: GraduationCap,
  };

  const typeColor: Record<string, string> = {
    slide: "text-blue-500",
    news: "text-emerald-500",
    event: "text-purple-500",
    bursary: "text-amber-500",
  };

  const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active":
      case "published":
      case "upcoming":
        return "default";
      case "draft":
      case "inactive":
        return "secondary";
      case "past":
        return "outline";
      default:
        return "secondary";
    }
  };

  const renderOverview = () => {
    if (isLoading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-xl lg:col-span-2" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      );
    }

    if (!stats) return null;

    return (
      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSearchParams({ tab: "slides" })}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Image className="w-5 h-5 text-blue-500" />
                </div>
                <Badge variant="outline" className="text-xs">{stats.slides.active} live</Badge>
              </div>
              <p className="text-2xl font-bold">{stats.slides.total}</p>
              <p className="text-sm text-muted-foreground">Hero Slides</p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Landing: {stats.slides.landing}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Dashboard: {stats.slides.dashboard}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSearchParams({ tab: "news" })}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Newspaper className="w-5 h-5 text-emerald-500" />
                </div>
                <Badge variant="outline" className="text-xs">{stats.newsArticles.published} published</Badge>
              </div>
              <p className="text-2xl font-bold">{stats.newsArticles.total}</p>
              <p className="text-sm text-muted-foreground">News Articles</p>
              {stats.newsArticles.drafts > 0 && (
                <div className="flex gap-2 mt-2">
                  <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">{stats.newsArticles.drafts} drafts</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSearchParams({ tab: "events" })}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-500" />
                </div>
                <Badge variant="outline" className="text-xs">{stats.events.upcoming} upcoming</Badge>
              </div>
              <p className="text-2xl font-bold">{stats.events.total}</p>
              <p className="text-sm text-muted-foreground">Events</p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Past: {stats.events.past}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSearchParams({ tab: "bursaries" })}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-amber-500" />
                </div>
                <Badge variant="outline" className="text-xs">{stats.bursaries.active} active</Badge>
              </div>
              <p className="text-2xl font-bold">{stats.bursaries.total}</p>
              <p className="text-sm text-muted-foreground">Bursaries</p>
              {stats.bursaries.expiringSoon > 0 && (
                <div className="flex gap-2 mt-2">
                  <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {stats.bursaries.expiringSoon} expiring soon
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Content Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentItems.map((item) => {
                  const Icon = typeIcon[item.type];
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSearchParams({ tab: item.type === "slide" ? "slides" : item.type === "news" ? "news" : item.type === "event" ? "events" : "bursaries" })}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-muted ${typeColor[item.type]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                          {item.meta && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground capitalize">{item.meta}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusBadgeVariant(item.status)} className="text-[10px] capitalize">
                          {item.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">
                          {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {recentItems.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No content yet. Start by adding slides, news, or events.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions + Content Health */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setSearchParams({ tab: "slides" })}
                >
                  <Image className="w-4 h-4 text-blue-500" />
                  Add Hero Slide
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setSearchParams({ tab: "news" })}
                >
                  <Newspaper className="w-4 h-4 text-emerald-500" />
                  Write News Article
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setSearchParams({ tab: "events" })}
                >
                  <Calendar className="w-4 h-4 text-purple-500" />
                  Create Event
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setSearchParams({ tab: "bursaries" })}
                >
                  <GraduationCap className="w-4 h-4 text-amber-500" />
                  Add Bursary
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Content Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <HealthItem
                  label="Slide Coverage"
                  detail={`${stats.slides.active} of ${stats.slides.total} active`}
                  percentage={stats.slides.total > 0 ? Math.round((stats.slides.active / stats.slides.total) * 100) : 0}
                />
                <HealthItem
                  label="Published Articles"
                  detail={`${stats.newsArticles.published} of ${stats.newsArticles.total}`}
                  percentage={stats.newsArticles.total > 0 ? Math.round((stats.newsArticles.published / stats.newsArticles.total) * 100) : 0}
                />
                <HealthItem
                  label="Upcoming Events"
                  detail={`${stats.events.upcoming} of ${stats.events.total}`}
                  percentage={stats.events.total > 0 ? Math.round((stats.events.upcoming / stats.events.total) * 100) : 0}
                />
                <HealthItem
                  label="Active Bursaries"
                  detail={`${stats.bursaries.active} of ${stats.bursaries.total}`}
                  percentage={stats.bursaries.total > 0 ? Math.round((stats.bursaries.active / stats.bursaries.total) * 100) : 0}
                />

                {/* Alerts */}
                {stats.newsArticles.drafts > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <EyeOff className="w-4 h-4 shrink-0" />
                    <span className="text-xs">{stats.newsArticles.drafts} unpublished draft{stats.newsArticles.drafts > 1 ? "s" : ""}</span>
                  </div>
                )}
                {stats.bursaries.expiringSoon > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-xs">{stats.bursaries.expiringSoon} bursary deadline{stats.bursaries.expiringSoon > 1 ? "s" : ""} within 30 days</span>
                  </div>
                )}
                {stats.slides.active === 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-xs">No active slides — landing page carousel is empty!</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Image Guidelines */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Image Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1.5">
                <p>📐 <strong>Slides:</strong> 1920×1080px (16:9)</p>
                <p>🎯 <strong>Safe zone:</strong> Keep key content centered</p>
                <p>📱 <strong>Mobile crop:</strong> Sides may be trimmed</p>
                <p>📦 <strong>Max size:</strong> 2MB per image</p>
                <p>🖼️ <strong>Formats:</strong> JPG, PNG, WebP</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <SEO title="Media Hub | Admin" description="Manage hero slides, news, events and bursaries" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Media Hub</h1>
          <p className="text-muted-foreground">Content management for slides, news, events & bursaries</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <t.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">{renderOverview()}</TabsContent>
          <TabsContent value="slides"><AdminSlidesContent /></TabsContent>
          <TabsContent value="news"><AdminNewsContent /></TabsContent>
          <TabsContent value="events"><AdminEventsContent /></TabsContent>
          <TabsContent value="bursaries"><AdminBursariesContent /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

// Health bar sub-component
const HealthItem = ({ label, detail, percentage }: { label: string; detail: string; percentage: number }) => {
  const barColor =
    percentage >= 75 ? "bg-emerald-500" : percentage >= 40 ? "bg-amber-500" : "bg-destructive";

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{detail}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

export default AdminMediaHub;
