import {useEffect,useMemo,useState} from "react";
import {ArrowRight, BellRing, CalendarDays, Megaphone, X} from "lucide-react";
import {Link} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {BRAND} from "@/constants/brand";
import {supabase} from "@/integrations/supabase/client";
import {toast} from "sonner";

type Announcement={
 id:string;title:string;subtitle:string|null;body:string;badge:string|null;
 cta_label:string|null;cta_url:string|null;image_url:string|null;
 graphic_variant:string|null;dismissible:boolean;
 starts_at:string|null;ends_at:string|null;updated_at:string;
 display_surface:"modal"|"corner";width_px:number;poster_only:boolean;
 show_frequency:"once_per_session"|"once_per_day"|"once_per_campaign";
 audience:string;
};
const day=86_400_000;
const key=(r:Announcement)=>`reskonnect_campaign_seen:${r.id}:${r.updated_at}`;
const scheduled=(r:Announcement,now:number)=>{
 const from=r.starts_at?new Date(r.starts_at).getTime():-Infinity;
 const to=r.ends_at?new Date(r.ends_at).getTime():Infinity;
 return Number.isFinite(from)||from===-Infinity?now>=from&&now<=to:false;
};
function suppressed(r:Announcement){
 try{
  const stored=r.show_frequency==="once_per_session"?sessionStorage.getItem(key(r)):localStorage.getItem(key(r));
  if(!stored)return false;
  return r.show_frequency==="once_per_day"?Date.now()-Number(stored)<day:true;
 }catch{return false;}
}
function recordDismissal(r:Announcement){
 try{
  const storage=r.show_frequency==="once_per_session"?sessionStorage:localStorage;
  storage.setItem(key(r),String(Date.now()));
 }catch{/* Browser storage may be disabled; closing should still work. */}
}
const safeAction=(value:string|null)=>{
 const url=(value||"").trim();
 if(url.startsWith("/")&&!url.startsWith("//")&&!url.startsWith("/\\")&&!url.includes("\\"))
  return {kind:"internal" as const,url};
 if(/^https:\/\//i.test(url))return {kind:"external" as const,url};
 return null;
};

export default function SiteAnnouncementPopup(){
 const [campaign,setCampaign]=useState<Announcement|null>(null);
 const [visible,setVisible]=useState(false);
 const [userId,setUserId]=useState<string|null>(null);
 useEffect(()=>{
  let mounted=true;
  void supabase.auth.getUser().then(({data})=>{
   if(mounted)setUserId(data.user?.id||null);
  }).catch(()=>{});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
   if(mounted)setUserId(session?.user?.id||null);
  });
  return()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  let cancelled=false;let timer:number|undefined;
  const load=async()=>{
   const {data,error}=await(supabase as any).from("site_announcements")
     .select("id,title,subtitle,body,badge,cta_label,cta_url,image_url,graphic_variant,dismissible,starts_at,ends_at,updated_at,display_surface,width_px,poster_only,show_frequency,audience")
     .eq("is_active",true).order("priority",{ascending:false})
     .order("updated_at",{ascending:false}).limit(25);
   if(cancelled||error||!Array.isArray(data))return;
   const now=Date.now();
   const row=(data as Announcement[]).find(item=>{
    const allowed=item.audience==="all"||
      (!item.audience)||
      (item.audience==="logged_in"&&!!userId)||
      (item.audience==="visitors"&&!userId);
    return allowed&&scheduled(item,now)&&!suppressed(item);
   });
   if(!row){setCampaign(null);setVisible(false);return;}
   setCampaign(row);
   timer=window.setTimeout(()=>{if(!cancelled)setVisible(true);},700);
  };
  void load();
  // Re-evaluate enabled/scheduled campaigns when tab becomes active and after admin edits.
  const refresh=()=>{if(document.visibilityState==="visible")void load();};
  document.addEventListener("visibilitychange",refresh);
  const interval=window.setInterval(refresh,90_000);
  const channel=supabase.channel("rk-public-promotion-campaigns")
    .on("postgres_changes",{event:"*",schema:"public",table:"site_announcements"},refresh)
    .subscribe();
  return()=>{cancelled=true;if(timer)window.clearTimeout(timer);
    document.removeEventListener("visibilitychange",refresh);
    window.clearInterval(interval);
    void supabase.removeChannel(channel);
  };
 },[userId]);

 if(!campaign||!visible)return null;
 const dismiss=()=>{
   if(campaign.dismissible!==false)recordDismissal(campaign);
   setVisible(false);
 };
 return <SitePromotionPresentation campaign={campaign} onDismiss={dismiss}/>;
}

/** Shared rendering between the public landing pop-up and the AdminOS media preview. */
export type PromotionCardData=Pick<Announcement,
 "title"|"subtitle"|"body"|"badge"|"cta_label"|"cta_url"|"image_url"|
 "graphic_variant"|"dismissible"|"display_surface"|"width_px"|"poster_only">;

