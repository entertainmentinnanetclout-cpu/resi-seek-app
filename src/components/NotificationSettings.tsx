import {useEffect,useState} from "react";
import {BellRing,Volume2,VolumeX,Info,RefreshCw} from "lucide-react";
import {useAuth} from "@/contexts/AuthContext";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {supabase} from "@/integrations/supabase/client";
import {isNativeShell,isPushSupported,pushPermission,subscribePushDetailed} from "@/lib/push";
import {categories,categoryLabels,tones,toneLabels,
  readNotificationSounds,saveNotificationSounds,playNotificationTone,
  type NotificationSoundPreferences,type AlertTone} from "@/lib/notificationSounds";
import {toast} from "sonner";

/** Browser push requires explicit permission and a saved server subscription.
 * Sounds play only while this tab or installed web app is active.
 */
export default function NotificationSettings(){
 const {user}=useAuth();
 const id=user?.id||"";
 const [preferences,setPreferences]=useState<NotificationSoundPreferences>(()=>readNotificationSounds(id));
 const [permission,setPermission]=useState<string>(()=>pushPermission());
 const [connected,setConnected]=useState(false);
 const [checking,setChecking]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{setPreferences(readNotificationSounds(id));setPermission(String(pushPermission()));},[id]);
 const check=async()=>{
  setChecking(true);
  try{
   setPermission(String(pushPermission()));
   if(!isPushSupported()||!user?.id){setConnected(false);return;}
   const reg=await navigator.serviceWorker.getRegistration("/");
   const sub=await reg?.pushManager.getSubscription();
   if(!sub){setConnected(false);return;}
   // Browser permission does not prove the provider stored the endpoint.
   const {data,error:failed}=await supabase.functions.invoke("push-subscription",{
    body:{action:"status",endpoint:sub.endpoint}
   });
   setConnected(!failed&&data?.registered===true);
  }catch{setConnected(false);}
  finally{setChecking(false);}
 };
 useEffect(()=>{void check();},[id]);
 const update=(next:NotificationSoundPreferences)=>{
  setPreferences(next);saveNotificationSounds(id,next);
 };
 const enable=async()=>{
  if(!id)return toast.error("Sign in first to link notifications securely to your account.");
  if(busy)return;
  setBusy(true);setError("");
  const result=await subscribePushDetailed();
  setPermission(String(result.permission));
  setBusy(false);
  if(!result.ok){setError(result.reason);setConnected(false);return;}
  setConnected(true);
  toast.success("Browser notification subscription registered.");
 };
 const testSound=async(tone:AlertTone)=>{
  const ok=await playNotificationTone(tone,true);
  if(!ok&&tone!=="off")toast.info("Audio is unavailable or blocked on this device; check browser sound permissions.");
 };
 const supported=isPushSupported();
 return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Notification permission and sound settings">
   <header className="flex flex-wrap items-start justify-between gap-3">
     <div><div className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary"/><h2 className="text-lg font-black">Notification preferences</h2></div>
       <p className="mt-1 text-xs leading-5 text-muted-foreground">Control browser alerts and separate sounds for applications, reservations and student enquiries. Settings are saved on this device.</p>
     </div>
     <Badge variant={connected?"default":"secondary"}>{connected?"Push connected":permission==="denied"?"Blocked in browser":supported?"Setup needed":"Browser unavailable"}</Badge>
   </header>
   <div className="rounded-xl border bg-muted/25 p-3">
     <div className="flex flex-wrap items-center gap-2">
       <Button size="sm" disabled={busy||!supported||!id} onClick={()=>void enable()}>
         {busy?"Connecting…":permission==="granted"?"Connect / repair notifications":"Enable browser notifications"}
       </Button>
       <Button size="sm" variant="outline" onClick={()=>void check()} disabled={checking}><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>{checking?"Checking…":"Check connection"}</Button>
     </div>
     <p className="mt-2 text-xs leading-5 text-muted-foreground">
       {isNativeShell()?"For Android's native app, use Android notifications in your account settings. Browser push controls do not apply to the native shell.":
       !supported?"This browser does not expose web push here. On iPhone/iPad, install ResKonnect to the Home Screen, then open that icon and tap Enable.":
       permission==="denied"?"Your browser has already blocked this site. Change permission in the browser's site settings and your laptop's System Settings → Notifications, then return and retry.":
       "Tap Enable to request your browser's permission. You must approve the system prompt; a website cannot switch notification permission on for you."}
     </p>
     {error&&<p role="alert" className="mt-2 text-xs font-semibold text-amber-700">{error}</p>}
     {permission==="granted"&&!connected&&<p className="mt-2 text-xs font-semibold text-amber-700">Permission is granted, but the subscription is not yet verified on ResKonnect. Use Connect / repair.</p>}
   </div>
   <div className="space-y-3 rounded-xl border p-3">
     <div className="flex flex-wrap items-center justify-between gap-3">
       <div className="flex items-center gap-2">{preferences.enabled?<Volume2 className="h-4 w-4 text-primary"/>:<VolumeX className="h-4 w-4 text-muted-foreground"/>}
         <div><p className="text-sm font-black">Play notification sounds</p><p className="text-[11px] text-muted-foreground">Only while ResKonnect is open and device audio is permitted</p></div>
       </div>
       <Button size="sm" variant={preferences.enabled?"outline":"default"} onClick={()=>{
         update({...preferences,enabled:!preferences.enabled});
         if(!preferences.enabled)void testSound(preferences.tones.general);
       }}>{preferences.enabled?"Mute sounds":"Turn on sounds"}</Button>
     </div>
     {categories.map(category=><div className="flex flex-wrap items-center justify-between gap-2" key={category}>
       <label className="text-xs font-semibold" htmlFor={`notification-tone-${category}`}>{categoryLabels[category]}</label>
       <div className="flex gap-2">
         <select id={`notification-tone-${category}`} className="h-9 rounded-lg border bg-background px-2 text-xs"
           value={preferences.tones[category]} onChange={e=>update({...preferences,tones:{...preferences.tones,[category]:e.target.value as AlertTone}})}>
           {tones.map(tone=><option key={tone} value={tone}>{toneLabels[tone]}</option>)}
         </select>
         <Button size="sm" type="button" variant="outline" onClick={()=>void testSound(preferences.tones[category])}>Test</Button>
       </div>
     </div>)}
   </div>
   <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0"/>
     When the browser or installed app is closed, delivery depends on a registered push subscription, server dispatch and the device's operating-system settings. Custom webpage tones cannot play while the site is closed. Browser permissions and sound choices are never silently enabled.
   </p>
 </section>;
}
