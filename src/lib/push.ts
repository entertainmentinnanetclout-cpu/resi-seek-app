import { supabase, EXTERNAL_SUPABASE_ANON_KEY, externalFunctionUrl } from "@/integrations/supabase/client";

let VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || "";

export function isNativeShell() {
  return typeof window !== "undefined" && Boolean((window as any).Capacitor?.isNativePlatform?.());
}

const validVapidKey=(value:unknown):value is string=>
  typeof value==="string" && /^B[A-Za-z0-9_-]{86}$/.test(value.trim());

async function getVapidKey():Promise<string>{
  // The public verification key is stored in Supabase Vault and exposed by an
  // authenticated-safe, no-argument RPC. The key itself is not a secret.
  if(validVapidKey(VAPID_PUBLIC_KEY))return VAPID_PUBLIC_KEY.trim();
  let cause="Public notification key could not be retrieved.";
  try{
    const {data,error}=await (supabase as any).rpc("rk_web_push_public_key");
    if(!error&&validVapidKey(data)){
      VAPID_PUBLIC_KEY=data.trim();return VAPID_PUBLIC_KEY;
    }
    cause=error?.message||"The public key lookup returned an invalid key.";
  }catch(error){
    cause=error instanceof Error?error.message:cause;
  }
  // An independent Edge endpoint lets registration recover if Data API/RPC
  // access is temporarily degraded. Never use a fabricated VAPID key.
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const res=await fetch(externalFunctionUrl("vapid-public-key"),{
        method:"GET",
        headers:{apikey:EXTERNAL_SUPABASE_ANON_KEY},
        cache:"no-store",signal:controller.signal
      });
      const body=await res.json().catch(()=>({}));
      if(res.ok&&validVapidKey(body.publicKey)){
        VAPID_PUBLIC_KEY=body.publicKey.trim();return VAPID_PUBLIC_KEY;
      }
      cause=body?.error||`Notification key endpoint returned HTTP ${res.status}`;
    }finally{clearTimeout(timeout);}
  }catch(error){
    cause=error instanceof Error?error.message:cause;
  }
  throw new Error(cause);
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

  let key:string;
  try{key=await getVapidKey();}
  catch(error){
    const reason=error instanceof Error?error.message:"Notification key could not be retrieved";
    return {ok:false,reason:`Browser permission is granted, but ResKonnect could not load its public push key: ${reason}. Refresh and try Connect / repair; in the meantime you can enable in-app sounds separately.`,permission};
  }
  const registration=await ensureServiceWorker();
  if(!registration)return {ok:false,reason:"The service worker could not start. Refresh or install the ResKonnect app and retry.",permission};

  try {
    let subscription = await registration.pushManager.getSubscription();
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