export function SitePromotionPresentation({
 campaign,onDismiss,preview=false,device="desktop",
}:{
 campaign:PromotionCardData;
 onDismiss?:()=>void;
 preview?:boolean;
 device?:"desktop"|"mobile";
}){
 const action=useMemo(()=>safeAction(campaign.cta_url||null),[campaign.cta_url]);
 const width=Math.min(760,Math.max(280,Number(campaign.width_px)||440));
 const isPoster=Boolean(campaign.poster_only&&campaign.image_url);
 const corner=campaign.display_surface==="corner";
 const is2027=campaign.graphic_variant==="reskonnect_2027"||/2027/.test(`${campaign.badge||""} ${campaign.title||""}`);
 const dismiss=()=>onDismiss?.();
 const closeAllowed=campaign.dismissible!==false;
 const cta=action&&campaign.cta_label?(
    preview?<Button type="button" className="min-h-10 w-full rounded-xl text-sm font-black" onClick={()=>toast.info(`Preview only. The live button opens ${action.url}`)}>{campaign.cta_label}<ArrowRight className="ml-2 h-4 w-4"/></Button>:
   action.kind==="internal"
    ?<Button asChild className="min-h-10 w-full rounded-xl text-sm font-black" onClick={dismiss}>
      <Link to={action.url}>{campaign.cta_label}<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
    :<Button asChild className="min-h-10 w-full rounded-xl text-sm font-black" onClick={dismiss}>
      <a href={action.url} target="_blank" rel="noopener noreferrer">{campaign.cta_label}<ArrowRight className="ml-2 h-4 w-4"/></a></Button>
 ):null;
 return <div
   className={preview
    ?`relative flex w-full ${device==="mobile"?"min-h-[620px]":"min-h-[580px]"} ${corner?"items-end justify-end":"items-center justify-center"} bg-[#07172d] p-3 sm:p-5`
    :corner
    ?"pointer-events-none fixed inset-0 z-[120] flex items-end justify-end p-3 sm:p-5"
    :"fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm"}
   role="presentation" style={preview?{maxWidth:device==="mobile"?390:960,margin:"auto"}:undefined}>
   {closeAllowed&&!corner&&!preview&&<button type="button" onClick={dismiss}
     aria-label="Close promotion backdrop" className="absolute inset-0" tabIndex={-1}/>}
   <section role={preview?"group":"dialog"} aria-modal={!preview&&!corner} aria-label={campaign.title}
    className={`pointer-events-auto relative isolate w-full overflow-x-hidden overflow-y-auto rounded-2xl border border-border/40 bg-background shadow-2xl ${corner?"max-h-[min(78dvh,690px)]":"max-h-[calc(100dvh-1.5rem)]"}`}
    style={{maxWidth:`min(${width}px,100%)`}}>
    {closeAllowed&&<button type="button" onClick={dismiss}
      aria-label="Close promotion" className="absolute right-2 top-2 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/65 text-white shadow-lg backdrop-blur hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <X className="h-5 w-5"/></button>}
    {campaign.image_url?(
      <div className={`relative overflow-hidden ${isPoster?"bg-[#061633]":"h-36 bg-muted sm:h-48"}`}>
        <img src={campaign.image_url} alt={isPoster?campaign.title:""}
          className={isPoster?"block max-h-[min(66dvh,620px)] w-full object-contain":"h-full w-full object-cover"}/>
        {!isPoster&&<div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"/>}
      </div>
    ):(
      <div className="relative min-h-36 overflow-hidden bg-gradient-to-br from-[#061532] via-[#123e83] to-[#f6af22] p-5 text-white">
        <img src={BRAND.logos.full} alt={BRAND.name} className="h-10 w-auto max-w-[180px] rounded-lg bg-white/95 p-2 object-contain"/>
        <div className="mt-8 flex items-end justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-white/75">{is2027?"2027 Student accommodation":"Featured ResKonnect update"}</p>
            <p className="mt-1 text-2xl font-black">{is2027?"Your next chapter starts here.":"Discover more with ResKonnect."}</p></div>
          {is2027?<CalendarDays className="h-10 w-10 text-[#f6af22]"/>:<Megaphone className="h-10 w-10 text-[#f6af22]"/>}
        </div>
      </div>
    )}
    {isPoster?(
      <div className="space-y-2 p-3 sm:p-4">
        <p className="sr-only">{campaign.body}</p>
        {cta}
        {closeAllowed&&<button type="button" className="block w-full py-1 text-center text-xs text-muted-foreground underline underline-offset-2" onClick={dismiss}>Not now</button>}
      </div>
    ):(
      <div className="space-y-3 p-4 sm:p-6">
        <div className="flex items-center gap-2"><Badge>{campaign.badge||"RESKONNECT UPDATE"}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><BellRing className="h-3 w-3"/>Latest update</span></div>
        <h2 className="text-xl font-black sm:text-2xl">{campaign.title}</h2>
        {campaign.subtitle&&<p className="text-sm font-bold text-primary">{campaign.subtitle}</p>}
        <p className="text-sm leading-6 text-muted-foreground">{campaign.body}</p>
        {cta}
        {closeAllowed&&<Button variant="ghost" size="sm" className="w-full" onClick={dismiss}>Not now</Button>}
      </div>
    )}
   </section>
 </div>;
}
