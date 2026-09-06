import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Bot, Building2, ChevronDown, ClipboardCheck, Cpu, GraduationCap, HeartPulse, Layers3, Megaphone, MessageCircle, Settings, Sparkles, Users, Zap } from "lucide-react";
import { AdminWILContent } from "./AdminWIL";
import { AdminWhatsAppTemplatesContent } from "./AdminWhatsAppTemplates";
import { AdminSystemStatusContent } from "./AdminSystemStatus";
import { AdminSettingsContent } from "./AdminSettings";
import { AdminBackendHealthContent } from "./AdminBackendHealth";
import AdminSiteAnnouncementsManager from "@/components/admin/AdminSiteAnnouncementsManager";
import AutomationQueueContent from "@/components/admin/AutomationQueueContent";
import AdminOSMasterContent from "@/components/admin/AdminOSMasterContent";
import AdminOSTwilioSetup from "@/components/admin/AdminOSTwilioSetup";
import AdminOSWhatsAppDeskNext from "@/components/admin/AdminOSWhatsAppDeskNext";
import AdminOSWhatsAppConcierge from "@/components/admin/AdminOSWhatsAppConcierge";
import AdminOSResidenceReadiness from "@/components/admin/AdminOSResidenceReadiness";

const tabs=[
  {value:"communications",label:"Communications",icon:MessageCircle},
  {value:"automation",label:"Automation",icon:Zap},
  {value:"operations",label:"Operations",icon:Layers3},
  {value:"platform",label:"Platform",icon:Cpu},
];
const legacy:Record<string,string>={
  adminos:"automation",automation:"automation",
  "whatsapp-desk":"communications","whatsapp-concierge":"communications",whatsapp:"communications",
  wil:"operations","site-updates":"operations",
  "twilio-setup":"platform","backend-health":"platform","system-status":"platform",settings:"platform",
};
const normalize=(value:string|null)=>value&&tabs.some((t)=>t.value===value)?value:legacy[value||""]||"communications";

const AdminSystemHub=()=>{
  const[searchParams,setSearchParams]=useSearchParams();
  const activeTab=normalize(searchParams.get("tab"));
  const setTopLevelTab=(value:string)=>{const next=new URLSearchParams(searchParams);next.set("tab",value);next.delete("adminos_view");setSearchParams(next);};
  return <AdminLayout>
    <SEO title="Admin Command Hubs | ResKonnect" description="ResKonnect communications, automation, operations and platform control hubs"/>
    <div className="space-y-6">
      <section className="rounded-[30px] border bg-gradient-to-br from-background to-muted/35 p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap gap-2"><Badge className="rounded-full">Simplified AdminOS</Badge><Badge variant="outline" className="rounded-full">4 command hubs</Badge></div><h1 className="mt-3 text-3xl font-black tracking-tight">ResKonnect Command Centre</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">The old page-heavy admin structure is consolidated into Communications, Automation, Operations and Platform. Specialist tools still exist, but they now live inside the hub where they belong.</p></div><div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4"><MiniStat value="4" label="Hubs"/><MiniStat value="1" label="WhatsApp inbox"/><MiniStat value="24/7" label="Automation"/><MiniStat value="Live" label="Supabase"/></div></div></section>
      <Tabs value={activeTab} onValueChange={setTopLevelTab}><TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1 lg:grid-cols-4">{tabs.map((t)=><TabsTrigger key={t.value} value={t.value} className="gap-2 rounded-xl py-2.5"><t.icon className="h-4 w-4"/><span>{t.label}</span></TabsTrigger>)}</TabsList>
        <TabsContent value="communications" className="space-y-5"><AdminOSWhatsAppDeskNext/><HubPanel title="Luna Concierge Intelligence" description="Interactive journeys, rich WhatsApp content, automated site-event confirmations and AI service rules." icon={Sparkles}><AdminOSWhatsAppConcierge/></HubPanel><HubPanel title="Residence Readiness" description="Luna's live checklist for images, rent, location, availability and public residence links." icon={Building2}><AdminOSResidenceReadiness/></HubPanel><HubPanel title="WhatsApp Templates" description="Meta-approved and pending transactional templates used outside the 24-hour service window." icon={MessageCircle}><AdminWhatsAppTemplatesContent/></HubPanel></TabsContent>
        <TabsContent value="automation" className="space-y-5"><AutomationQueueContent/><HubPanel title="Advanced AdminOS Controls" description="Release controls, agents, workflows, approvals and lower-level automation administration." icon={Bot}><AdminOSMasterContent/></HubPanel></TabsContent>
        <TabsContent value="operations" className="space-y-5"><OperationsShortcuts/><HubPanel title="WIL Management" description="Applications, placements and WIL operational management." icon={GraduationCap}><AdminWILContent/></HubPanel><HubPanel title="Site Updates & Announcements" description="Manage operational announcements without adding another top-level admin page." icon={Megaphone}><AdminSiteAnnouncementsManager/></HubPanel></TabsContent>
        <TabsContent value="platform" className="space-y-4"><HubPanel title="Twilio & WhatsApp Provider Setup" description="Sender, credentials health and provider configuration." icon={MessageCircle} defaultOpen><AdminOSTwilioSetup/></HubPanel><HubPanel title="Backend Health" description="Database and backend runtime health." icon={HeartPulse}><AdminBackendHealthContent/></HubPanel><HubPanel title="System Status" description="Production services and platform status." icon={Activity}><AdminSystemStatusContent/></HubPanel><HubPanel title="Platform Settings" description="System configuration and administrator settings." icon={Settings}><AdminSettingsContent/></HubPanel></TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
};

function OperationsShortcuts(){const items=[
  {title:"Accommodation",text:"Residences, reservations and living operations",to:"/admin/operations",icon:Building2},
  {title:"Applications",text:"Student application operations and readiness",to:"/admin/application-hub",icon:ClipboardCheck},
  {title:"Onboarding",text:"Applicants, landlords and operational onboarding",to:"/admin/onboarding",icon:Users},
  {title:"TVET",text:"College recruitment and TVET workflows",to:"/admin/tvet",icon:GraduationCap},
];return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{items.map((item)=><Link key={item.to} to={item.to} className="group rounded-[24px] border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted"><item.icon className="h-4 w-4"/></div><p className="mt-4 font-black">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p><p className="mt-4 text-[10px] font-bold uppercase tracking-[.12em] text-primary">Open workspace →</p></Link>)}</div>;}
function HubPanel({title,description,icon:Icon,children,defaultOpen=false}:{title:string;description:string;icon:any;children:any;defaultOpen?:boolean}){const[open,setOpen]=useState(defaultOpen);return <section className="overflow-hidden rounded-[28px] border bg-background shadow-sm"><button type="button" onClick={()=>setOpen((v)=>!v)} className="flex w-full items-center gap-4 p-4 text-left sm:p-5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-muted"><Icon className="h-5 w-5"/></div><div className="min-w-0 flex-1"><p className="font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div><ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition ${open?"rotate-180":""}`}/></button>{open&&<div className="border-t p-3 sm:p-5">{children}</div>}</section>;}
function MiniStat({value,label}:{value:string;label:string}){return <div className="rounded-2xl border bg-background/70 px-3 py-2 shadow-sm"><p className="text-sm font-black">{value}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>;}

export default AdminSystemHub;
