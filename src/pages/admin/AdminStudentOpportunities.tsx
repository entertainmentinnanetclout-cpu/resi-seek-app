import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AdminApplicationHubContent } from "./AdminApplicationHub";
import { AdminWILContent } from "./AdminWIL";
import { AdminBursariesContent } from "./AdminBursaries";
import { AdminOnboardingHub } from "@/components/admin/onboarding/AdminOnboardingHubContent";
import { BriefcaseBusiness, GraduationCap, HandCoins, Inbox, School } from "lucide-react";
import { AdminTvetHubContent } from "./AdminTvetHub";

export default function AdminStudentOpportunities(){
  return <AdminLayout>
    <SEO noIndex title="Student Services & Opportunities | ResKonnect Admin" description="Applications, WIL, bursaries, funding and student service enquiries."/>
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap gap-2"><Badge>Student Services & Opportunities</Badge><Badge variant="outline">Applications · WIL · Funding · Enquiries</Badge></div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Student Services & Opportunities</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">One office for non-accommodation student journeys: institution applications, WIL placement operations, bursary/funding information and service enquiries requiring staff action.</p>
      </header>
      <Tabs defaultValue="applications">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="applications" className="gap-2"><GraduationCap className="h-4 w-4"/>Application Services</TabsTrigger>
          <TabsTrigger value="tvet" className="gap-2"><School className="h-4 w-4"/>TVET Operations</TabsTrigger>
          <TabsTrigger value="wil" className="gap-2"><BriefcaseBusiness className="h-4 w-4"/>WIL & Placement</TabsTrigger>
          <TabsTrigger value="bursaries" className="gap-2"><HandCoins className="h-4 w-4"/>Bursaries & Funding</TabsTrigger>
          <TabsTrigger value="enquiries" className="gap-2"><Inbox className="h-4 w-4"/>Service Enquiries</TabsTrigger>
        </TabsList>
        <TabsContent value="applications"><AdminApplicationHubContent/></TabsContent>
        <TabsContent value="tvet"><AdminTvetHubContent/></TabsContent>
        <TabsContent value="wil"><AdminWILContent/></TabsContent>
        <TabsContent value="bursaries"><AdminBursariesContent/></TabsContent>
        <TabsContent value="enquiries" className="space-y-4">
          <div className="rounded-2xl border bg-muted/25 p-4"><p className="font-black">Student service intake</p><p className="mt-1 text-xs text-muted-foreground">Allocate and resolve cross-service requests including application support, parents/guardian guidance, WIL, private rentals and other student journeys.</p></div>
          <AdminOnboardingHub/>
        </TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
}
