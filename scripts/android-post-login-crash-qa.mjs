import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const expect=(condition,message)=>{if(!condition){console.error("FAIL:",message);process.exitCode=1;}else console.log("PASS:",message);};

const app=read("src/App.tsx");
const main=read("src/main.tsx");
const studentRoute=read("src/components/StudentRoute.tsx");
const nativeHome=read("src/components/NativeStudentHome.tsx");
const mainActivity=read("android/app/src/main/java/org/reskonnect/app/MainActivity.java");
const manifest=read("android/app/src/main/AndroidManifest.xml");
const release=JSON.parse(read("native/android-release.json"));
const readiness=read(".github/workflows/android-playstore-readiness.yml");
const signed=read(".github/workflows/android-playstore-release.yml");
const config=read("supabase/config.toml");

expect(app.includes('const NativeDashboard = lazy(')&&app.includes('isNativeApp() ? <NativeDashboard /> : <Dashboard />'),"native login uses a separate lazy dashboard chunk");
expect(app.includes("if (native) return;")&&app.includes("if (native || !ready) return null;"),"web-only global enhancements are disabled in native shell");
expect(main.includes("if (native) return;")&&main.includes("if (isNativeApp()) return;"),"native boot skips deferred 3D bridge and Luna attribution");
expect(studentRoute.includes("isNativeApp()")&&studentRoute.includes("native-student-route")&&studentRoute.includes('lazy(() => import("@/components/ContactDetailsGate"))'),"native routes do not mount the heavy contact gate during post-login boot");
expect(nativeHome.includes("post_login_stable")&&nativeHome.includes('version_code: 5'),"native dashboard reports stable 1.1.2 startup");
expect(mainActivity.includes("setRendererPriorityPolicy")&&mainActivity.includes("onRenderProcessGone")&&mainActivity.includes("recreate()"),"Android WebView renderer is protected and recoverable");
expect(manifest.includes('android:hardwareAccelerated="true"'),"hardware acceleration is explicit for Android WebView");
expect(release.versionName==="1.1.2"&&release.versionCode===5,"Play release metadata is 1.1.2 / versionCode 5");
expect(readiness.includes('ANDROID_VERSION_CODE: "5"')&&readiness.includes('ANDROID_VERSION_NAME: "1.1.2"'),"readiness AAB builds versionCode 5");
expect(signed.includes('default: "5"')&&signed.includes('default: "1.1.2"')&&signed.includes("android-actions/setup-android@v4"),"signed release defaults and Android SDK action are current");
expect(config.includes("[functions.mobile-runtime-report]\nverify_jwt = true"),"runtime diagnostics endpoint requires JWT");

if(process.exitCode)process.exit(process.exitCode);
console.log("Android post-login crash hardening gate passed.");
