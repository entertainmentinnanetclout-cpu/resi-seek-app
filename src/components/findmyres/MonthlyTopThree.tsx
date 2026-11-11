import {useEffect,useMemo,useState} from "react";
import {ArrowRight,ChartNoAxesCombined} from "lucide-react";
import {Link} from "react-router-dom";
import {supabase} from "@/integrations/supabase/client";
import {usePublicLivingSignals,type MonthlyWinner} from "@/hooks/usePublicLivingSignals";
import ResidenceDiscoveryCard from "./ResidenceDiscoveryCard";

type Signals=ReturnType<typeof usePublicLivingSignals>;
type Props={residences?:any[];signals:Signals;surface:"landing"|"find"};

const NO_RESIDENCES:any[]=[];
export default function MonthlyTopThree({residences=NO_RESIDENCES,signals,surface}:Props){
 const [loaded,setLoaded]=useState<any[]>([]);
 const keys=signals.top3.map(item=>item.residence_id).join(",");
 useEffect(()=>{
  if(!keys)return;
  let active=true;
  const ids=keys.split(",").filter(Boolean);
  // Fill only missing rows on the homepage; Find My Res reuses its live feed.
  const missing=ids.filter(id=>!residences.some(r=>r.id===id));
  if(!missing.length){setLoaded([]);return;}
  void (supabase as any).from("residences")
   .select("id,name,slug,address,city,campus,place_label,cover_image_url,image_url,images,private_price,price,promo_price,promo_active,promo_starts_at,promo_ends_at,price_verified_at,available_spots,accepts_nsfas,is_spotlight,is_visible,room_types,room_type")
   .in("id",missing).eq("is_visible",true)
   .then(({data,error}:any)=>{if(active&&!error)setLoaded(data||[]);});
  return()=>{active=false;};
 },[keys,residences]);
 const all=useMemo(()=>new Map([...residences,...loaded].filter(r=>r?.id&&r.is_visible!==false).map(r=>[r.id,r])),[residences,loaded]);
 const winners=signals.top3.flatMap(rank=>{const residence=all.get(rank.residence_id);return residence?[{rank,residence}]:[];});
 if(!winners.length)return null;
 const month=signals.top3[0]?.month_start;
 const label=month?new Date(month+"T12:00:00").toLocaleDateString("en-ZA",{month:"long",year:"numeric"}):"This month";
 const render=(item:{rank:MonthlyWinner;residence:any},layout:"editorial"|"compact")=><div key={item.rank.residence_id} className="min-w-0">
  <ResidenceDiscoveryCard residence={item.residence} layout={layout} rank={item.rank.rank_position}
   rating={signals.ratings[item.rank.residence_id]}
   accredited={signals.accreditedIds.has(item.rank.residence_id)}
   nsfasAccredited={signals.nsfasAccreditedIds.has(item.rank.residence_id)} className="h-full"/>
  <p className="mt-2 text-[11px] text-[#7a8491]">{item.rank.reservations_count} unique reservation interests · {item.rank.applications_count} applicants this month</p>
 </div>;
 return <section aria-labelledby={`rk-monthly-top3-${surface}`} className="bg-[#faf7f1] py-11 text-[#16243d] md:py-16">
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
   <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
     <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#a86b20]"><ChartNoAxesCombined className="h-4 w-4"/> Organic student demand · {label}</p>
     <h2 id={`rk-monthly-top3-${surface}`} className="mt-2 text-3xl font-black leading-tight tracking-tight sm:text-4xl">Top 3 residences <span className="text-[#d77858]">this month.</span></h2>
     <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657184]">Ranked by real applicant and reservation interest this calendar month. This is activity, not a student star rating or paid promotion.</p>
    </div>
    <Link className="inline-flex items-center gap-1.5 text-sm font-black text-[#0b3b70] hover:underline" to="/findmyres#results">Explore all residences <ArrowRight className="h-4 w-4"/></Link>
   </div>
   <div className="grid gap-5 md:grid-cols-[1.05fr_.95fr]">
    {winners[0]&&render(winners[0],"editorial")}
    <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-1">
     {winners.slice(1).map(item=>render(item,"compact"))}
    </div>
   </div>
   <p className="mt-5 rounded-xl border border-[#ebdfca] bg-white/60 px-4 py-3 text-xs leading-5 text-[#776c5e]">
    Ranking method: two points per unique reservation-interest account plus one per unique applicant account recorded during {label}. A reservation is not a confirmed tenancy, and accommodation prices and inventory remain residence-reported unless separately verified.
   </p>
  </div>
 </section>;
}
