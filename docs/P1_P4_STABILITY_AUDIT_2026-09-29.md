# ResKonnect P1–P4 Stability Audit — 2026-09-29

## Scope

This audit covers the release-critical runtime from Android/Capacitor process boot through authentication and the core student journey. It is deliberately separate from later performance tuning and the physical OEM device matrix.

### P1 — architecture and crash-risk scan

Reviewed areas: Capacitor/Android lifecycle, manifest and SDK configuration, Supabase client/session lifecycle, route guards, global error containment, dashboard, Find My Res, residence detail, applications, opportunities, ResMap, 3D/360 graphics, offline/reconnect behaviour, PWA/native separation, runtime diagnostics and release CI.

Production Supabase was checked separately against project `mefjzkhobkltlbmhusdh`. The core access/dashboard/opportunity/360 RPCs are present, runtime telemetry policies are present, and 361 currently visible residences were returned by the production schema audit.

| Risk | Severity | P1–P4 treatment |
| --- | --- | --- |
| Android WebView renderer death / GPU process loss | Critical | Native `onRenderProcessGone` destroys the dead WebView, recreates the activity, records recovery metadata and enables safe-graphics mode after repeated exits. |
| Session/dashboard loader never resolves after resume | Critical | Auth, REST and function calls are bounded; persisted session is reconciled on visibility/online; student/protected/staff route loaders expose retry/reload recovery. Access-context RPC failure now fails closed instead of clearing roles or routing an unverified account, and retries automatically on reconnect/foreground. |
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

Role resolution is explicitly fail-closed. A failed `get_my_access_context` request preserves the authenticated session and last verified access state, marks access as unresolved, blocks student/admin/department/specialist surfaces, exposes immediate retry controls, and retries automatically on network return or foreground visibility. The auth page also waits for verified access before post-login routing.

## P4 — core student routes

Release-gated routes include Dashboard, Find My Res, residence detail, My Applications, public Applications, Opportunities, WIL, Bursaries, Profile, Documents, Messages, Favourites, Service Centre, ResKonnect AI and portal routing. The automated core regression uses deterministic fixture data and deliberately injects failures into Dashboard, Find My Res, Applications and Opportunities to verify recovery.

## Boundary

Automated code, schema, Chromium/WebKit and Android build gates can prove deterministic software behaviour. They cannot reproduce every Huawei/Samsung OEM WebView/GPU kill, thermal condition or memory-pressure event. Physical OEM and Play pre-launch testing therefore remains a release acceptance requirement in later device-validation phases; this does not leave an unimplemented P1–P4 code defect.


## P1–P4 closure pass

The final P1–P4 pass also closed secondary infinite/loading-state risks on the rest of the student core:

- **Messages:** realtime INSERT events now coalesce into an actual bounded refresh instead of setting `loading=true` without fetching.
- **Favourites:** explicit error/retry/reconnect path and request cancellation.
- **WIL:** profile/application/document loading now has a bounded deadline, explicit failure state and retry.
- **Service Centre:** both initial RPC loading and request submission release busy state in `finally`, with retry after reconnect.
- **Profile:** failed profile reads no longer leave an editable blank form; recovery is explicit.
- **Documents:** backend failure is distinguished from a true empty document list.
- **Bursaries:** stale requests are cancelled and all load paths release the spinner.
- **ResKonnect AI:** direct Edge Function calls now have a 30-second client deadline, so the chat cannot remain indefinitely in "checking" state.
- **Renderer recovery:** the old Capacitor bridge/plugin lifecycle is explicitly torn down before activity recreation, and the last safe internal route is restored after the replacement WebView becomes usable.

Production Supabase verification on 2026-09-29 confirmed that the core P1–P4 tables `profiles`, `applications`, `application_messages`, `favorites`, `wil_applications`, `wil_documents`, `bursaries` and `mobile_runtime_events` exist, and that the required RPCs `get_my_access_context`, `my_reskonnect_command_centre`, `my_reskonnect_service_centre`, `create_my_reskonnect_request`, `reskonnect_opportunity_feed` and `virtual_tour_public_snapshot` are present.

### Research basis

The native recovery design follows Android's current WebView termination guidance: a WebView whose renderer has exited must not be reused; it must be removed/destroyed, references cleared, and the callback must return `true` when the host handles recovery. Android's current WebView memory guidance also emphasizes explicit lifecycle cleanup because WebView retains native/process memory outside the normal Java heap. Capacitor 8.5.2's `BridgeActivity` includes null-safe lifecycle forwarding, which allows the ResKonnect activity to drop the dead bridge reference before `recreate()` without later lifecycle null dereferences.

Android 16 / API 36 guidance also treats resizability and multi-window support as the baseline on large screens. ResKonnect therefore keeps the activity free of fixed orientation, fixed aspect-ratio and non-resizable declarations.
