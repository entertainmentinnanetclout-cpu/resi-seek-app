import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Brain, MessageSquareText, Radar } from "lucide-react";
import { AdminAnalyticsContent } from "./AdminAnalytics";
import AdminSocialDemandAnalytics from "@/components/admin/AdminSocialDemandAnalytics";
import AdminOSLunaGrowth from "@/components/admin/AdminOSLunaGrowth";
import AdminOSServiceIntelligence from "@/components/admin/AdminOSServiceIntelligence";
import AdminOccupancyIntelligence from "@/components/admin/AdminOccupancyIntelligence";

export default function AdminIntelligenceAnalytics(){
  return <AdminLayout>
    <SEO noIndex title="Intelligence & Analytics | ResKonnect Admin" description="Company, demand, social and service intelligence."/>
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap gap-2"><Badge>Intelligence & Analytics</Badge><Badge variant="outline">One evidence layer</Badge></div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Intelligence & Analytics</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Company-wide evidence office combining platform performance, accommodation demand, social demand, conversion and service signals. Analytics informs departments; it does not own operational execution.</p>
      </header>
      <Tabs defaultValue="company">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="company" className="gap-2"><BarChart3 className="h-4 w-4"/>Company Analytics</TabsTrigger>
          <TabsTrigger value="demand" className="gap-2"><Radar className="h-4 w-4"/>Demand Intelligence</TabsTrigger>
          <TabsTrigger value="social" className="gap-2"><Brain className="h-4 w-4"/>Social Intelligence</TabsTrigger>
          <TabsTrigger value="service" className="gap-2"><MessageSquareText className="h-4 w-4"/>Service Intelligence</TabsTrigger>
          <TabsTrigger value="occupancy" className="gap-2"><Radar className="h-4 w-4"/>Occupancy Intelligence</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><AdminAnalyticsContent/></TabsContent>
        <TabsContent value="demand"><AdminOSLunaGrowth/></TabsContent>
        <TabsContent value="social"><AdminSocialDemandAnalytics/></TabsContent>
        <TabsContent value="service"><AdminOSServiceIntelligence/></TabsContent>
        <TabsContent value="occupancy"><AdminOccupancyIntelligence/></TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
}
