import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const strict=process.argv.includes("--strict");
const findings=[];
const exists=(p)=>fs.existsSync(path.join(root,p));
const read=(p)=>exists(p)?fs.readFileSync(path.join(root,p),"utf8"):"";
const json=(p)=>{try{return JSON.parse(read(p)||"{}");}catch{return {};}};
const add=(level,check,message)=>findings.push({level,check,message});
const pass=(check,message)=>add("PASS",check,message);
const block=(check,message)=>add("BLOCKER",check,message);
const warn=(check,message)=>add("WARN",check,message);

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

if(config.appId==="org.reskonnect.app"&&release.packageId===config.appId&&gradle.includes('applicationId "org.reskonnect.app"')) pass("Package identity","org.reskonnect.app is consistent across Capacitor, release manifest and Gradle.");
else block("Package identity","Capacitor, release manifest and Gradle applicationId must all equal org.reskonnect.app.");

if(config.appName==="ResKonnect"&&config.webDir==="dist") pass("Capacitor config","ResKonnect + dist configured.");
else block("Capacitor config","appName/webDir are not release-ready.");

const sdk=(name)=>Number(vars.match(new RegExp(name+"\\s*=\\s*(\\d+)"))?.[1]||0);
for(const [label,value,min] of [["minSdk",sdk("minSdkVersion"),24],["compileSdk",sdk("compileSdkVersion"),36],["targetSdk",sdk("targetSdkVersion"),36]]){
  if(value>=min) pass(label,String(value)); else block(label,`${value||"missing"}; requires at least ${min}.`);
}

if(release.versionCode===1&&release.versionName==="1.0.0") pass("First release version","versionCode 1 · versionName 1.0.0");
else warn("First release version",`Configured ${release.versionCode} / ${release.versionName}`);

if(!manifest) block("AndroidManifest","Missing.");
else{
  const required=["INTERNET","CAMERA","ACCESS_COARSE_LOCATION","ACCESS_FINE_LOCATION"];
  for(const p of required) manifest.includes("android.permission."+p)?pass("Permission "+p,"Declared."):block("Permission "+p,"Required by current Android feature set.");
  const prohibited=["ACCESS_BACKGROUND_LOCATION","READ_CONTACTS","WRITE_CONTACTS","READ_SMS","SEND_SMS","READ_CALL_LOG","WRITE_CALL_LOG","MANAGE_EXTERNAL_STORAGE","REQUEST_INSTALL_PACKAGES","POST_NOTIFICATIONS"];
  for(const p of prohibited) if(manifest.includes("android.permission."+p)) block("High-risk permission "+p,"Not approved for Android v1.");
  if(manifest.includes('android:usesCleartextTraffic="false"')) pass("Cleartext traffic","Disabled.");
  else block("Cleartext traffic","Must be disabled for release.");
  if(manifest.includes('android:allowBackup="false"')) pass("Android backup","Disabled for account/document security.");
  else warn("Android backup","Expected allowBackup=false.");
}

for(const p of [
  "android/app/src/main/java/org/reskonnect/app/MainActivity.java",
  "android/app/src/main/res/drawable-nodpi/app_icon.png",
  "android/app/src/main/res/drawable-nodpi/app_icon_foreground.png",
  "android/app/src/main/res/values/styles.xml"
]) exists(p)?pass("Native asset "+p,"Present."):block("Native asset "+p,"Missing.");

if(gradle.includes("RK_ANDROID_KEYSTORE_PATH")&&gradle.includes("signingConfigs")) pass("Release signing hooks","Keystore is external to git.");
else block("Release signing hooks","Gradle signing hook missing.");

if(release.capacitorVersion==="8.5.0"&&workflow.includes("@capacitor/core@8.5.0")&&workflow.includes("@capacitor/android@8.5.0")&&workflow.includes("@capacitor/cli@8.5.0")) pass("Capacitor pin","8.5.0 pinned in release metadata and CI.");
else block("Capacitor pin","CI must install exact Capacitor 8.5.0 packages.");

if(workflow.includes("bundleRelease")&&workflow.includes("android-36")&&workflow.includes("--strict")) pass("AAB readiness CI","Strict audit + API 36 release bundle build configured.");
else block("AAB readiness CI","Workflow does not prove API-36 AAB compilation.");

if(signedWorkflow.includes("bundleRelease")&&signedWorkflow.includes("jarsigner")&&signedWorkflow.includes("RK_ANDROID_UPLOAD_KEYSTORE_B64")) pass("Signed release CI","Signed AAB workflow configured.");
else block("Signed release CI","Signed Play release workflow missing.");

if(app.includes('path="/delete-account"')&&app.includes("<AccountDeletion")) pass("Public deletion URL","/delete-account is routable.");
else block("Public deletion URL","Google Play requires a working external deletion resource.");
if(profile.includes('to="/delete-account"')) pass("In-app deletion path","Profile links to account deletion.");
else block("In-app deletion path","Deletion request must be discoverable in-app.");
if(privacy.includes("13 September 2026")&&privacy.includes("OpenAI")&&privacy.includes("foreground location")&&privacy.includes("/delete-account")) pass("Privacy disclosure","Android, AI, location and deletion disclosures present.");
else block("Privacy disclosure","Privacy policy is missing current Play/Data Safety disclosures.");

if(auth.includes('publicAuthOrigin = isNativeShell ? "https://www.reskonnect.org"')&&auth.includes("!isNativeShell &&")) pass("Native auth safety","Native callbacks use public origin and embedded Google OAuth is hidden.");
else block("Native auth safety","Native auth callback/OAuth handling is unsafe.");

if(release.nativePushNotifications===false&&!manifest.includes("POST_NOTIFICATIONS")) pass("Notification policy","No native notification permission requested in v1.");
else warn("Notification policy","Native push state and Android permission are inconsistent.");

const blockers=findings.filter(x=>x.level==="BLOCKER");
const warnings=findings.filter(x=>x.level==="WARN");
console.log("\nResKonnect Android / Google Play readiness audit\n");
for(const row of findings) console.log(`${row.level.padEnd(7)} ${row.check}: ${row.message}`);
console.log(`\nSummary: ${blockers.length} blocker(s), ${warnings.length} warning(s), ${findings.filter(x=>x.level==="PASS").length} pass(es).`);
if(strict&&blockers.length) process.exit(1);
