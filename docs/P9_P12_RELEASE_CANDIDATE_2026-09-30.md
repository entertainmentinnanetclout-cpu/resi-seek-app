# ResKonnect Android 1.1.5 (versionCode 8) — P9–P12 Release Candidate

Date: 2026-09-30  
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
- signed-release workflow parity.

## P12 — Final release candidate

The final code candidate is **1.1.5 / versionCode 8**. Do not upload a later code revision under versionCode 8.

### Automated candidate acceptance
- [ ] All PR checks green on the exact release-candidate head SHA.
- [ ] Unsigned API-36 readiness AAB compiles from the exact release-candidate head.
- [ ] AAB contains no unreviewed native ELF libraries.
- [ ] Production web/PWA matrix passes.
- [ ] P9 bundle/memory budget passes.
- [ ] P10 Android compatibility matrix passes.
- [ ] P11 release gate passes.

### Protected signed artifact
Run **Android Play Store Signed Release** with:
- `version_code = 8`
- `version_name = 1.1.5`

The protected workflow must:
- validate protected upload-key secrets;
- materialize the keystore only on the runner;
- rerun P1–P11 release gates;
- compile the signed AAB;
- verify the AAB signature with `jarsigner`;
- check native ELF packaging;
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
- do not promote if a repeatable crash, ANR, auth/session loss, or renderer-loop remains.

Production promotion is a separate release action after these acceptance records are green.
