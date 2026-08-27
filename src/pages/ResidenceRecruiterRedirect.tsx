import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId, saveReferral } from "@/lib/referrals/referralStorage";

export default function ResidenceRecruiterRedirect(){
  const {key}=useParams<{key:string}>();
  const navigate=useNavigate();
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!key){setFailed(true);return;}
    let active=true;
    (async()=>{
      const {data,error}=await (supabase as any).rpc("capture_residence_referral_click",{
        _link_key:key,
        _visitor_id:getVisitorId(),
        _landing_url:window.location.pathname+window.location.search,
        _user_agent:navigator.userAgent,
      });
      if(!active)return;
      if(error||!data?.code||!data?.slug){setFailed(true);return;}
      saveReferral(data.code,data.sessionId||null,data.agentName||"ResKonnect Recruiter",window.location.pathname,"student_recruitment");
      navigate(`/find-my-res/${data.slug}?ref=${encodeURIComponent(data.code)}&campaign=residence_recruiter`,{replace:true});
    })();
    return()=>{active=false;};
  },[key,navigate]);
  return <><SEO noIndex title="Accommodation Recruitment Link | ResKonnect" description="Opening a tracked ResKonnect accommodation campaign."/><div className="flex min-h-screen items-center justify-center bg-muted/20 p-4"><Card className="w-full max-w-md"><CardContent className="p-8 text-center">{failed?<><Building2 className="mx-auto h-10 w-10 text-muted-foreground"/><h1 className="mt-4 text-xl font-black">Campaign link unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This residence recruitment link may be paused or no longer active.</p><Button className="mt-5" onClick={()=>navigate("/find")}>Browse accommodation</Button></>:<><Loader2 className="mx-auto h-9 w-9 animate-spin text-primary"/><h1 className="mt-4 text-xl font-black">Opening accommodation campaign…</h1><p className="mt-2 text-sm text-muted-foreground">Connecting the recruiter, residence and your ResKonnect journey.</p></>}</CardContent></Card></div></>;
}
