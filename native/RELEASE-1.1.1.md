# Android 1.1.1 — candidate build 4

## Implemented

- Native signed-out launch goes to `/auth`; website `/` retains Landing.
- Shared portal registry covers applicants, residences, recruiters, creator partners, education partners and staff. Add future portal entry points to `src/lib/accountRouting.ts`; backend authorization remains mandatory.
- Persisted Supabase sessions survive closing/reopening. Refresh/resume of the same identity does not rerun access resolution. Explicit local sign-out clears the session; revocation still takes precedence.
- Native account navigation remains outside route suspense/loading; website header includes sign-out.
- Access request races are guarded, requests have a timeout, and account switches clear React Query data.
- Fixed conditional Profile hooks, stale specialist authorization, inconsistent staff redirects, non-string contact metadata handling, missing admin icon, review callbacks, creator slug, discovery score structure and footer keys.
- Native builds disable website PWA generation. Native boot unregisters historical workers without deleting auth storage.
- Production schema delta corrected using live information_schema reads. No production user data or schema was changed.

## Verification

`node scripts/android-session-regression.mjs` uses mocked Supabase responses and blocks test WebSockets. It verifies login, refresh/resume, reload, close/reopen, explicit logout, eleven route shells, four staff-role destinations, and unchanged website entry. This is browser simulation, not Android instrumentation or end-to-end production account verification.

Release gates include full application TypeScript (`-p tsconfig.app.json`), existing link/SEO/platform/360 checks, production build, Android readiness checks and dependency audit. The readiness workflow additionally runs browser regressions before compiling the unsigned AAB.

## Before release

1. Require all PR checks to pass, including API 36 AAB compilation.
2. Run the protected **Android Play Store Signed Release** workflow with version name `1.1.1`, version code `4` (increase again if already consumed in Play). Preserve the existing upload key.
3. Install the signed internal-test build through Google Play. Test login, all relevant role dashboards, close/force-stop/reopen, background/resume after token expiry, offline/reconnect, logout, document upload, navigation and Android Back.
4. Capture Android Logcat/Play crash reports if the native process exits. No native crash trace was supplied during this patch; the exact reported native failure has not been confirmed reproduced.

Do not describe this candidate as crash-free or production-ready until the installed-device checks are complete. A website deployment does not replace the JavaScript bundled in an already installed APK/AAB.
