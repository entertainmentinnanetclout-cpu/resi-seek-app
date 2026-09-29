# ResKonnect P1–P4 Stability Audit — 2026-09-29

## Scope

This audit covers the release-critical runtime from Android/Capacitor process boot through authentication and the core student journey. It is deliberately separate from later performance tuning and the physical OEM device matrix.

### P1 — architecture and crash-risk scan

Reviewed areas: Capacitor/Android lifecycle, manifest and SDK configuration, Supabase client/session lifecycle, route guards, global error containment, dashboard, Find My Res, residence detail, applications, opportunities, ResMap, 3D/360 graphics, offline/reconnect behaviour, PWA/native separation, runtime diagnostics and release CI.

Production Supabase was checked separately against project `mefjzkhobkltlbmhusdh`. The core access/dashboard/opportunity/360 RPCs are present, runtime telemetry policies are present, and 361 currently visible residences were returned by the production schema audit.

| Risk | Severity | P1–P4 treatment |
| --- | --- | --- |
| Android WebView renderer death / GPU process loss | Critical | Native `onRenderProcessGone` destroys the dead WebView, recreates the activity, records recovery metadata and enables safe-graphics mode after repeated exits. |
| Session/dashboard loader never resolves after resume | Critical | Auth, REST and function calls are bounded; persisted session is reconciled on visibility/online; both student and protected route loaders expose retry/reload recovery. |
| 3D/360 causes renderer/OOM instability | Critical | Normal native map is stable raster; optional 3D is capability-gated; repeated renderer loss disables heavy graphics; 360 constrains DPR/geometry, disposes textures and falls back after WebGL loss. |
| Find My Res network request hangs | High | 12-second abort, request supersession, realtime coalescing, 24-hour public listing cache, visible retry state. |
| Application list/details request hangs | High | Application fetch and residence enrichment have independent abort paths, visible failure state and retry. |
| Opportunity RPC rejects and spinner remains | High | Explicit AbortController, catch/finally, visible retry; action buttons always release busy state. |
| Residence detail network failure appears as “not found” | High | Connectivity failure now has its own retry state; true absent records retain the not-found state. |
| Stale PWA/native lazy chunk after deploy | High | React error boundary recognizes chunk-load failure, clears CacheStorage once and reloads while preserving auth/localStorage. |
| Raw post-login attribution request delays routing | High | Referral capture now has an 8-second deadline and remains best-effort. |
| Profile gate update rejects and Save stays disabled | Medium | Save is wrapped in try/catch/finally and always releases. |
| Offline transition silently corrupts session | Medium | Session is preserved; offline banner and reconnect event are explicit; runtime lifecycle telemetry is best-effort only. |
| Diagnostic collection exposes student data | High | Runtime telemetry filters sensitive key classes and stores only bounded operational metadata; RLS allows only approved event types. |

## P2 — native crash containment

The release candidate remains Android `1.1.4` / versionCode `7`, target and compile SDK 36, with the Capacitor 8.5.2 toolchain in release CI. The activity is not orientation-locked and does not opt out of resize/multi-window. Keyboard handling uses `adjustResize`.

Native graphics are fail-soft: accommodation discovery does not depend on 3D. Renderer recovery and 360/map fallbacks are implemented before the release is allowed to reach a signed production candidate.

## P3 — authentication and session recovery

The authenticated lifecycle now has bounded outcomes for first login, persisted session restoration, foreground resume, reconnect, token refresh, role resolution, profile gate updates and post-login attribution. A temporary backend/network problem must resolve to usable cached/signed-in UI, an error/retry state or sign-in options rather than an indefinite loader.

## P4 — core student routes

Release-gated routes include Dashboard, Find My Res, residence detail, My Applications, public Applications, Opportunities, WIL, Bursaries, Profile, Documents, Messages, Favourites, Service Centre, ResKonnect AI and portal routing. The automated core regression uses deterministic fixture data and deliberately injects failures into Dashboard, Find My Res, Applications and Opportunities to verify recovery.

## Boundary

Automated code, schema, Chromium/WebKit and Android build gates can prove deterministic software behaviour. They cannot reproduce every Huawei/Samsung OEM WebView/GPU kill, thermal condition or memory-pressure event. Physical OEM and Play pre-launch testing therefore remains a release acceptance requirement in later device-validation phases; this does not leave an unimplemented P1–P4 code defect.
