import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, KeyRound, FileText, Users, Phone, FolderOpen } from "lucide-react";
import { AdminResidencesContent } from "./AdminResidences";
import { AdminResidencePortalsContent } from "./AdminResidencePortals";
import { AdminApplicationsContent } from "./AdminApplications";
import { AdminFollowUpContent } from "./AdminFollowUp";
import { AdminDocumentsContent } from "./AdminDocuments";
import { AdminUsersContent } from "./AdminUsers";

const tabs = [
  { value: "residences", label: "Residences", icon: Building2 },
  { value: "portals", label: "Portals", icon: KeyRound },
  { value: "applications", label: "Applications", icon: FileText },
  { value: "follow-up", label: "Follow-Up", icon: Phone },
  { value: "documents", label: "Documents", icon: FolderOpen },
  { value: "users", label: "Users", icon: Users },
];

const AdminOperationsHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "residences";

  return (
    <AdminLayout>
      <SEO title="Operations Hub | Admin" description="Manage residences, applications, users and documents" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Operations Hub</h1>
          <p className="text-muted-foreground">Residences, applications, users & documents</p>
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

          <TabsContent value="residences"><AdminResidencesContent /></TabsContent>
          <TabsContent value="portals"><AdminResidencePortalsContent /></TabsContent>
          <TabsContent value="applications"><AdminApplicationsContent /></TabsContent>
          <TabsContent value="follow-up"><AdminFollowUpContent /></TabsContent>
          <TabsContent value="documents"><AdminDocumentsContent /></TabsContent>
          <TabsContent value="users"><AdminUsersContent /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminOperationsHub;
