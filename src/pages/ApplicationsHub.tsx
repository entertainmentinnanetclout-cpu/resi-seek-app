import { useEffect } from "react";
import { LockKeyhole } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import ApplicationsHubLegacy from "@/pages/ApplicationsHubLegacy";
import TvetApplicationsHub from "@/pages/TvetApplicationsHub";
import MyApplicationsCenter from "@/pages/MyApplicationsCenter";

const ApplicationsHub=()=>{
  const {user}=useAuth();
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const category=params.get("category")||university";
  const view=params.get("view");

  useEffect(()=>{
    if(view==="mine"&&!user){
      navigate(`/auth?returnTo=${encodeURIComponent("/apply?view=mine")}`,{replace:true});
      return;
    }
    if(user||category==="tvet")return;
    const intercept=(event:MouseEvent)=>{
      const button=(event.target as HTMLElement)?.closest?.("button");
      if(!button)return;
      const label=(button.textContent||"").toLowerCase();
      if(label.includes("check what i qualify for")){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const returnTo=`/apply?${params.toString()||"category=university"}`;
        navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      }
    };
    document.addEventListener("click",intercept,true);
    return()=>document.removeEventListener("click",intercept,true);
  },[user,category,navigate,params,view]);

  if(view==="mine"){
    return user?<MyApplicationsCenter/>:null;
  }
  if(category==="tvet")return <TvetApplicationsHub/>;
  return <>
    {!user&&category!=="private"&&category!=="private_college"&&<div className="fixed bottom-5 left-1/2 z-[80] w-[min(92vw,620px)] -translate-x-1/2 rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LockKeyhole className="h-4 w-4"/></div><div><p className="text-sm font-bold">Sign in for personalised APS and programme results</p><p className="mt-1 text-xs text-muted-foreground">Institution browsing stays public. Personalised results are private and saved to your ResKonnect account.</p></div></div><Button size="sm" onClick={()=>navigate(`/auth?returnTo=${encodeURIComponent(`/apply?${params.toString()||"category=university"}`)}`)}>Sign in</Button></div></div>}
    <ApplicationsHubLegacy/>
  </>;
};

export default ApplicationsHub;
