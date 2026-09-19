import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Compass, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/accountRouting";

type Step = "profile" | "find" | "search" | "applications" | "updates" | "done";
const ORDER: Step[] = ["profile", "find", "search", "applications", "updates", "done"];
const STEPS: Record<Exclude<Step,"done">,{title:string;body:string;path:string;selector:string;action:string}> = {
 profile: {title:"Set up your profile",body:"Complete your missing student details and documents before applying. If the profile form is already open, finish it first; the guide will resume automatically.",path:"/setup-profile",selector:'a[href="/profile"],a[href="/setup-profile"],[data-rk-tour="profile"]',action:"Open profile"},
 find: {title:"Find your accommodation",body:"Find My Res shows student accommodation, location, images, room details and application options.",path:"/findmyres",selector:'a[href="/findmyres"],[data-rk-tour="find"]',action:"Open Find My Res"},
 search: {title:"Search and filter residences",body:"Choose your campus, filter for your needs, open a residence and check availability before applying.",path:"/findmyres",selector:'input[placeholder*="Search"],#results',action:"Explore accommodation"},
 applications: {title:"Track your applications",body:"Find your submissions and follow any status changes or feedback in My Applications.",path:"/my-applications",selector:'a[href="/my-applications"],[data-rk-tour="applications"]',action:"View applications"},
 updates: {title:"Stay informed",body:"The notification bell previews updates. Open Updates to read messages and see the full account history.",path:"/dashboard/updates",selector:'a[href="/dashboard/updates"],button[aria-label*="notification" i]',action:"View updates"},
};
function readStep(key:string):Step {try {const stored=localStorage.getItem(key) as Step;return ORDER.includes(stored)?stored:"profile";}catch{return "profile";}}

