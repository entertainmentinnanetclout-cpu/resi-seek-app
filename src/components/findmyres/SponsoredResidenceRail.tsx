import {useEffect,useMemo,useState} from "react";
import {Sparkles} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {supabase} from "@/integrations/supabase/client";
import {isMockResidence} from "@/hooks/useResidenceFilters";
import {ResidencePropertyCard} from "./ResidencePropertyCard";

type Placement={residence_id:string;title:string;description:string;placement:string;disclosure_label:string};
export default function SponsoredResidenceRail({residences,onApply}:{residences:any[];onApply:(residence:any)=>void}){
 const [placements,setPlacements]=useState<Placement[]>([]);
 useEffect(()=>{
  let active=true;
  void (supabase as any).rpc("reskonnect_public_sponsored_residences",{p_placement:"find"})
   .then(({data,error}:any)=>{
    if(!active)return;
    // Sponsor queries never block ordinary accommodation discovery.
    setPlacements(error?[]:(Array.isArray(data)?data:[]).filter((row:Placement)=>row?.disclosure_label==="Sponsored"));
   });
  return()=>{active=false;};
 },[]);
 const approved=useMemo(()=>{
  const byId=new Map(residences.filter(r=>r?.is_visible!==false&&!isMockResidence(r)).map(r=>[r.id,r]));
  const found=new Set<string>();
  return placements.flatMap(p=>{
   const residence=byId.get(p.residence_id);
   if(!residence||found.has(p.residence_id))return[];
   found.add(p.residence_id);
   return [{placement:p,residence}];
  });
 },[placements,residences]);
 if(approved.length===0)return null;
 return <section aria-label="Sponsored accommodation" className="mx-auto max-w-7xl space-y-3 px-4 py-6 sm:px-6 lg:px-8">
   <div className="flex flex-wrap items-center gap-3">
    <Badge className="gap-1 bg-[#0C457E] text-white"><Sparkles className="h-3 w-3"/>Sponsored</Badge>
    <div><h2 className="text-lg font-black">Sponsored accommodation</h2><p className="text-xs text-muted-foreground">These listings have approved promotional placement. Sponsorship is not an accreditation or an independent recommendation.</p></div>
   </div>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {approved.slice(0,6).map(({placement,residence})=><div key={residence.id} className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-2">
       <span className="text-sm font-bold">{placement.title}</span><Badge className="bg-[#0C457E] text-white">Sponsored</Badge>
      </div>
      <ResidencePropertyCard residence={residence} onApply={onApply}/>
      {placement.description&&<p className="px-2 text-xs text-muted-foreground">{placement.description}</p>}
     </div>)}
   </div>
  </section>;
}
