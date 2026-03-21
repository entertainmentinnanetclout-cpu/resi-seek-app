import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image, Newspaper, Calendar, GraduationCap } from "lucide-react";
import { AdminSlidesContent } from "./AdminSlides";
import { AdminNewsContent } from "./AdminNews";
import { AdminEventsContent } from "./AdminEvents";
import { AdminBursariesContent } from "./AdminBursaries";

const tabs = [
  { value: "slides", label: "Hero Slides", icon: Image },
  { value: "news", label: "News", icon: Newspaper },
  { value: "events", label: "Events", icon: Calendar },
  { value: "bursaries", label: "Bursaries", icon: GraduationCap },
];

const AdminMediaHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "slides";

  return (
    <AdminLayout>
      <SEO title="Media Hub | Admin" description="Manage hero slides, news, events and bursaries" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Media Hub</h1>
          <p className="text-muted-foreground">Hero slides, news, events & bursaries</p>
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

          <TabsContent value="slides"><AdminSlidesContent /></TabsContent>
          <TabsContent value="news"><AdminNewsContent /></TabsContent>
          <TabsContent value="events"><AdminEventsContent /></TabsContent>
          <TabsContent value="bursaries"><AdminBursariesContent /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminMediaHub;
