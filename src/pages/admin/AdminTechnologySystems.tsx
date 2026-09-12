import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Bot, BrainCircuit, Cable, ShieldCheck } from "lucide-react";
import AdminOSTwilioSetup from "@/components/admin/AdminOSTwilioSetup";
import { AdminBackendHealthContent } from "./AdminBackendHealth";
import { AdminSystemStatusContent } from "./AdminSystemStatus";
import AdminOSMasterContent from "@/components/admin/AdminOSMasterContent";
import DimphoIntelligenceStudio from "@/components/admin/DimphoIntelligenceStudio";
import DimphoReleaseControl from "@/components/admin/DimphoReleaseControl";

export default function AdminTechnologySystems(){
  return <AdminLayout>
    <SEO noIndex title="Technology & Systems | ResKonnect Admin" description="Platform health, AI runtime, integrations, system settings and release governance."/>
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap gap-2"><Badge>Technology & Systems</Badge><Badge variant="outline">Platform · AI · Integrations · Reliability</Badge></div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Technology & Systems</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Technical operations for platform reliability, AI governance, communications infrastructure, backend health, settings and release controls. Production changes remain gated and auditable.</p>
      </header>
      <Tabs defaultValue="health">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="health" className="gap-2"><Activity className="h-4 w-4"/>Platform Health</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2"><Cable className="h-4 w-4"/>Integrations</TabsTrigger>
          <TabsTrigger value="ai" className="gap-2"><BrainCircuit className="h-4 w-4"/>AI Operations</TabsTrigger>
          <TabsTrigger value="release" className="gap-2"><ShieldCheck className="h-4 w-4"/>Release Control</TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2"><Bot className="h-4 w-4"/>Advanced AdminOS</TabsTrigger>
        </TabsList>
        <TabsContent value="health" className="space-y-5"><AdminBackendHealthContent/><AdminSystemStatusContent/></TabsContent>
        <TabsContent value="integrations"><AdminOSTwilioSetup/></TabsContent>
        <TabsContent value="ai"><DimphoIntelligenceStudio/></TabsContent>
        <TabsContent value="release"><DimphoReleaseControl/></TabsContent>
        <TabsContent value="advanced"><AdminOSMasterContent/></TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
}
