import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/integrations/supabase/client";

export type ResidenceRating={average:number;count:number};
export type MonthlyWinner={residence_id:string;rank_position:number;applications_count:number;reservations_count:number;activity_score:number;month_start:string};
type Signals={ratings:Record<string,ResidenceRating>;accreditedIds:Set<string>;nsfasAccreditedIds:Set<string>;top3:MonthlyWinner[];loading:boolean;refresh:()=>void};

/**
 * A single public-safe source for all accommodation discovery surfaces:
 * evidence-based accreditation, student votes, and monthly unique-intent signals.
 * Failure hides unsupported claims instead of inventing badges or average stars.
 */
export function usePublicLivingSignals():Signals{
 const [ratings,setRatings]=useState<Record<string,ResidenceRating>>({});
 const [accredited,setAccredited]=useState<string[]>([]);
 const [nsfasAccredited,setNsfasAccredited]=useState<string[]>([]);
 const [top3,setTop3]=useState<MonthlyWinner[]>([]);
 const [loading,setLoading]=useState(true);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true;
  const run=async()=>{
   const db=supabase as any;
   const [ratingsResult,accreditResult,topResult]=await Promise.allSettled([
    db.rpc("reskonnect_public_residence_review_scores"),
    db.rpc("get_public_accreditation_residences",{p_residence_id:null}),
    db.rpc("reskonnect_public_top3_monthly")
   ]);
   if(!active)return;
   if(ratingsResult.status==="fulfilled"&&!ratingsResult.value.error){
    const map:Record<string,ResidenceRating>={};
    (ratingsResult.value.data||[]).forEach((row:any)=>{
     const count=Number(row.rating_count),average=Number(row.rating_average);
     if(row.residence_id&&count>0&&average>=1&&average<=5)map[row.residence_id]={count,average};
    });setRatings(map);
   }
   if(accreditResult.status==="fulfilled"&&!accreditResult.value.error){
    const current=(accreditResult.value.data||[]).filter((row:any)=>
     row.accreditation_verified===true
     &&row.accreditation_status==="accredited_active"
     &&row.accreditation_valid_until>=new Date().toISOString().slice(0,10));
    setAccredited(current.map((row:any)=>String(row.residence_id)));
    setNsfasAccredited(current.filter((row:any)=>/nsfas/i.test(String(row.accreditation_authority||"")))
     .map((row:any)=>String(row.residence_id)));
   }
   if(topResult.status==="fulfilled"&&!topResult.value.error)
    setTop3((topResult.value.data||[]).filter((row:any)=>
     row.residence_id&&Number(row.activity_score)>0).sort((a:any,b:any)=>
     Number(a.rank_position)-Number(b.rank_position)).slice(0,3));
   setLoading(false);
  };
  void run();
  const ticker=window.setInterval(()=>{if(document.visibilityState==="visible")void run();},300000);
  return()=>{active=false;window.clearInterval(ticker);};
 },[revision]);
 return {ratings,accreditedIds:useMemo(()=>new Set(accredited),[accredited]),
  nsfasAccreditedIds:useMemo(()=>new Set(nsfasAccredited),[nsfasAccredited]),top3,loading,
  refresh:useCallback(()=>setRevision(v=>v+1),[])};
}
