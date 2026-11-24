import { supabase, EXTERNAL_SUPABASE_ANON_KEY, externalFunctionUrl } from "@/integrations/supabase/client";

let VAPID_PUBLIC_KEY = "";
type PushKeyResult={ready:boolean;reason:string;publicKey:string};
let keyInflight:Promise<PushKeyResult>|null=null;

export function isNativeShell() {
  return typeof window !== "undefined" && Boolean((window as any).Capacitor?.isNativePlatform?.());
}

/** Safe public-only check. The signing private key never leaves Supabase Vault. */
async function resolveVapidKey(): Promise<PushKeyResult> {
  if(VAPID_PUBLIC_KEY)return {ready:true,publicKey:VAPID_PUBLIC_KEY,reason:"Signing key available"};
  if(keyInflight)return keyInflight;
  keyInflight=(async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(externalFunctionUrl("vapid-public-key"),{
        headers:{apikey:EXTERNAL_SUPABASE_ANON_KEY},
        signal:controller.signal,
        cache:"no-store",
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok){
        const detail=String(body.error||"Web Push credentials are unavailable");
        return {ready:false,publicKey:"",reason:`Notification server returned ${response.status}: ${detail}. Please contact the ResKonnect administrator.`};
      }
      const value=typeof body.publicKey==="string"?body.publicKey.trim():"";
      let valid=false;
      try{
        const decoded=urlBase64ToUint8Array(value);
        valid=decoded.length===65&&decoded[0]===4;
      }catch{/* Invalid base64url is never accepted. */}
      if(!valid)return {ready:false,publicKey:"",reason:"ResKonnect returned an invalid Web Push public key. An administrator needs to repair its server configuration."};
      VAPID_PUBLIC_KEY=value;
      return {ready:true,publicKey:value,reason:"Web Push key available"};
    }catch(error){
      console.warn("[push] Public VAPID key lookup failed",error);
      return {ready:false,publicKey:"",reason:"Unable to contact the ResKonnect notification service. Check your internet connection, then retry."};
    }finally{clearTimeout(timer);}
  })().finally(()=>{keyInflight=null;});
  return keyInflight;
}
export async function checkPushKeyAvailability():Promise<{ready:boolean;reason:string}>{
  const {ready,reason}=await resolveVapidKey();
  return {ready,reason};
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (isNativeShell() || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return await navigator.serviceWorker.ready;
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn("[push] Service worker unavailable:", error);
    return null;
  }
}

export type PushSetupResult={ok:boolean;reason:string;permission:NotificationPermission|"unsupported"};
export async function subscribePushDetailed(): Promise<PushSetupResult> {
  if (!isPushSupported()) return {ok:false,reason:"Web push is unavailable in this browser or app mode. On iPhone, first add ResKonnect to your Home Screen and open it from that icon.",permission:"unsupported"};
  if(Notification.permission==="denied")return {
    ok:false,reason:"Notifications are blocked in your browser's site settings. Enable them there and in your device's Notifications settings, then retry.",
    permission:"denied"
  };

  // IMPORTANT: invoke the browser permission request synchronously from the
  // Enable button gesture. Awaiting Supabase/network calls first loses user
  // activation in Safari and other browsers.
  let permission: NotificationPermission;
  try {permission=await Notification.requestPermission();}
  catch{return {ok:false,reason:"The browser blocked the permission request. Check site notification settings.",permission:Notification.permission};}
  if(permission!=="granted")return {ok:false,reason:permission==="denied"?"Notifications are blocked in your browser settings. Allow them for this site and retry.":"Choose Allow in the browser permission dialog to enable notifications.",permission};

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user?.id || !session.access_token) {
    console.warn("[push] Sign-in is required before notification registration");
    return {ok:false,reason:"Sign in before registering a notification subscription.",permission};
  }

  const keyResult=await resolveVapidKey();
  if(!keyResult.ready)return {ok:false,reason:keyResult.reason,permission};
  const key=keyResult.publicKey;
  const registration=await ensureServiceWorker();
  if(!registration)return {ok:false,reason:"The service worker could not start. Refresh or install the ResKonnect app and retry.",permission};

  try {
    let subscription = await registration.pushManager.getSubscription();
    // A browser may retain a subscription signed with an older application
    // server key. Replace it rather than reporting a false successful repair.
    if(subscription?.options.applicationServerKey){
      const oldKey=new Uint8Array(subscription.options.applicationServerKey);
      const newKey=urlBase64ToUint8Array(key);
      if(oldKey.length!==newKey.length||oldKey.some((v,i)=>v!==newKey[i])){
        await subscription.unsubscribe();
        subscription=null;
      }
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    const payload: any = subscription.toJSON();
    const { error } = await supabase.functions.invoke("push-subscription", {
      body: {
        action: "upsert",
        endpoint: payload.endpoint,
        p256dh: payload.keys?.p256dh,
        auth: payload.keys?.auth,
        user_agent: navigator.userAgent,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if(error){
      const context=(error as any)?.context;
      let detail="";
      try{const json=typeof context?.json==="function"?await context.json():null;detail=String(json?.error||"");}
      catch{/* Some Edge errors do not have an HTTP response body. */}
      throw new Error(detail||error.message||"Could not save the subscription");
    }
    return {ok:true,reason:"Notifications enabled",permission};
  } catch (error) {
    console.error("[push] Subscription registration failed:", error);
    const description=error instanceof Error?error.message:"Unknown subscription error";
    return {ok:false,reason:`Browser permission is granted, but the device could not be registered: ${description}. Check network settings and retry.`,permission};
  }
}

export async function subscribePush():Promise<boolean>{return (await subscribePushDetailed()).ok;}

export function isPushSupported() {
  return !isNativeShell()
    && typeof window !== "undefined"
    && "Notification" in window
    && typeof navigator !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}
