import fs from "node:fs";
import path from "node:path";

const read=p=>fs.readFileSync(p,"utf8");
let failed=0;
const expect=(ok,label)=>{if(ok)console.log("PASS",label);else{console.error("FAIL",label);failed++;}};

const pkg=JSON.parse(read("package.json"));
const web=read(".github/workflows/web-platform-readiness.yml");
const android=read(".github/workflows/android-playstore-readiness.yml");
const signed=read(".github/workflows/android-playstore-release.yml");
const p1=read("scripts/p1-p4-stability-audit.mjs");
const p5=read("scripts/p5-p8-stability-audit.mjs");
const p9=read("scripts/p9-performance-budget.mjs");
const p10=read("scripts/p10-android-device-matrix.mjs");
const client=read("src/integrations/supabase/client.ts");
const manifest=read("android/app/src/main/AndroidManifest.xml");
const activity=read("android/app/src/main/java/org/reskonnect/app/MainActivity.java");
const vite=read("vite.config.ts");
const migrations=fs.readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql")).map(x=>read(path.join("supabase/migrations",x))).join("\n");
const generated=read("src/integrations/supabase/types.production.generated.ts");

console.log("\nP11 — automated release QA");
expect(pkg.scripts["platform:p5-p8"]&&pkg.scripts["platform:p9"]&&pkg.scripts["platform:p10"]&&pkg.scripts["release:p11"],"package exposes P5-P11 release gates");
expect(web.includes("npx tsc --noEmit")&&web.includes("chromium webkit")&&web.includes("web-platform-smoke.mjs")&&web.includes("cross-platform-session-smoke.mjs"),"web gate covers types Chromium WebKit responsive routes sessions and PWA");
expect(web.includes("npm run platform:p9")&&web.includes("npm run release:p11"),"web gate enforces performance and P11 static matrix");
expect(android.includes("p1-p4-stability-audit.mjs")&&android.includes("p5-p8-stability-audit.mjs")&&android.includes("p10-android-device-matrix.mjs"),"Android gate composes P1-P10 regression coverage");
expect(android.includes("npx cap sync android")&&android.includes("bundleRelease")&&android.includes('platforms;android-36'),"Android gate syncs Capacitor and compiles API 36 AAB");
expect(android.includes("android-session-regression.mjs")&&android.includes("p1-p4-core-regression.mjs"),"Android session and core failure regressions remain mandatory");
expect(signed.includes("p5-p8-stability-audit.mjs")&&signed.includes("p10-android-device-matrix.mjs")&&signed.includes("p11-release-gate.mjs"),"signed workflow cannot bypass P5-P11");
expect(signed.includes("jarsigner -verify")&&signed.includes("sha256sum")&&signed.includes("actions/upload-artifact"),"signed workflow verifies signature checksum and uploads artifact");
expect(p1.includes("forbidden")||p1.includes("infinite")||p1.includes("bounded"),"P1-P4 gate protects bounded loading/error recovery");
expect(p5.includes("offline")&&p5.includes("NetworkOnly")&&p5.includes("WebGL"),"P5-P8 gate protects graphics and offline behavior");
expect(p9.includes("entry raw size")&&p9.includes("3D runtime chunk")&&p9.includes("dispose"),"P9 gate enforces bundle and memory budgets");
expect(p10.includes("huawei-low-memory")&&p10.includes("samsung-midrange")&&p10.includes("android-tablet")&&p10.includes("android-api24-floor")&&p10.includes("android-current"),"P10 gate includes OEM low-memory tablet old/current Android profiles");
expect(client.includes("/rest/v1/")&&client.includes("/auth/v1/")&&client.includes("/functions/v1/")&&client.includes("/storage/v1/"),"Supabase transport families remain bounded");
expect(migrations.includes("get_my_access_context")&&migrations.includes("my_reskonnect_command_centre")&&migrations.includes("virtual_tour_public_snapshot")&&migrations.includes("get_residence_portal_reservations"),"source-controlled migrations contain required production RPC contracts");
expect(migrations.includes("mobile_runtime_events")&&migrations.includes("enable row level security"),"runtime telemetry schema and RLS are source-controlled");
expect(generated.includes("mefjzkhobkltlbmhusdh")&&generated.includes('PostgrestVersion: "14.17"'),"production schema delta remains pinned to the intended Supabase project snapshot");
expect(!manifest.includes("android:screenOrientation")&&!manifest.includes('android:resizeableActivity="false"'),"Android manifest remains adaptive");
expect(activity.includes("onRenderProcessGone")&&activity.includes("view.destroy()")&&activity.includes("recreate"),"native renderer recovery remains release-gated");
expect(vite.includes("chunkSizeWarningLimit: 950")&&vite.includes("NetworkOnly"),"build keeps performance ceiling and private API cache exclusion");

if(failed){console.error(`\nP11 release gate failed with ${failed} issue(s).`);process.exit(1);}
console.log("\nP11 automated release QA passed.");
