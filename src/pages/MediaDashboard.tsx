import { useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import SpecialistLayout from "@/components/admin/SpecialistLayout";
import { Image, Newspaper, Calendar, GraduationCap, LayoutDashboard } from "lucide-react";
import { AdminSlidesContent } from "./admin/AdminSlides";
import { AdminNewsContent } from "./admin/AdminNews";
import { AdminEventsContent } from "./admin/AdminEvents";
import { AdminBursariesContent } from "./admin/AdminBursaries";
import { AdminMarketplaceBannersContent } from "./admin/AdminMarketplaceBanners";

const navItems = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "slides", label: "Hero Slides", icon: Image },
  { value: "banners", label: "Marketplace Banners", icon: Image },
  { value: "news", label: "News", icon: Newspaper },
  { value: "events", label: "Events", icon: Calendar },
  { value: "bursaries", label: "Bursaries", icon: GraduationCap },
];

const MediaDashboard = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  return (
    <SpecialistLayout
      title="Media Dashboard"
      roleLabel="Media Executive"
      basePath="/media"
      navItems={navItems}
      defaultTab="overview"
    >
      <SEO title="Media Dashboard | ResKonnect" description="Media team workspace" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold capitalize">{tab === "overview" ? "Media Overview" : tab.replace("-", " ")}</h1>
          <p className="text-muted-foreground">Slides, news, events, banners & bursaries</p>
        </div>

        {tab === "overview" && <MediaOverview />}
        {tab === "slides" && <AdminSlidesContent />}
        {tab === "banners" && <AdminMarketplaceBannersContent />}
        {tab === "news" && <AdminNewsContent />}
        {tab === "events" && <AdminEventsContent />}
        {tab === "bursaries" && <AdminBursariesContent />}
      </div>
    </SpecialistLayout>
  );
};

const MediaOverview = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {navItems.filter(n => n.value !== "overview").map((n) => (
      <a key={n.value} href={`/media?tab=${n.value}`} className="rounded-xl border bg-card p-6 hover:shadow-md transition-shadow">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
          <n.icon className="w-5 h-5 text-primary" />
        </div>
        <p className="font-semibold">{n.label}</p>
        <p className="text-sm text-muted-foreground">Manage {n.label.toLowerCase()}</p>
      </a>
    ))}
  </div>
);

export default MediaDashboard;