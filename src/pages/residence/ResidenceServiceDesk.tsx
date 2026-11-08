import {useOutletContext} from "react-router-dom";
import SEO from "@/components/SEO";
import ResKonnectCaseDesk from "@/components/operations/ResKonnectCaseDesk";
import type {ResidencePortalContext} from "./ResidenceLayout";
export default function ResidenceServiceDesk(){
 const {residence}=useOutletContext<ResidencePortalContext>();
 if(!residence)return <p className="p-8 text-center text-muted-foreground">Loading your residence service desk…</p>;
 return <div className="mx-auto max-w-7xl pb-16"><SEO noIndex title={"Service & Conversion | "+residence.name+" | ResKonnect"} description="Unified operational case management for residence staff."/><ResKonnectCaseDesk residenceId={residence.id}/></div>;
}
