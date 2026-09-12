import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Contact, MessageCircle, MessagesSquare, Sparkles, Target, WandSparkles } from "lucide-react";
import AdminOSWhatsAppDeskNext from "@/components/admin/AdminOSWhatsAppDeskNext";
import AdminOSContactsDirectory from "@/components/admin/AdminOSContactsDirectory";
import AdminOSWhatsAppConcierge from "@/components/admin/AdminOSWhatsAppConcierge";
import AdminOSServiceIntelligence from "@/components/admin/AdminOSServiceIntelligence";
import AdminWhatsAppConversionPipeline from "@/components/admin/AdminWhatsAppConversionPipeline";
import { AdminWhatsAppTemplatesContent } from "./AdminWhatsAppTemplates";

const tabs=["desk","conversion","contacts","concierge","service","templates"];

export default function AdminCommunicationsDepartment(){
  const[params,setParams]=useSearchParams();
  const requested=params.get("tab");
  const active=tabs.includes(requested||"")?String(requested):"desk";
  const setTab=(value:string)=>{const next=new URLSearchParams(params);next.set("tab",value);setParams(next);};

  return <AdminLayout>
    <SEO noIndex title="Communications & Service | ResKonnect Admin" description="WhatsApp, customer communication, conversion automation, service intelligence, contacts and messaging templates."/>
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap gap-2"><Badge>Communications & Service</Badge><Badge variant="outline">Dimpho · WhatsApp specialist</Badge><Badge variant="outline">RG6 active</Badge></div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Communications & Service</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Customer communication office for live conversations, conversion intelligence, contact context, service journeys, templates and service intelligence. Dimpho owns WhatsApp execution while Luna remains the company intelligence layer.</p>
      </header>
      <Tabs value={active} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="desk" className="gap-2"><MessageCircle className="h-4 w-4"/>WhatsApp Desk</TabsTrigger>
          <TabsTrigger value="conversion" className="gap-2"><Target className="h-4 w-4"/>RG6 Conversion</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2"><Contact className="h-4 w-4"/>Contacts</TabsTrigger>
          <TabsTrigger value="concierge" className="gap-2"><Sparkles className="h-4 w-4"/>Dimpho Concierge</TabsTrigger>
          <TabsTrigger value="service" className="gap-2"><WandSparkles className="h-4 w-4"/>Service Intelligence</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><MessagesSquare className="h-4 w-4"/>Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="desk"><div className="adminos-whatsapp-mobile-fit min-w-0 max-w-full overflow-x-hidden"><AdminOSWhatsAppDeskNext/></div></TabsContent>
        <TabsContent value="conversion"><AdminWhatsAppConversionPipeline/></TabsContent>
        <TabsContent value="contacts"><AdminOSContactsDirectory/></TabsContent>
        <TabsContent value="concierge"><AdminOSWhatsAppConcierge/></TabsContent>
        <TabsContent value="service"><AdminOSServiceIntelligence/></TabsContent>
        <TabsContent value="templates"><AdminWhatsAppTemplatesContent/></TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
}
