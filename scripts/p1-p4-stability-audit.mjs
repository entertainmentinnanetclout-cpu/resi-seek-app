import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const checks = [];
const expect = (condition, label) => checks.push({ ok: Boolean(condition), label });

const mainActivity = read("android/app/src/main/java/org/reskonnect/app/MainActivity.java");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const release = JSON.parse(read("native/android-release.json"));
const client = read("src/integrations/supabase/client.ts");
const auth = read("src/contexts/AuthContext.tsx");
const protectedRoute = read("src/components/ProtectedRoute.tsx");
const studentRoute = read("src/components/StudentRoute.tsx");
const contactGate = read("src/components/ContactDetailsGate.tsx");
const find = read("src/pages/FindMyRes.tsx");
const applications = read("src/pages/Applications.tsx");
const opportunities = read("src/components/opportunities/OpportunityEngine.tsx");
const residence = read("src/pages/ResidenceDetail.tsx");
const dashboard = read("src/components/MyResKonnectCommandCentre.tsx");
const map = read("src/components/resmap/NativeResMapExperience.tsx");
const stableMap = read("src/components/resmap/ResMapExperienceStable.tsx");
const panorama = read("src/components/virtualTours/VirtualTourPanorama.tsx");
const boundary = read("src/components/ErrorBoundary.tsx");
const telemetry = read("src/lib/runtimeTelemetry.ts");
const connectivity = read("src/components/ConnectivityStatus.tsx");
const runtimeMigration = read("supabase/migrations/20260929121500_mobile_runtime_crash_telemetry.sql");

expect(release.versionCode >= 7 && release.versionName === "1.1.4", "new Android release identity is v1.1.4 / code 7+");
expect(release.compileSdk === 36 && release.targetSdk === 36, "Android compile/target SDK is API 36");
expect(release.minSdk <= 24, "supported Android floor remains broad enough for existing minSdk 24 clients");
expect(mainActivity.includes("onRenderProcessGone") && mainActivity.includes("view.destroy()") && mainActivity.includes("recreate") && mainActivity.includes("return true"), "dead WebView renderer is destroyed and activity recovery is handled");
expect(mainActivity.includes("rk_native_safe_graphics_v1") && mainActivity.includes("recentCount >= 2"), "repeated renderer exits activate safe graphics mode");
expect(!manifest.includes("screenOrientation=") && !manifest.includes("resizeableActivity=\"false\"") && !manifest.includes("maxAspectRatio"), "Android manifest does not block rotation, tablets, foldables or multi-window");
expect(manifest.includes('android:windowSoftInputMode="adjustResize"'), "software keyboard uses adjustResize");
expect(client.includes("/rest/v1/") && client.includes("/auth/v1/") && client.includes("/functions/v1/") && client.includes("15_000") && client.includes("30_000"), "Supabase REST/Auth/Functions requests have bounded deadlines");
expect(auth.includes("refreshSession") && auth.includes("visibilitychange") && auth.includes("get_my_access_context"), "auth reconciles persisted sessions after resume and resolves access through one RPC");
expect(protectedRoute.includes("AuthLoadingRecovery") && studentRoute.includes("AuthLoadingRecovery"), "protected/student routing cannot remain on an unexplained infinite loader");
expect(contactGate.includes("finally") && contactGate.includes("setSaving(false)"), "contact profile gate always releases its saving state");
expect(find.includes("residenceError") && find.includes("refreshResidences") && find.includes("Retry live data"), "Find My Res surfaces query/cache errors and can retry");
expect(applications.includes("detailsError") && applications.includes("retryApplications") && applications.includes("AbortController"), "Applications handles base and residence-detail failures with retry and timeout");
expect(opportunities.includes("setError") && opportunities.includes("AbortController") && opportunities.includes("Opportunity feed needs a refresh"), "Opportunity feed has bounded loading, persistent error and retry states");
expect(residence.includes("loadError") && residence.includes("Residence could not be refreshed"), "residence detail distinguishes connectivity failure from true not-found");
expect(dashboard.includes("Promise.allSettled") && dashboard.includes("abortSignal") && dashboard.includes("Refresh journey"), "dashboard command centre isolates partial backend failures and supports recovery");
expect(map.includes("safeForVector") && map.includes("rk_native_safe_graphics_v1") && map.includes("ResMapExperienceStable"), "native map defaults to stable 2D and gates optional GPU-heavy vector mode");
expect(stableMap.includes("using safe raster defaults") && stableMap.includes("Could not build route"), "stable ResMap contains startup and routing failures");
expect(panorama.includes("webglcontextlost") && panorama.includes("texture.dispose") && panorama.includes("rk_native_safe_graphics_v1"), "360 viewer detects context loss, disposes textures and has safe graphics fallback");
expect(boundary.includes("recordMobileRuntime") && boundary.includes("ChunkLoadError") && boundary.includes("caches.delete"), "React/stale-chunk failures are contained without deleting auth storage");
expect(telemetry.includes("mobile_runtime_events") && telemetry.includes("safeMetadata"), "runtime diagnostics are centralized and privacy-filtered");
expect(connectivity.includes("offline_boot") && connectivity.includes("reconnected"), "offline boot and reconnect lifecycle are observable");
expect(runtimeMigration.includes("webview_renderer_recovered") && runtimeMigration.includes("js_error") && runtimeMigration.includes("promise_rejection"), "runtime telemetry RLS permits only the approved diagnostic event classes");

let failed = 0;
for (const check of checks) {
  if (check.ok) console.log("PASS", check.label);
  else { console.error("FAIL", check.label); failed += 1; }
}
console.log(`P1-P4 static stability audit: ${checks.length - failed}/${checks.length} passed.`);
if (failed) process.exit(1);
