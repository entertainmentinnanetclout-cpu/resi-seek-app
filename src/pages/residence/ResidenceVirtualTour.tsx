import { useOutletContext } from "react-router-dom";
import SEO from "@/components/SEO";
import VirtualTourStudioWorkspace from "@/components/virtualTours/VirtualTourStudioWorkspace";
import type { ResidencePortalContext } from "./ResidenceLayout";

export default function ResidenceVirtualTour() {
  const { residence } = useOutletContext<ResidencePortalContext>();
  return <>
    <SEO title={`360 Studio${residence?.name ? ` | ${residence.name}` : ""} | ResKonnect`} description="Create and manage premium 4K virtual residence tours with ResKonnect 360 Studio." noIndex />
    {residence?.id ? <VirtualTourStudioWorkspace residenceId={residence.id} /> : <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Loading residence 360 Studio…</div>}
  </>;
}
