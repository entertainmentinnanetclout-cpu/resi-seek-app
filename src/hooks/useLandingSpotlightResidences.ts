import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {rankSpotlightResidences} from "@/lib/residenceSpotlight";

/** Lightweight landing-page fetch: do not download every room and listing to paint
 * the first high-visibility residence block. Uses only published/visible flags. */
export function useLandingSpotlightResidences(){
 const [residences,setResidences]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let mounted=true;
  let refreshTimer:number|undefined;
  const load=async()=>{
   try{
    const {data,error}=await (supabase as any).from("residences").select(
     "id,name,slug,is_visible,is_spotlight,spotlight_rank,cover_image_url,image_url,images,city,province,campus,address,available_spots,private_price,price,price_verified_at,pricing_year,promo_active,promo_price,promo_starts_at,promo_ends_at,accepts_nsfas,is_tut_accredited,reservations_2027_open"
    ).eq("is_visible",true).eq("is_spotlight",true)
    .order("spotlight_rank",{ascending:true,nullsFirst:false})
    .order("name",{ascending:true}).limit(20);
    if(error)throw error;
    if(mounted)setResidences(rankSpotlightResidences(data||[],5));
   }catch(error){
    console.warn("Spotlight residences unavailable",error instanceof Error?error.message:"unknown");
   }finally{if(mounted)setLoading(false);}
  };
  void load();
  const onRefresh=()=>{
   if(refreshTimer)window.clearTimeout(refreshTimer);
   refreshTimer=window.setTimeout(()=>void load(),700);
  };
  const channel=supabase.channel("landing-spotlight-residences")
   .on("postgres_changes",{event:"*",schema:"public",table:"residences"},onRefresh).subscribe();
  window.addEventListener("rk-reconnected",onRefresh);
  return()=>{mounted=false;if(refreshTimer)window.clearTimeout(refreshTimer);
   window.removeEventListener("rk-reconnected",onRefresh);void supabase.removeChannel(channel);};
 },[]);
 return {residences,loading};
}
