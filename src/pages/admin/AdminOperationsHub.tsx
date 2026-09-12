import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, KeyRound, FileText, Users, Phone, FolderOpen, ClipboardList, Layers, Filter, Sparkles, CalendarDays, BadgePercent, Rotate3D } from "lucide-react";
import { AdminResidencesContent } from "./AdminResidences";
import { AdminResidencePortalsContent } from "./AdminResidencePortals";
import { AdminApplicationsContent } from "./AdminApplications";
import { AdminFollowUpContent } from "./AdminFollowUp";
import { AdminDocumentsContent } from "./AdminDocuments";
import { AdminUsersContent } from "./AdminUsers";
import { AdminLandlordApplicationsContent } from "./AdminLandlordApplications";
import SectionsManager from "@/components/admin/SectionsManager";
import { AdminFilterConfigContent } from "./AdminFilterConfig";
import { AdminRecruitmentProgrammeContent } from "./AdminRecruitmentProgramme";
import { AdminReservations2027Content } from "./AdminReservations2027";
import { AdminResidenceCommercialContent } from "./AdminResidenceCommercial";
import VirtualTourStudioWorkspace from "@/components/virtualTours/VirtualTourStudioWorkspace";
import VirtualTourPlanControl from "@/components/virtualTours/VirtualTourPlanControl";
import AcademicInventoryManager from "@/components/admin/AcademicInventoryManager";

const tabs = [
  { value: "residences", label: "Residences", icon: Building2 },
  { value: "360-gold", label: "360 Gold Studio", icon: Rotate3D },
  { value: "academic-inventory", label: "Academic Inventory", icon: Building2 },
  { value: "2027-reservations", label: "Academic Intake", icon: CalendarDays },
  { value: "pricing-promos", label: "Pricing & Intakes", icon: BadgePercent },
  { value: "sections", label: "Sections", icon: Layers },
  { value: "filters", label: "Filters", icon: Filter },
  { value: "portals", label: "Portals", icon: KeyRound },
  { value: "applications", label: "Applications", icon: FileText },
  { value: "landlord-apps", label: "Landlord Apps", icon: ClipboardList },
  { value: "follow-up", label: "Follow-Up", icon: Phone },
  { value: "documents", label: "Documents", icon: FolderOpen },
  { value: "users", label: "Users", icon: Users },
  { value: "recruitment", label: "Recruitment", icon: Sparkles },
];

const AdminOperationsHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "residences";
  return <AdminLayout>
    <SEO title="Institutional Accommodation Operations | Admin" description="Manage year-isolated occupancy, academic intake cycles, residences, applications, pricing, users and institutional accommodation operations" />
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Institutional Accommodation Operations</h1><p className="text-muted-foreground">Academic-year inventory, annual/semester/trimester intakes, residences, applications, pricing, users and service-provider operations.</p></div>
      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList className="flex h-auto flex-wrap gap-1">{tabs.map((t) => <TabsTrigger key={t.value} value={t.value} className="gap-1.5"><t.icon className="h-4 w-4" /><span className="hidden sm:inline">{t.label}</span></TabsTrigger>)}</TabsList>
        <TabsContent value="residences"><AdminResidencesContent /></TabsContent>
        <TabsContent value="360-gold"><div className="space-y-5"><VirtualTourPlanControl /><VirtualTourStudioWorkspace admin /></div></TabsContent>
        <TabsContent value="academic-inventory"><AcademicInventoryManager /></TabsContent>
        <TabsContent value="2027-reservations"><AdminReservations2027Content /></TabsContent>
        <TabsContent value="pricing-promos"><AdminResidenceCommercialContent /></TabsContent>
        <TabsContent value="sections"><SectionsManager /></TabsContent>
        <TabsContent value="filters"><AdminFilterConfigContent /></TabsContent>
        <TabsContent value="portals"><AdminResidencePortalsContent /></TabsContent>
        <TabsContent value="applications"><AdminApplicationsContent /></TabsContent>
        <TabsContent value="landlord-apps"><AdminLandlordApplicationsContent /></TabsContent>
        <TabsContent value="follow-up"><AdminFollowUpContent /></TabsContent>
        <TabsContent value="documents"><AdminDocumentsContent /></TabsContent>
        <TabsContent value="users"><AdminUsersContent /></TabsContent>
        <TabsContent value="recruitment"><AdminRecruitmentProgrammeContent /></TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
};
export default AdminOperationsHub;
