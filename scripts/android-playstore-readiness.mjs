import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const findings = [];
const exists = p => fs.existsSync(path.join(root,p));
const read = p => exists(p) ? fs.readFileSync(path.join(root,p),"utf8") : "";
const json = p => { try { return JSON.parse(read(p) || "{}"); } catch { return {}; } };
const report = (level,check,message) => findings.push({level,check,message});
const pass = (check,message) => report("PASS",check,message);
const block = (check,message) => report("BLOCKER",check,message);
const warn = (check,message) => report("WARN",check,message);

const config=json("capacitor.config.json");
const release=json("native/android-release.json");
const vars=read("android/variables.gradle");
const gradle=read("android/app/build.gradle");
const manifest=read("android/app/src/main/AndroidManifest.xml");
const app=read("src/App.tsx");
const profile=read("src/pages/Profile.tsx");
const privacy=read("src/pages/Privacy.tsx");
const auth=read("src/pages/Auth.tsx");
const workflow=read(".github/workflows/android-playstore-readiness.yml");
const signedWorkflow=read(".github/workflows/android-playstore-release.yml");
const mainActivity=read("android/app/src/main/java/org/reskonnect/app/MainActivity.java");
const runtimeDiagnostics=read("src/lib/runtimeDiagnostics.ts");
const panorama=read("src/components/virtualTours/VirtualTourPanorama.tsx");
const safeIcon=read("android/app/src/main/res/drawable/app_icon_foreground_safe.xml");