export default function NativeStudentGuide(){
 const {user,isStudent}=useAuth();
 const native=isNativeApp();
 const {pathname}=useLocation();
 const navigate=useNavigate();
 const {profile,loading}=useRealtimeProfile(native&&isStudent?user:null);
 const key=`rk_native_student_guide_v2_${user?.id||""}`;
 const [step,setStep]=useState<Step>("done");
 const [dismissed,setDismissed]=useState(false);
 const [docs,setDocs]=useState<string[]>([]);
 const [docsLoaded,setDocsLoaded]=useState(false);
 const [docsFailed,setDocsFailed]=useState(false);
 const [target,setTarget]=useState<{left:number;top:number;width:number;height:number;bottom:number}|null>(null);
 const [modalOpen,setModalOpen]=useState(false);
 const [ready,setReady]=useState(false);
 useEffect(()=>{setStep(user?readStep(key):"done");setDismissed(false);setDocs([]);setDocsLoaded(false);setDocsFailed(false);},[key,user?.id]);
 useEffect(()=>{if(!native||!user||!isStudent)return;let current=true;(async()=>{try{const {data,error}=await supabase.from("documents").select("document_type").eq("user_id",user.id);if(error)throw error;if(current)setDocs((data||[]).map((d:any)=>String(d.document_type).toLowerCase()));}catch{if(current)setDocsFailed(true);}finally{if(current)setDocsLoaded(true);}})();return()=>{current=false;};},[user?.id,isStudent,native]);
 const profileMissing=useMemo(()=>{if(!profile)return true;const p=profile as any;return !p.full_name||!p.phone||!p.campus||!(p.student_number||p.identity_number);},[profile]);
 const documentsMissing=useMemo(()=> !docsFailed && !docs.some(d=>/identity|(^id$)/.test(d)),[docs,docsFailed]);
 // Never lock the tour on an inaccessible optional document table or treat missing academic documents as an authentication failure.
 useEffect(()=>{if(!native||!isStudent||!user||loading||!docsLoaded||step!=="profile"||profileMissing||documentsMissing)return;setStep("find");try{localStorage.setItem(key,"find");}catch{/* optional persistence */}},[native,isStudent,user?.id,loading,docsLoaded,step,profileMissing,documentsMissing,key]);
 useEffect(()=>{if(!native||!user||!isStudent||step==="done"||dismissed){setTarget(null);return;}
  let scheduled=0;const refresh=()=>{window.cancelAnimationFrame(scheduled);scheduled=window.requestAnimationFrame(()=>{
   const blocking=Boolean(document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]'));
   setModalOpen(old=>old===blocking?old:blocking);
   if(blocking||pathname==="/auth"){setTarget(old=>old===null?old:null);return;}
   const element=document.querySelector(STEPS[step].selector);
   const box=element?.getBoundingClientRect();
   const next=box&&box.width>0&&box.height>0?{left:box.left,top:box.top,width:box.width,height:box.height,bottom:box.bottom}:null;
   setTarget(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
  });};
  const timer=window.setTimeout(refresh,300);const observer=new MutationObserver(refresh);
  observer.observe(document.body,{childList:true,subtree:true});window.addEventListener("resize",refresh);window.addEventListener("scroll",refresh,true);
  return()=>{window.clearTimeout(timer);window.cancelAnimationFrame(scheduled);observer.disconnect();window.removeEventListener("resize",refresh);window.removeEventListener("scroll",refresh,true);};
 },[native,user?.id,isStudent,step,dismissed,pathname]);
 const save=(next:Step)=>{setStep(next);try{localStorage.setItem(key,next);}catch{/* optional */}};
 const next=()=>save(ORDER[Math.min(ORDER.indexOf(step)+1,ORDER.length-1)]);
 const enabled=native&&Boolean(user&&isStudent)&&!dismissed&&!modalOpen&&step!=="done"&&pathname!=="/auth"&&!loading&&docsLoaded;
 if(!native||!user||!isStudent)return null;
 const item=step==="done"?null:STEPS[step];
 const open=()=>{if(!item)return;setReady(true);navigate(item.path);if(step!=="profile")next();window.setTimeout(()=>setReady(false),300);};
 return <>
  {dismissed&&step!=="done"&&pathname==="/dashboard"&&<button type="button" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[1300] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg" onClick={()=>setDismissed(false)}><Compass className="h-4 w-4"/>Resume guide</button>}
  {step==="done"&&pathname==="/dashboard"&&<button type="button" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[1300] rounded-full border bg-card px-3 py-2 text-xs font-semibold shadow-sm" onClick={()=>{save("profile");setDismissed(false);}}>App guide</button>}
  {enabled&&item&&<div role="dialog" aria-modal="true" aria-label="ResKonnect student walkthrough" className="fixed inset-0 z-[5000]" style={{pointerEvents:"none"}}>
   <div className="absolute inset-0 bg-slate-950/70" style={target?{clipPath:`polygon(0 0,100% 0,100% 100%,0 100%,0 0,${Math.max(0,target.left-6)}px ${Math.max(0,target.top-6)}px,${Math.max(0,target.left-6)}px ${Math.min(window.innerHeight,target.bottom+6)}px,${Math.min(window.innerWidth,target.left+target.width+6)}px ${Math.min(window.innerHeight,target.bottom+6)}px,${Math.min(window.innerWidth,target.left+target.width+6)}px ${Math.max(0,target.top-6)}px,${Math.max(0,target.left-6)}px ${Math.max(0,target.top-6)}px)`}:undefined}/>
   {target&&<div className="absolute rounded-xl border-2 border-cyan-300 shadow-[0_0_0_5px_rgba(103,232,249,.22)]" style={{left:Math.max(0,target.left-6),top:Math.max(0,target.top-6),width:target.width+12,height:target.height+12}}/>}
   <section className="absolute left-4 right-4 mx-auto max-w-sm rounded-2xl border border-primary/30 bg-card p-5 text-card-foreground shadow-2xl" style={{pointerEvents:"auto",top:target&&target.bottom+235<window.innerHeight?Math.max(12,target.bottom+18):undefined,bottom:target&&target.bottom+235<window.innerHeight?undefined:"max(1rem,env(safe-area-inset-bottom))"}}>
    <div className="flex items-start justify-between gap-3"><p className="text-xs font-black uppercase tracking-widest text-primary">Your app guide · {ORDER.indexOf(step)+1} of 5</p><button type="button" aria-label="Close guide" onClick={()=>setDismissed(true)}><X className="h-5 w-5"/></button></div>
    <h2 className="mt-2 text-lg font-black">{item.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
    {step==="profile"&&(profileMissing||documentsMissing)&&<p className="mt-2 text-xs font-semibold text-amber-700">Finish your missing profile information and required documents to continue. You can skip this step if browsing only.</p>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={open} disabled={ready} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">{item.action}</button><button type="button" className="rounded-xl border px-3 py-2.5 text-sm font-semibold" onClick={next}>{step==="profile"?"Explore first":"Next"}</button><button type="button" className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground" onClick={()=>{save("done");setDismissed(false);}}>Skip guide</button></div>
   </section>
  </div>}
 </>;
}
