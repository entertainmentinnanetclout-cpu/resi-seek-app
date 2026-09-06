import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, MessageSquare, Activity, Settings, HeartPulse, BellRing, Zap, Bot, PhoneCall } from "lucide-react";
import { AdminWILContent } from "./AdminWIL";
import { AdminWhatsAppTemplatesContent } from "./AdminWhatsAppTemplates";
import { AdminSystemStatusContent } from "./AdminSystemStatus";
import { AdminSettingsContent } from "./AdminSettings";
import { AdminBackendHealthContent } from "./AdminBackendHealth";
import AdminSiteAnnouncementsManager from "@/components/admin/AdminSiteAnnouncementsManager";
import AutomationQueueContent from "@/components/admin/AutomationQueueContent";
import AdminOSMasterContent from "@/components/admin/AdminOSMasterContent";
import AdminOSTwilioSetup from "@/components/admin/AdminOSTwilioSetup";

const tabs = [
  { value: "adminos", label: "AdminOS", icon: Bot },
  { value: "twilio-setup", label: "Twilio Setup", icon: PhoneCall },
  { value: "automation", label: "Automation OS", icon: Zap },
  { value: "wil", label: "WIL Management", icon: Briefcase },
  { value: "site-updates", label: "Site Updates", icon: BellRing },
  { value: "whatsapp", label: "WhatsApp Templates", icon: MessageSquare },
  { value: "backend-health", label: "Backend Health", icon: HeartPulse },
  { value: "system-status", label: "System Status", icon: Activity },
  { value: "settings", label: "Settings", icon: Settings },
];

const AdminSystemHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "adminos";

  const setTopLevelTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    if (value !== "adminos") next.delete("adminos_view");
    setSearchParams(next);
  };

  return (
    <AdminLayout>
      <SEO title="System Hub | Admin" description="ResKonnect AdminOS executive automation, CRM, communications, calls, WIL, system status and settings" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Hub</h1>
          <p className="text-muted-foreground">AdminOS command, automation, communications, executive exceptions, WIL, backend health, system status & settings</p>
        </div>
        <Tabs value={activeTab} onValueChange={setTopLevelTab}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <t.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="adminos"><AdminOSMasterContent /></TabsContent>
          <TabsContent value="twilio-setup"><AdminOSTwilioSetup /></TabsContent>
          <TabsContent value="automation"><AutomationQueueContent /></TabsContent>
          <TabsContent value="wil"><AdminWILContent /></TabsContent>
          <TabsContent value="site-updates"><AdminSiteAnnouncementsManager /></TabsContent>
          <TabsContent value="whatsapp"><AdminWhatsAppTemplatesContent /></TabsContent>
          <TabsContent value="backend-health"><AdminBackendHealthContent /></TabsContent>
          <TabsContent value="system-status"><AdminSystemStatusContent /></TabsContent>
          <TabsContent value="settings"><AdminSettingsContent /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSystemHub;
