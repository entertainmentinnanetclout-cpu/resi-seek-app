import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Bot, Megaphone, Newspaper } from "lucide-react";
import AdminSocialDemandAnalytics from "@/components/admin/AdminSocialDemandAnalytics";
import { AdminMediaHubContent } from "./AdminMediaHub";
import AdminSiteAnnouncementsManager from "@/components/admin/AdminSiteAnnouncementsManager";
import AdminOSLunaGrowth from "@/components/admin/AdminOSLunaGrowth";

export default function AdminCorporateAffairs(){
  return <AdminLayout>
    <SEO noIndex title="Marketing & Corporate Affairs | ResKonnect Admin" description="Social demand, brand content, PR, public communications and Luna content intelligence."/>
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap gap-2"><Badge>Marketing & Corporate Affairs</Badge><Badge variant="outline">Metricool = demand intelligence</Badge><Badge variant="outline">Founder posting</Badge></div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Marketing & Corporate Affairs</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Owns public reputation, social demand analysis, campaign content, news, events, public notices and brand communication. Metricool measures demand; Luna prepares; founder/manual publishing remains the default.</p>
      </header>

      <Tabs defaultValue="social">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="social" className="gap-2"><BarChart3 className="h-4 w-4"/>Social Demand & Content</TabsTrigger>
          <TabsTrigger value="public-content" className="gap-2"><Newspaper className="h-4 w-4"/>Public Content</TabsTrigger>
          <TabsTrigger value="pr" className="gap-2"><Megaphone className="h-4 w-4"/>PR & Announcements</TabsTrigger>
          <TabsTrigger value="luna" className="gap-2"><Bot className="h-4 w-4"/>Luna Growth Intelligence</TabsTrigger>
        </TabsList>
        <TabsContent value="social"><AdminSocialDemandAnalytics/></TabsContent>
        <TabsContent value="public-content"><AdminMediaHubContent/></TabsContent>
        <TabsContent value="pr" className="space-y-4"><div className="rounded-2xl border bg-muted/25 p-4"><p className="font-black">Public communications control</p><p className="mt-1 text-xs text-muted-foreground">Use verified announcements for public operational notices. Partnership, government, legal, pricing and controversy-sensitive statements remain executive approval items.</p></div><AdminSiteAnnouncementsManager/></TabsContent>
        <TabsContent value="luna"><AdminOSLunaGrowth/></TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
}
