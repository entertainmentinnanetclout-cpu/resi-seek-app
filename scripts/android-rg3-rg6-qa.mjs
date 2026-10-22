import fs from "node:fs";
import assert from "node:assert/strict";

const read = path => fs.readFileSync(path, "utf8");
const release = JSON.parse(read("native/android-release.json"));
const checks = [
  ["RG1 direct full dashboard", () => {
    const route = read("src/pages/Dashboard.tsx");
    const header = read("src/components/NativeAccountNavigation.tsx");
    assert.ok(route.includes("FullDashboard") && !route.includes("<NativeSafeDashboard"));
    assert.ok(header.includes("<NativeGuidedOnboarding /> : null") && !header.includes("<nav") && !header.includes("<Link"));
  }],
  ["RG2 stateful first-run guide", () => {
    const tour = read("src/components/native/NativeGuidedOnboarding.tsx");
    for (const term of ["rk_native_guide_v1_", "MutationObserver", "Skip guide", "Close app guide", "Find My Res", "profileNeedsAttention", "my-applications", "100dvh", "orientationchange"]) assert.ok(tour.includes(term), term);
    assert.ok(!tour.includes('button:has('), "native guide must not depend on relational :has selectors");
  }],
  ["RG2 Android 16 predictive-back onboarding escape", () => {
    const activity = read("android/app/src/main/java/org/reskonnect/app/MainActivity.java");
    assert.ok(activity.includes("OnBackPressedCallback") && activity.includes("getOnBackPressedDispatcher") && activity.includes("rk-native-guide-dismiss") && activity.includes("canGoBack"));
    assert.ok(!activity.includes("public void onBackPressed()"), "targetSdk 36 must not depend on the unsupported Activity.onBackPressed override");
  }],
  ["RG2 API 36 edge-to-edge and safe insets", () => {
    const activity = read("android/app/src/main/java/org/reskonnect/app/MainActivity.java");
    const config = JSON.parse(read("capacitor.config.json"));
    assert.ok(activity.includes("androidx.activity.EdgeToEdge") && activity.includes("EdgeToEdge.enable(this)"));
    assert.equal(config.plugins?.SystemBars?.insetsHandling, "native");
    assert.equal(config.plugins?.SystemBars?.initialViewportFitValueHint, "cover");
  }],
  ["RG3 Android permission and low-resource 3D fallback", () => {
    const location = read("src/lib/resmap/liveLocation.ts");
    const map = read("src/components/resmap/NativeResMapExperience.tsx");
    const platform = read("src/components/resmap/ResMapPlatform.tsx");
    assert.ok(location.includes("requestPermissions") && location.includes("getCurrentPosition") && location.includes("choose your campus manually"));
    assert.ok(map.includes("safeForVector") && map.includes("Return to the 2D map") && !map.includes("new Map3DElement("));
    assert.ok(map.includes("ResMapExperienceStable") && map.includes("allow3d={false}") && map.includes("rk_native_safe_graphics_v1"));
    assert.ok(platform.includes("NativeMap") && platform.includes("WebMap") && platform.includes("lazy("));
  }],
  ["RG3 nearby listing locality before valid-photo priority", () => {
    const nearby = read("src/components/findmyres/NearbySuggestedResidences.tsx");
    assert.ok(nearby.includes("_locality") && nearby.includes("_hasRealPhoto") && nearby.includes("distanceKm"));
    assert.ok(nearby.indexOf("a._locality - b._locality") < nearby.indexOf("Number(b._hasRealPhoto)"));
  }],
  ["RG4 notification opens private full detail", () => {
    const centre = read("src/components/NotificationCenter.tsx");
    const page = read("src/pages/NotificationDetail.tsx");
    const inbox = read("src/pages/Updates.tsx");
    assert.ok(centre.includes("/dashboard/updates?id=") && inbox.includes("<NotificationDetail"));
    assert.ok(page.includes('.eq("user_id", user.id)') && page.includes("whitespace-pre-wrap"));
    assert.ok(page.includes("const allow = new Set") && !page.includes("window.open"));
  }],
  ["RG4 one account-scoped realtime store and no duplicate event alert", () => {
    const hook = read("src/hooks/useRealtimeNotifications.ts");
    assert.ok(hook.includes("stores = new Map") && hook.includes("store.seen") && hook.includes("user_id=eq.${userId}"));
    assert.ok(hook.includes("nativeForegroundAlert") && hook.includes(".eq(\"user_id\", userId)"));
  }],
  ["RG4 local notifications require opt-in and generic lock-screen text", () => {
    const native = read("src/lib/nativeNotifications.ts");
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    const settings = read("src/components/native/NativeAlertSettings.tsx");
    assert.ok(native.includes("requestPermissions") && native.includes("foregroundAlertsEnabled") && native.includes("ResKonnect update"));
    assert.ok(manifest.includes("POST_NOTIFICATIONS") && settings.includes("enableForegroundAlerts") && settings.includes("startNativePush") && settings.includes("generic wording"));
  }],
  ["RG4 native FCM token ownership and logout cleanup", () => {
    const client = read("src/lib/nativePush.ts");
    const auth = read("src/contexts/AuthContext.tsx");
    const sql = read("supabase/migrations/20260919131500_android_rg4_account_notifications.sql");
    for (const term of ["PushNotifications", "rk_register_native_push_token", "rk_unregister_native_push_token", "pushNotificationActionPerformed", "reskonnect_updates"]) assert.ok(client.includes(term), term);
    assert.ok(client.includes("ResKonnect update") && client.includes("Tap to view your latest account update."));
    assert.ok(auth.includes("unregisterNativePushToken") && auth.indexOf("unregisterNativePushToken()") < auth.indexOf("supabase.auth.signOut"));
    assert.ok(sql.includes("auth.uid()") && sql.includes("rk_unregister_native_push_token") && sql.includes("enable row level security"));
  }],
  ["RG4 dual web + FCM server sender", () => {
    const sender = read("supabase/functions/send-push/index.ts");
    for (const term of ["FIREBASE_SERVICE_ACCOUNT_JSON", "firebase.messaging", "fcm.googleapis.com/v1/projects/", "rk_native_device_tokens", "last_success_at", "push_subscriptions"]) assert.ok(sender.includes(term), term);
    assert.ok(sender.includes("ResKonnect update") && sender.includes("Tap to view your latest account update."));
    assert.ok(!sender.includes("service_account.json"), "Firebase credentials must come from protected environment only");
  }],
  ["RG4 idempotent backend events and owner-bound token registry", () => {
    const sql = read("supabase/migrations/20260919131500_android_rg4_account_notifications.sql");
    assert.ok(sql.includes("on conflict(event_key) do nothing") && sql.includes("notifications_user_created_idx"));
    assert.ok(!sql.includes("whatsapp_messages") && !sql.includes("SEND_SMS"));
  }],
  ["RG5 verified Android App Links are host-bound", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    const links = read("src/lib/nativeAppLinks.ts");
    const emitter = read("scripts/emit-android-assetlinks.mjs");
    assert.ok(manifest.includes('android:autoVerify="true"') && manifest.includes('android.intent.category.BROWSABLE') && manifest.includes('android:host="www.reskonnect.org"'));
    assert.ok(links.includes("appUrlOpen") && links.includes("getLaunchUrl") && links.includes("www.reskonnect.org") && links.includes("safeNativeRoute"));
    assert.ok(emitter.includes("ANDROID_APP_LINKS_SHA256_CERTS") && emitter.includes("org.reskonnect.app") && emitter.includes("sha256_cert_fingerprints"));
  }],
  ["RG5 branded dashboard first paint", () => {
    const full = read("src/components/FullDashboard.tsx");
    const quick = read("src/components/native/NativeDashboardHighlights.tsx");
    assert.ok(full.includes("<NativeDashboardHighlights") && quick.includes("Find My Res") && quick.includes("Notifications"));
    assert.ok(!quick.includes("Promise.all") && !quick.includes("from(\"residences\")"));
  }],
  ["RG6 WebView renderer survival", () => {
    const activity = read("android/app/src/main/java/org/reskonnect/app/MainActivity.java");
    assert.ok(activity.includes("onRenderProcessGone") && activity.includes("view.destroy()") && activity.includes("recreate") && activity.includes("return true"));
  }],
  ["RG6 version, plugin and protected signing parity", () => {
    const readiness = read(".github/workflows/android-playstore-readiness.yml");
    const signed = read(".github/workflows/android-playstore-release.yml");
    assert.equal(release.versionName, "1.1.6"); assert.equal(release.versionCode, 9);
    for (const dependency of ["@capacitor/app@8.0.0", "@capacitor/local-notifications@8.0.0", "@capacitor/push-notifications@8.0.0"]) {
      assert.ok(readiness.includes(dependency) && signed.includes(dependency), dependency);
    }
    assert.ok(signed.includes("RK_ANDROID_UPLOAD_KEYSTORE_B64") && signed.includes("jarsigner") && signed.includes("RK_FIREBASE_GOOGLE_SERVICES_JSON_B64"));
    assert.equal(release.nativePushClientImplemented, true);
    assert.equal(release.nativePushNotifications, false, "Provider credentials and Play-device delivery must be verified before claiming closed-app FCM operational");
    assert.equal(release.androidAppLinksClientImplemented, true);
    assert.equal(release.androidAppLinksVerified, false, "Play App Signing certificate association must be externally verified before claiming verified links");
  }],
];
let failed = 0;
for (const [name, run] of checks) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}`, error.message); }
}
if (failed) process.exitCode = 1;
else console.log(`RG3–RG6 native source checks passed (${checks.length} checks); provider credentials and physical Play-device delivery remain explicit external verification gates.`);
