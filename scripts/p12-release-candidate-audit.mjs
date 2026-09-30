import fs from "node:fs";

const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
let failed=0;
const expect=(ok,label)=>{if(ok)console.log("PASS",label);else{console.error("FAIL",label);failed++;}};

const release=json("native/android-release.json");
const gradle=read("android/app/build.gradle");
const readiness=read(".github/workflows/android-playstore-readiness.yml");
const signed=read(".github/workflows/android-playstore-release.yml");
const pkg=json("package.json");
const telemetry=read("src/lib/runtimeTelemetry.ts");
const doc=read("docs/P9_P12_RELEASE_CANDIDATE_2026-09-30.md");

console.log("\nP12 — final release candidate");
expect(release.packageId==="org.reskonnect.app","package identity remains org.reskonnect.app");
expect(release.versionName==="1.1.5"&&release.versionCode===8,"release metadata is 1.1.5 / versionCode 8");
expect(release.compileSdk===36&&release.targetSdk===36&&release.minSdk===24,"SDK matrix is min24 compile36 target36");
expect(gradle.includes('ANDROID_VERSION_CODE") ?: "8"')&&gradle.includes('ANDROID_VERSION_NAME") ?: "1.1.5"'),"Gradle defaults match final candidate");
expect(readiness.includes('ANDROID_VERSION_CODE: "8"')&&readiness.includes('ANDROID_VERSION_NAME: "1.1.5"'),"unsigned readiness AAB uses final candidate identity");
expect(signed.includes('default: "8"')&&signed.includes('default: "1.1.5"'),"protected signed workflow defaults to final candidate");
expect(telemetry.includes('"1.1.5"')&&telemetry.includes("? 8 : null"),"runtime telemetry labels the final candidate correctly");
expect(signed.includes("RK_ANDROID_UPLOAD_KEYSTORE_B64")&&signed.includes("RK_ANDROID_UPLOAD_STORE_PASSWORD")&&signed.includes("RK_ANDROID_UPLOAD_KEY_ALIAS"),"signing material remains protected outside source");
expect(signed.includes("p5-p8-stability-audit.mjs")&&signed.includes("p10-android-device-matrix.mjs")&&signed.includes("p11-release-gate.mjs")&&signed.includes("npm run platform:p9"),"signed candidate reruns P5-P11");
expect(signed.includes("jarsigner -verify -verbose -certs")&&signed.includes("sha256sum")&&signed.includes("app-release.aab.sha256"),"signed artifact gets signature and SHA-256 verification");
expect(pkg.scripts["release:p12"]==="node scripts/p12-release-candidate-audit.mjs","P12 audit is exposed through package scripts");
expect(doc.includes("Google Play Internal Testing")&&doc.includes("Huawei handset")&&doc.includes("Android Vitals")&&doc.includes("Play pre-launch report"),"physical/internal/Play acceptance checklist is source-controlled");
expect(doc.includes("Do not upload a later code revision under versionCode 8"),"versionCode immutability rule is explicit");

if(failed){console.error(`\nP12 release-candidate audit failed with ${failed} issue(s).`);process.exit(1);}
console.log("\nP12 release-candidate audit passed.");
