import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgePercent, Building2, FileText, FolderOpen, KeyRound, Layers, Rotate3D, Settings2 } from "lucide-react";
import { AdminResidencesContent } from "./AdminResidences";
import { AdminResidencePortalsContent } from "./AdminResidencePortals";
import { AdminApplicationsContent } from "./AdminApplications";
import { AdminFollowUpContent } from "./AdminFollowUp";
import { AdminDocumentsContent } from "./AdminDocuments";
import { AdminLandlordApplicationsContent } from "./AdminLandlordApplications";
import SectionsManager from "@/components/admin/SectionsManager";
import { AdminFilterConfigContent } from "./AdminFilterConfig";
import { AdminRecruitmentProgrammeContent } from "./AdminRecruitmentProgramme";
import { AdminReservations2027Content } from "./AdminReservations2027";
import { AdminResidenceCommercialContent } from "./AdminResidenceCommercial";
import VirtualTourStudioWorkspace from "@/components/virtualTours/VirtualTourStudioWorkspace";
import VirtualTourPlanControl from "@/components/virtualTours/VirtualTourPlanControl";
import AcademicInventoryManager from "@/components/admin/AcademicInventoryManager";

const normalize=(value:string|null)=>{
  const legacy:Record<string,string>={
    applications:"applications-reservations","2027-reservations":"applications-reservations","academic-inventory":"inventory-occupancy",
    residences:"residences",portals:"portals-documents",documents:"portals-documents","follow-up":"applications-reservations",
    "pricing-promos":"commercial","landlord-apps":"commercial",recruitment:"commercial","360-gold":"360",
    sections:"configuration",filters:"configuration",users:"configuration"
  };
  const valid=["applications-reservations","inventory-occupancy","residences","commercial","portals-documents","360","configuration"];
  return value&&valid.includes(value)?value:legacy[value||""]||"applications-reservations";
};

export default function AdminOperationsHub(){
  const[searchParams,setSearchParams]=useSearchParams();
  const activeTab=normalize(searchParams.get("tab"));
  const setTab=(tab:string)=>{const next=new URLSearchParams(searchParams);next.set("tab",tab);setSearchParams(next);};

  return <AdminLayout>
    <SEO noIndex title="Accommodation Department | ResKonnect Admin" description="Accommodation applications, reservations, occupancy, residences, commercial controls and operational delivery."/>
    <div className="space-y-6">
      <header><div className="flex flex-wrap gap-2"><span className="rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary-foreground">Accommodation Department</span><span className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Institutional service delivery</span></div><h1 className="mt-3 text-3xl font-black tracking-tight">Accommodation Operations</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">One departmental workspace for the complete accommodation lifecycle: inventory → applications and reservations → review → occupancy → portals → commercial delivery. Academic years remain isolated.</p></header>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="applications-reservations" className="gap-2"><FileText className="h-4 w-4"/>Applications & Reservations</TabsTrigger>
          <TabsTrigger value="inventory-occupancy" className="gap-2"><Layers className="h-4 w-4"/>Inventory & Occupancy</TabsTrigger>
          <TabsTrigger value="residences" className="gap-2"><Building2 className="h-4 w-4"/>Residences</TabsTrigger>
          <TabsTrigger value="commercial" className="gap-2"><BadgePercent className="h-4 w-4"/>Commercial & Recruitment</TabsTrigger>
          <TabsTrigger value="portals-documents" className="gap-2"><FolderOpen className="h-4 w-4"/>Portals & Records</TabsTrigger>
          <TabsTrigger value="360" className="gap-2"><Rotate3D className="h-4 w-4"/>360 Studio</TabsTrigger>
          <TabsTrigger value="configuration" className="gap-2"><Settings2 className="h-4 w-4"/>Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="applications-reservations" className="space-y-4">
          <Tabs defaultValue="applications">
            <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-muted/45 p-1"><TabsTrigger value="applications">Applications</TabsTrigger><TabsTrigger value="reservations">Reservations / Academic intake</TabsTrigger><TabsTrigger value="follow-up">Follow-up & conversion</TabsTrigger></TabsList>
            <TabsContent value="applications"><AdminApplicationsContent /></TabsContent>
            <TabsContent value="reservations"><AdminReservations2027Content /></TabsContent>
            <TabsContent value="follow-up"><AdminFollowUpContent /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="inventory-occupancy"><AcademicInventoryManager /></TabsContent>
        <TabsContent value="residences"><AdminResidencesContent /></TabsContent>

        <TabsContent value="commercial" className="space-y-4">
          <Tabs defaultValue="pricing">
            <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-muted/45 p-1"><TabsTrigger value="pricing">Pricing & intake offers</TabsTrigger><TabsTrigger value="landlords">Landlord applications</TabsTrigger><TabsTrigger value="recruitment">Recruitment programme</TabsTrigger></TabsList>
            <TabsContent value="pricing"><AdminResidenceCommercialContent /></TabsContent>
            <TabsContent value="landlords"><AdminLandlordApplicationsContent /></TabsContent>
            <TabsContent value="recruitment"><AdminRecruitmentProgrammeContent /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="portals-documents" className="space-y-4">
          <Tabs defaultValue="portals">
            <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-muted/45 p-1"><TabsTrigger value="portals"><KeyRound className="mr-2 h-4 w-4"/>Residence portals</TabsTrigger><TabsTrigger value="documents">Application documents</TabsTrigger></TabsList>
            <TabsContent value="portals"><AdminResidencePortalsContent /></TabsContent>
            <TabsContent value="documents"><AdminDocumentsContent /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="360"><div className="space-y-5"><VirtualTourPlanControl/><VirtualTourStudioWorkspace admin/></div></TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Tabs defaultValue="sections">
            <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-muted/45 p-1"><TabsTrigger value="sections">Sections</TabsTrigger><TabsTrigger value="filters">Find My Res filters</TabsTrigger></TabsList>
            <TabsContent value="sections"><SectionsManager /></TabsContent>
            <TabsContent value="filters"><AdminFilterConfigContent /></TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
}