if(config.appId==="org.reskonnect.app" && release.packageId===config.appId && gradle.includes('applicationId "org.reskonnect.app"')) pass("Package identity","org.reskonnect.app consistent across project files.");
else block("Package identity","Android package identity mismatch.");
if(config.appName==="ResKonnect"&&config.webDir==="dist") pass("Capacitor config","ResKonnect bundled web app configured.");
else block("Capacitor config","Incorrect app name or webDir.");
const sdk = name => Number(vars.match(new RegExp(name+"\\s*=\\s*(\\d+)"))?.[1]||0);
for(const [label,min] of [["minSdk",24],["compileSdk",36],["targetSdk",36]]) {
  const value=sdk(label+"Version");
  if(value>=min) pass(label,String(value)); else block(label,`${value||"missing"}; minimum ${min}.`);
}
if(release.versionName==="1.1.4"&&release.versionCode===7) pass("Release identity","1.1.4 / versionCode 7 (greater than the consumed code 6).");
else block("Release identity","Expected release 1.1.4 / versionCode 7. Never reuse Play versionCode 6.");
if(!manifest) block("AndroidManifest","Missing.");
else {
  for(const name of ["INTERNET","CAMERA","ACCESS_COARSE_LOCATION","ACCESS_FINE_LOCATION"]) {
    manifest.includes("android.permission."+name) ? pass("Permission "+name,"Declared.") : block("Permission "+name,"Required by current Android feature set.");
  }
  for(const name of ["ACCESS_BACKGROUND_LOCATION","READ_CONTACTS","WRITE_CONTACTS","READ_SMS","SEND_SMS","READ_CALL_LOG","WRITE_CALL_LOG","MANAGE_EXTERNAL_STORAGE","REQUEST_INSTALL_PACKAGES"]) {
    if(manifest.includes("android.permission."+name)) block("High-risk permission "+name,"Not required or approved for this app.");
  }
  const permission = manifest.includes("android.permission.POST_NOTIFICATIONS");
  if(release.foregroundLocalNotifications===true&&permission) pass("Foreground notifications","Android 13+ permission declared; explicit in-app opt-in required.");
  else if(release.foregroundLocalNotifications===false&&!permission) pass("Foreground notifications","Disabled consistently.");
  else block("Foreground notifications","Native permission and declared capability mismatch.");
  if(release.nativePushNotifications===false) warn("Background push","FCM transport is not configured; do not represent closed-app push as operational.");
  if(manifest.includes('android:usesCleartextTraffic="false"')) pass("Cleartext traffic","Disabled.");
  else block("Cleartext traffic","Cleartext traffic must be disabled.");
  if(manifest.includes('android:resizeableActivity="true"')&&!manifest.includes('android:screenOrientation=')) pass("Adaptive displays","Activity supports resizing, tablets, foldables and desktop windows.");
  else block("Adaptive displays","Do not lock orientation; explicitly keep the activity resizable.");
  if(manifest.includes('android:allowBackup="false"')) pass("Android backup","Account/document backup disabled.");
  else block("Android backup","Expected allowBackup=false.");
}
for(const name of ["android/app/src/main/java/org/reskonnect/app/MainActivity.java","android/app/src/main/res/drawable-nodpi/app_icon.png","android/app/src/main/res/drawable-nodpi/app_icon_foreground.png","android/app/src/main/res/values/styles.xml"]) {
  exists(name)?pass("Native asset "+name,"Present."):block("Native asset "+name,"Missing.");
}
if(gradle.includes("RK_ANDROID_KEYSTORE_PATH")&&gradle.includes("signingConfigs")) pass("Release signing","Upload key sourced outside GitHub source tree.");
else block("Release signing","Protected keystore integration missing.");
if(release.capacitorVersion==="8.5.0"&&workflow.includes("@capacitor/core@8.5.0")&&workflow.includes("@capacitor/android@8.5.0")&&workflow.includes("@capacitor/geolocation@8.0.0")&&workflow.includes("@capacitor/local-notifications@8")) pass("Capacitor toolchain","Exact core and geolocation pins; native notifications included in CI.");
else block("Capacitor toolchain","Android CI does not install required native toolchain/plugins.");
if(workflow.includes("bundleRelease")&&workflow.includes("android-36")&&workflow.includes("--strict")) pass("AAB readiness","Strict audit and API-36 AAB compile enabled.");
else block("AAB readiness","Workflow missing strict audit or bundle build.");
if(signedWorkflow.includes("bundleRelease")&&signedWorkflow.includes("jarsigner")&&signedWorkflow.includes("RK_ANDROID_UPLOAD_KEYSTORE_B64")&&signedWorkflow.includes("@capacitor/local-notifications@8")) pass("Signed Play build","Protected signing and native plugin install configured.");
else block("Signed Play build","Signed workflow incomplete.");
if(app.includes('path="/delete-account"')&&app.includes("<AccountDeletion")) pass("Public deletion URL","/delete-account is routable.");
else block("Public deletion URL","Missing deletion URL.");
if(profile.includes('to="/delete-account"')) pass("In-app deletion","Profile links to deletion.");
else block("In-app deletion","Account deletion unavailable in profile.");
if(privacy.includes("foreground location")&&privacy.includes("/delete-account")) pass("Privacy policy","Foreground location and account deletion disclosed.");
else block("Privacy policy","Missing required disclosure.");
if(auth.includes('publicAuthOrigin = isNativeShell ? "https://www.reskonnect.org"')&&auth.includes("!isNativeShell &&")) pass("Native authentication","Native OAuth callback/embedded Google OAuth restrictions preserved.");
else block("Native authentication","Native auth flow changed unsafely.");
if(mainActivity.includes("onRenderProcessGone")&&mainActivity.includes("webView.destroy()")&&mainActivity.includes("recreate()")&&mainActivity.includes("return true")) pass("WebView renderer recovery","Dead renderer is handled, destroyed and replaced with a fresh Activity/WebView.");
else block("WebView renderer recovery","Unrecoverable WebView renderer death can terminate the app.");
if(runtimeDiagnostics.includes('rpc("record_mobile_runtime_event"')&&runtimeDiagnostics.includes("isNativeGraphicsSafeMode")) pass("Runtime diagnostics","Privacy-safe native failure telemetry and graphics safe mode are wired.");
else block("Runtime diagnostics","Native failures need a backend breadcrumb and graphics safe mode.");
if(panorama.includes("webglcontextlost")&&panorama.includes("generateMipmaps = false")&&panorama.includes('powerPreference: lowMemory ? "low-power"')) pass("360 memory guard","WebGL loss, 4K texture memory and low-memory GPU behavior are guarded.");
else block("360 memory guard","360 renderer is missing GPU-memory/context-loss hardening.");
if(safeIcon.includes('18dp')) pass("Adaptive icon safe zone","Launcher foreground is inset for OEM masks.");
else block("Adaptive icon safe zone","Launcher foreground may be clipped by OEM icon masks.");
if(workflow.includes("lintRelease")&&signedWorkflow.includes("lintRelease")) pass("Android lint","Readiness and signed release both run release lint.");
else block("Android lint","Release lint must gate both AAB pipelines.");
if(workflow.includes("Native ELF / 16 KB guard")&&signedWorkflow.includes("Native ELF / 16 KB guard")) pass("16 KB page-size guard","AAB pipeline blocks unaudited packaged native ELF libraries.");
else block("16 KB page-size guard","Release must detect native ELF before claiming 16 KB compatibility.");
if(!exists("android/app/google-services.json")) warn("Firebase configuration","No bundled Firebase Android settings. Closed-app push cannot be enabled by this build alone.");

const blockers=findings.filter(x=>x.level==="BLOCKER");
const warnings=findings.filter(x=>x.level==="WARN");
console.log("\nResKonnect Android / Play Store readiness audit\n");
for(const row of findings) console.log(`${row.level.padEnd(7)} ${row.check}: ${row.message}`);
console.log(`\nSummary: ${blockers.length} blocker(s), ${warnings.length} warning(s), ${findings.filter(x=>x.level==="PASS").length} pass(es).`);
if(strict&&blockers.length) process.exit(1);
