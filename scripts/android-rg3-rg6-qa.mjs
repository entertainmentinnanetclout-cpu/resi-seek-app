import fs from "node:fs";
import assert from "node:assert/strict";

const read = path => fs.readFileSync(path, "utf8");
const release = JSON.parse(read("native/android-release.json"));
const checks = [
  ["RG1 direct full dashboard", () => {
    const route = read("src/pages/Dashboard.tsx");
    const header = read("src/components/NativeAccountNavigation.tsx");
    assert.ok(route.includes("FullDashboard") && !route.includes("<NativeSafeDashboard"));
    assert.ok(header.includes("return null") && !header.includes("App account navigation"));
  }],
  ["RG2 stateful first-run guide", () => {
    const tour = read("src/components/native/NativeGuidedOnboarding.tsx");
    for (const term of ["rk_native_guide_v1_", "MutationObserver", "Skip guide", "Find My Res", "profileNeedsAttention", "my-applications"]) assert.ok(tour.includes(term), term);
  }],
  ["RG3 Android permission and low-resource 3D fallback", () => {
    const location = read("src/lib/resmap/liveLocation.ts");
    const map = read("src/components/resmap/NativeResMapExperience.tsx");
    const platform = read("src/components/resmap/ResMapPlatform.tsx");
    assert.ok(location.includes("requestPermissions") && location.includes("getCurrentPosition") && location.includes("choose your campus manually"));
    assert.ok(map.includes("safeForVector") && map.includes("Return to the 2D map") && !map.includes("Map3DElement"));
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
    assert.ok(manifest.includes("POST_NOTIFICATIONS") && settings.includes("enableForegroundAlerts") && settings.includes("Background and closed-app alerts require"));
  }],
  ["RG4 idempotent backend events and owner-bound token registry", () => {
    const sql = read("supabase/migrations/20260919131500_android_rg4_account_notifications.sql");
    assert.ok(sql.includes("on conflict(event_key) do nothing") && sql.includes("notifications_user_created_idx"));
    assert.ok(sql.includes("auth.uid()") && sql.includes("rk_unregister_native_push_token") && sql.includes("enable row level security"));
    assert.ok(!sql.includes("whatsapp_messages") && !sql.includes("SEND_SMS"));
  }],
  ["RG5 branded dashboard first paint", () => {
    const full = read("src/components/FullDashboard.tsx");
    const quick = read("src/components/native/NativeDashboardHighlights.tsx");
    assert.ok(full.includes("<NativeDashboardHighlights") && quick.includes("Find My Res") && quick.includes("Notifications"));
    assert.ok(!quick.includes("Promise.all") && !quick.includes("from(\"residences\")"));
  }],
  ["RG6 version and protected signing parity", () => {
    const readiness = read(".github/workflows/android-playstore-readiness.yml");
    const signed = read(".github/workflows/android-playstore-release.yml");
    assert.equal(release.versionName, "1.1.3"); assert.equal(release.versionCode, 6);
    assert.ok(readiness.includes("@capacitor/local-notifications@8.0.0") && signed.includes("@capacitor/local-notifications@8.0.0"));
    assert.ok(signed.includes("RK_ANDROID_UPLOAD_KEYSTORE_B64") && signed.includes("jarsigner"));
    assert.equal(release.nativePushNotifications, false, "Never represent FCM background delivery as working without provider configuration");
  }],
];
let failed = 0;
for (const [name, run] of checks) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}`, error.message); }
}
if (failed) process.exitCode = 1;
else console.log(`RG3–RG6 native source checks passed (${checks.length} checks); hardware/FCM delivery verification remains separate.`);
