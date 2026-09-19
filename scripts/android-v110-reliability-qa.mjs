import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const expect=(condition,message)=>{if(!condition){console.error("FAIL:",message);process.exitCode=1;}else console.log("PASS:",message);};

const auth=read("src/contexts/AuthContext.tsx");
const header=read("src/components/SiteHeader.tsx");
const home=read("src/components/HomeJourneyBar.tsx");
const push=read("src/lib/push.ts");
const prompt=read("src/components/PushPrompt.tsx");
const app=read("src/App.tsx");
const notFound=read("src/pages/NotFound.tsx");
const index=read("index.html");
const vite=read("vite.config.ts");
const config=read("supabase/config.toml");
const native=JSON.parse(read("native/android-release.json"));
const dashboard=read("src/components/DashboardLayout.tsx");
const notifications=read("src/hooks/useRealtimeNotifications.ts");
const fullMessage=read("src/pages/NotificationDetail.tsx");

expect(auth.includes('rpc("get_my_access_context")'),"auth bootstrap uses one access-context RPC");
expect(auth.includes("refreshSession"),"auth reconciles near-expiry sessions after resume");
expect(auth.includes('visibilitychange'),"auth reconciles Android/web sessions on resume");
expect(header.includes("useAuth")&&header.includes("My ResKonnect"),"public header reflects signed-in session");
expect(home.includes("useAuth")&&home.includes("My ResKonnect"),"home journey reflects signed-in session");
expect(prompt.includes("isNativeShell")&&prompt.includes("!user?.id"),"web push prompt is disabled for native/anonymous users");
expect(push.includes('functions.invoke("push-subscription"'),"web push subscription uses authenticated server ownership endpoint");
expect(push.includes('getRegistration("/")'),"web push reuses existing PWA service worker");
expect(!index.includes("Legacy SW unregistered")&&!index.includes("getRegistrations().then"),"page load no longer unregisters service worker");
expect(vite.includes('importScripts: ["/push-sw.js"]'),"Workbox imports dedicated push handlers");
expect(vite.includes("globPatterns"),"PWA install uses bounded shell precache");
expect(config.includes('project_id = "mefjzkhobkltlbmhusdh"'),"Supabase config targets production project");
expect(config.includes("[functions.push-subscription]\nverify_jwt = true"),"web push subscription requires JWT");
expect(config.includes("[functions.vapid-public-key]\nverify_jwt = false"),"VAPID public key endpoint is intentionally public");
expect(config.includes("[functions.send-push]\nverify_jwt = true"),"web push fan-out requires JWT");
expect(!notFound.includes("CareerEducation")&&!notFound.includes("ManagedSeoPage"),"404 no longer defeats route splitting");
expect(app.includes('const Landing = lazy(')&&app.includes("DeferredGlobalEnhancements"),"landing/global enhancements are split from boot bundle");
expect(dashboard.includes("!isMobile")&&dashboard.includes("dashboard-notifications-mobile"),"dashboard mounts one notification centre per viewport");
expect(notifications.includes("stores = new Map")&&fullMessage.includes('.eq("user_id", user.id)'),"notifications share one realtime feed and full details are owner-scoped");
expect(native.versionName==="1.1.3"&&native.versionCode===6,"Android release metadata is 1.1.3 / versionCode 6");
expect(native.foregroundLocalNotifications===true&&native.nativePushNotifications===false,"foreground notification support is distinct from unconfigured FCM background push");

if(process.exitCode) process.exit(process.exitCode);
console.log("Android/web reliability gate passed.");
