/** Local, opt-in foreground notification tones. OS/closed-app sound is governed
 * by the browser/device and cannot be synthesized by website JavaScript. */
export type AlertTone="off"|"soft"|"chime"|"bright"|"urgent";
export type AlertCategory="application"|"reservation"|"inquiry"|"general";
export type NotificationSoundPreferences={
 enabled:boolean;
 tones:Record<AlertCategory,AlertTone>;
};
const defaults:NotificationSoundPreferences={enabled:false,tones:{
 application:"chime",reservation:"bright",inquiry:"soft",general:"soft"
}};
const storageKey=(userId:string)=>`rk_notification_sounds_v1:${userId}`;
export const toneLabels:Record<AlertTone,string>={
 off:"Silent",soft:"Gentle",chime:"Chime",bright:"Bright",urgent:"Urgent"
};
export const categoryLabels:Record<AlertCategory,string>={
 application:"Applications",reservation:"Reservations",inquiry:"Enquiries",general:"Other updates"
};
export const categories:AlertCategory[]=["application","reservation","inquiry","general"];
export const tones:AlertTone[]=["off","soft","chime","bright","urgent"];
export function readNotificationSounds(userId:string):NotificationSoundPreferences{
 if(!userId)return defaults;
 try{
  const parsed=JSON.parse(localStorage.getItem(storageKey(userId))||"null");
  return {enabled:parsed?.enabled===true,tones:Object.fromEntries(categories.map(category=>{
   const value=parsed?.tones?.[category];
   return [category,tones.includes(value)?value:defaults.tones[category]];
  })) as NotificationSoundPreferences["tones"]};
 }catch{return defaults;}
}
export function saveNotificationSounds(userId:string,next:NotificationSoundPreferences){
 if(!userId)return;
 try{
  localStorage.setItem(storageKey(userId),JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("rk-notification-tone-changed",{detail:{userId}}));
 }catch{/* Settings must not break notifications when storage is restricted. */}
}
export function categoryForNotice(type:string):AlertCategory{
 const t=type.toLowerCase();
 if(t.includes("application"))return "application";
 if(t.includes("reservation")||t.includes("single_room"))return "reservation";
 if(t.includes("inquir")||t.includes("enquir")||t.includes("message"))return "inquiry";
 return "general";
}
let ctx:AudioContext|null=null;
let lastToneAt=0;
export async function playNotificationTone(tone:AlertTone,preview=false){
 if(tone==="off"||typeof window==="undefined"||document.visibilityState!=="visible")return false;
 if(!preview&&Date.now()-lastToneAt<1800)return false;
 try{
  const Audio=(window.AudioContext||(window as any).webkitAudioContext) as typeof AudioContext|undefined;
  if(!Audio)return false;
  ctx=ctx||new Audio();
  if(ctx.state==="suspended"){
   // Some browsers require a prior manual Test Sound tap. Never force autoplay.
   await ctx.resume();
  }
  if(ctx.state!=="running")return false;
  lastToneAt=Date.now();
  const notes:Record<Exclude<AlertTone,"off">,Array<[number,number]>>={
   soft:[[523,0],[659,.14]],chime:[[784,0],[1047,.18],[1318,.38]],
   bright:[[659,0],[988,.12],[1318,.24]],urgent:[[440,0],[440,.16],[659,.33]]
  };
  for(const [frequency,at] of notes[tone]){
   const oscillator=ctx.createOscillator();
   const gain=ctx.createGain();
   oscillator.type=tone==="urgent"?"triangle":"sine";
   oscillator.frequency.setValueAtTime(frequency,ctx.currentTime+at);
   gain.gain.setValueAtTime(.0001,ctx.currentTime+at);
   gain.gain.exponentialRampToValueAtTime(tone==="urgent"?.085:.055,ctx.currentTime+at+.016);
   gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+at+.17);
   oscillator.connect(gain);gain.connect(ctx.destination);
   oscillator.start(ctx.currentTime+at);oscillator.stop(ctx.currentTime+at+.18);
  }
  return true;
 }catch{return false;}
}
/** Browsers block unattended Web Audio after reload. Arm a previously opted-in
 * user's tone on their first ordinary interaction; never change preferences. */
export function armNotificationAudioOnInteraction(userId:string):()=>void{
 if(typeof window==="undefined"||!userId||!readNotificationSounds(userId).enabled)return ()=>{};
 let active=true;
 const cleanup=()=>{
   if(!active)return;
   active=false;
   document.removeEventListener("pointerdown",unlock);
   document.removeEventListener("keydown",unlock);
 };
 const unlock=()=>{
   if(!active)return;
   const Audio=(window.AudioContext||(window as any).webkitAudioContext) as typeof AudioContext|undefined;
   if(Audio){
     try{
       ctx=ctx||new Audio();
       if(ctx.state==="suspended")void ctx.resume().catch(()=>{});
     }catch{/* OS audio is optional; push notifications remain independent. */}
   }
   cleanup();
 };
 document.addEventListener("pointerdown",unlock,{passive:true,once:true});
 document.addEventListener("keydown",unlock,{once:true});
 return cleanup;
}
export function playNoticeSound(userId:string,type:string){
 if(!userId||typeof document==="undefined"||document.visibilityState!=="visible")return;
 const preferences=readNotificationSounds(userId);
 if(!preferences.enabled)return;
 void playNotificationTone(preferences.tones[categoryForNotice(type)]).catch(()=>{});
}
