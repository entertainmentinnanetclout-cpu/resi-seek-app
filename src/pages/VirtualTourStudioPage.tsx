import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import VirtualTourStudioWorkspace from "@/components/virtualTours/VirtualTourStudioWorkspace";
import { Badge } from "@/components/ui/badge";
import { Rotate3D, Sparkles } from "lucide-react";

export default function VirtualTourStudioPage() {
  return <DashboardLayout>
    <SEO title="360 Studio | ResKonnect" description="Create immersive 360 degree virtual views of rooms, spaces, venues, objects and properties with ResKonnect 360 Studio." noIndex />
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="overflow-hidden rounded-[28px] border bg-gradient-to-br from-[#071326] via-[#0b2752] to-[#102f63] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><Badge className="bg-[#F5B32F] font-black text-[#071326]"><Rotate3D className="mr-1 h-3.5 w-3.5"/>360 STUDIO</Badge><Badge variant="outline" className="border-white/20 text-white">Standalone · 4K</Badge></div><h1 className="mt-4 text-3xl font-black sm:text-4xl">Create a virtual view of anything</h1><p className="mt-2 max-w-3xl text-sm text-white/70 sm:text-base">Capture a room with your phone, import an existing 2:1 panorama, build connected virtual spaces, add hotspots and publish a shareable immersive 360° view. No residence is required.</p></div>
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[24px] bg-white/10"><Sparkles className="h-9 w-9 text-[#F5B32F]"/></div>
        </div>
      </div>
      <VirtualTourStudioWorkspace standaloneOnly />
    </div>
  </DashboardLayout>;
}
