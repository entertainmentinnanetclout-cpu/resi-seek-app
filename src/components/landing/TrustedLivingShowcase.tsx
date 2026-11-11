import {useEffect,useState} from "react";
import {ArrowRight,ShieldCheck,SlidersHorizontal} from "lucide-react";
import {Link} from "react-router-dom";
import {supabase} from "@/integrations/supabase/client";
import {usePublicLivingSignals} from "@/hooks/usePublicLivingSignals";
import ResidenceDiscoveryCard from "@/components/findmyres/ResidenceDiscoveryCard";

type Signals=ReturnType<typeof usePublicLivingSignals>;
type Filter="all"|"nsfas"|"private";
export default function TrustedLivingShowcase({signals}:{signals:Signals}){
 const [rows,setRows]=useState<any[]>([]);
 const [filter,setFilter]=useState<Filter>("all");
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   const {data,error}=await (supabase as any).from("residences").select(
    "id,slug,name,address,city,place_label,campus,cover_image_url,image_url,images,room_type,room_types,is_visible,is_trusted,verification_level,available_spots,private_price,price,price_verified_at,accepts_nsfas,accepts_private,promo_active,promo_price,promo_starts_at,promo_ends_at"
   ).eq("is_visible",true).eq("is_trusted",true).order("display_order",{ascending:true}).limit(12);
   if(!active)return;
   if(!error)setRows(data||[]);
   setLoading(false);
  };
  void load();
  const channel=supabase.channel("trusted-living-home")
   .on("postgres_changes",{event:"*",schema:"public",table:"residences"},()=>void load()).subscribe();
  return()=>{active=false;void supabase.removeChannel(channel);};
 },[]);
 const shown=rows.filter(r=>filter==="all"||filter==="nsfas"&&r.accepts_nsfas===true||filter==="private"&&r.accepts_private===true);
 return <section aria-labelledby="rk-trusted-living" className="bg-white py-12 md:py-16">
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
   <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div className="max-w-2xl">
     <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#b66b46]"><ShieldCheck className="h-4 w-4"/> ResKonnect curated network</p>
     <h2 id="rk-trusted-living" className="mt-2 text-3xl font-black tracking-tight text-[#132744] sm:text-4xl">Explore our residence partners.</h2>
     <p className="mt-3 text-sm leading-6 text-[#68778a]">Clear photos, student feedback where available, and property information that helps you make a confident comparison. Partner selection is not official accommodation accreditation.</p>
    </div>
    <Link to="/findmyres#results" className="inline-flex items-center gap-2 rounded-full border border-[#d9dee5] px-4 py-2 text-sm font-bold text-[#15345c] hover:bg-[#f8f9fb]">Browse every listing <ArrowRight className="h-4 w-4"/></Link>
   </div>
   <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Curated residence categories">
    {([["all","All curated"],["nsfas","Accepts NSFAS"],["private","Private-paying"]] as const).map(([key,label])=>
     <button type="button" key={key} onClick={()=>setFilter(key)} aria-pressed={filter===key}
      className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${filter===key?"border-[#152f52] bg-[#152f52] text-white":"border-[#e1e6ea] bg-white text-[#647186] hover:border-[#9dabc0]"}`}>{label}</button>)}
   </div>
   {loading?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(i=><div key={i} className="aspect-[5/4] animate-pulse rounded-2xl bg-[#f3f4f6]"/>)}</div>:
    shown.length?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     {shown.map(r=><ResidenceDiscoveryCard key={r.id} residence={r}
      rating={signals.ratings[r.id]} accredited={signals.accreditedIds.has(r.id)}
      nsfasAccredited={signals.nsfasAccreditedIds.has(r.id)} />)}
    </div>:
    <div className="rounded-2xl border border-dashed p-8 text-sm text-[#738092]">No curated residence matches this funding category. Browse the full accommodation search for more options.</div>}
  </div>
 </section>;
}
