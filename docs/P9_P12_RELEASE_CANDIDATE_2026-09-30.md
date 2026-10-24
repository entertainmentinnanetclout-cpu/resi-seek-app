# ResKonnect Android 1.1.7 (versionCode 10) — P9–P12 Release Candidate

Date: 2026-10-24  
Package: `org.reskonnect.app`  
Compile / target SDK: 36  
Minimum SDK: 24  
Capacitor: 8.5.2  
Artifact: Android App Bundle (AAB)

## P9 — Performance and memory

Release qualification requires:
- production entry JavaScript <= 380 KiB raw and <= 125 KiB gzip;
- no JavaScript chunk > 950 KiB;
- no more than two exceptional chunks > 500 KiB;
- any Three/React Three/Drei runtime chunk <= 900 KiB;
- runtime device budgeting using device memory, CPU concurrency and data-saver/reduced-motion signals;
- 3D/360 resource disposal on unmount;
- low-memory static fallback for legacy 360 and verified digital twins;
- deferred loading of immersive 3D/360 components;
- bounded residence gallery decode window;
- panorama capture bitmaps/canvases released after use;
- residence portal polling reduced while realtime subscriptions are active and suspended while hidden.

## P10 — Android compatibility

Automated Chromium/WebView-style profiles cover:
- Huawei-style low-memory Android;
- Samsung midrange Android;
- generic lower-memory handset;
- Android tablet;
- Android API-24 floor;
- current Android 16 profile.

Automated scenarios:
- native first-run onboarding close/dismiss persistence, including short landscape viewport;
- native isolation from website-only marketing consent;
- portrait and landscape resize;
- location denied/granted containment;
- repeated 360 open/close/navigation;
- offline/reconnect;
- degraded-network/recovered transition;
- close/reopen persisted session.

This automated matrix does not claim to reproduce OEM GPU drivers or Android System WebView defects exactly. Physical-device acceptance remains required before production rollout.

## P11 — Automated release gate

Required gates:
- TypeScript;
- production web build;
- PWA manifest and install behavior;
- Chromium + WebKit responsive smoke;
- authenticated installed-PWA matrix;
- P1–P4 stability and core failure recovery;
- P5–P8 graphics/PWA/network audit;
- P9 production performance budget;
- P10 Android device matrix;
- Capacitor Android sync;
- API 36 Gradle AAB compile;
- Android native configuration/permissions;
- renderer-death recovery;
- safe 2D/graphics fallback;
- source-controlled Supabase RPC/schema contract checks;
- signed-release workflow parity;
- zero known production dependency vulnerabilities under the governed dependency-security audit.

The 2026-10-24 release lock refresh pins patched production dependency resolutions, including `zod` 4.6.7, `fast-uri` 3.1.9 and `serialize-javascript` 7.1.3. The production audit must remain green on the exact candidate lockfile.

## P12 — Final release candidate

The corrected native packaging candidate is **1.1.7 / versionCode 10**. Do not upload a later code revision under versionCode 10.

This candidate supersedes 1.1.6 / versionCode 9 after the pre-upload audit found that the prior bundle did not contain the expected Capacitor native plugin registry. The corrected candidate must prove that App, Geolocation, Local Notifications and Push Notifications are registered after Capacitor sync and are physically present in the final AAB.

### Automated candidate acceptance
- [ ] All PR checks green on the exact release-candidate head SHA.
- [ ] Unsigned API-36 readiness AAB compiles from the exact release-candidate head.
- [ ] Generated `capacitor.plugins.json` contains App, Geolocation, Local Notifications and Push Notifications.
- [ ] Final readiness AAB contains the same four native plugin registrations.
- [ ] Every packaged native ELF `LOAD` segment is verified at 16 KB (`0x4000`) alignment or greater.
- [ ] Production dependency security audit reports zero known production vulnerabilities.
- [ ] Native onboarding closes in portrait and landscape and remains dismissed after reload/reopen.
- [ ] Website Meta consent never appears in the Capacitor runtime.
- [ ] Production web/PWA matrix passes.
- [ ] P9 bundle/memory budget passes.
- [ ] P10 Android compatibility matrix passes.
- [ ] P11 release gate passes.

### Protected signed artifact
Run **Android Play Store Signed Release** with:
- `version_code = 10`
- `version_name = 1.1.7`

The protected workflow must:
- validate protected upload-key secrets;
- materialize the keystore only on the runner;
- rerun P1–P11 release gates;
- declare the pinned Capacitor native dependencies before sync;
- verify the generated native plugin registry;
- compile the signed AAB;
- verify the native plugin registry inside the final AAB;
- verify the AAB signature with `jarsigner`;
- verify every packaged native ELF library for 16 KB page-size-compatible `LOAD` alignment;
- generate SHA-256;
- upload the AAB and checksum as a retained CI artifact.

### Internal-testing acceptance
Install through Google Play Internal Testing, not by treating the unsigned CI AAB as production-equivalent.

Minimum physical matrix:
- Huawei handset, preferably the previously problematic device class;
- Samsung handset;
- one other Android handset;
- Android tablet;
- lower-memory handset;
- current supported Android;
- older supported Android/API floor where practical.

For each device test:
- portrait and landscape;
- fresh install;
- signed-out launch;
- login;
- first-run guide close and skip;
- relaunch after guide dismissal;
- dashboard;
- Find My Res;
- residence details;
- applications;
- opportunities/WIL/bursaries;
- profile/documents/messages/favourites/service centre/AI;
- location denied then granted;
- Wi-Fi to mobile-data transition;
- offline then reconnect;
- repeated map open/close;
- repeated 360 open/close;
- background/resume;
- force-stop/reopen;
- logout;
- no permanent spinner;
- no app termination where a feature fallback is possible.

### Android Vitals / Play pre-launch acceptance
Before production promotion:
- review Android Vitals for crashes and ANRs from the internal candidate;
- review Play pre-launch report;
- investigate renderer/OOM/GPU/WebView events using `mobile_runtime_events`;
- do not promote if a repeatable crash, ANR, auth/session loss, onboarding trap, or renderer-loop remains.

Production promotion is a separate release action after these acceptance records are green.
