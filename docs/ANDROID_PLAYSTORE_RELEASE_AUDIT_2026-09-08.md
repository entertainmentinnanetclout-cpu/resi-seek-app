# ResKonnect Android / Google Play Release Audit

Date: 2026-09-08
Scope: `entertainmentinnanetclout-cpu/resi-seek-app`

## Executive status

The current web application is deployable, but the native Android source required to produce a Google Play Android App Bundle is **not present on the repository's current main branch**. The repository tree does not contain `android/`, `capacitor.config.*`, or Capacitor packages in `package.json`.

This means the prior native/Capacitor work must be recovered into source control before a production AAB can be treated as release-ready. Do not recreate or sign a second Android app with a different application ID unless the original native project is confirmed unrecoverable.

## Current Google Play requirement

As of 31 August 2026, new apps and app updates submitted to Google Play for standard Android mobile must target **Android 16 / API level 36 or higher**. The recovered Android project must therefore use `targetSdk >= 36` and should use `compileSdk >= 36`.

## Release gate

The Android release is approved only when all of the following are evidenced in source control and on a real device:

### Native source and identity

- `capacitor.config.*` committed.
- `android/` committed.
- Application ID exactly matches the package registered in Play Console.
- `versionCode` is monotonically increasing.
- `versionName` is release-approved.
- `compileSdk >= 36`.
- `targetSdk >= 36`.
- Compatible Android Gradle Plugin, Gradle and JDK versions.
- Release build produces an `.aab`, not only an APK.
- Upload key is not stored in Git.
- Play App Signing is enabled in Play Console.

### Authentication and deep links

- Supabase PKCE/deep-link callbacks work from the installed Android app.
- Email verification links return to the app correctly.
- Password reset links return to the app correctly.
- God Mode stays web/admin scoped and requires AAL2 2FA.
- Normal student/partner role routing remains deterministic inside the native shell.

### Permissions

- Camera is requested only when a user explicitly uploads/captures a document.
- Fine location is requested only when Find My Res / navigation needs it.
- Background location is not requested unless a separately justified product requirement exists.
- Android 13+ notification permission is handled before push notifications are shown.
- Permission denial and "don't ask again" states have user-facing recovery instructions.

### ResMap / native mobile

- 2D map opens on a physical Android device.
- Live location updates continuously after permission is granted.
- Route navigation survives app background/foreground transitions within platform limits.
- Street View Eye control opens and closes reliably.
- Street View orientation is visually checked against a physical street/route.
- 3D mode loads or cleanly falls back without a blank screen.
- Residence cards close and do not cover route navigation.

### Uploads and documents

- Camera capture works.
- Gallery/file selection works.
- Android content URIs upload correctly to Supabase Storage.
- Large PDF/image upload failure states are clear.
- Session expiry during upload recovers safely.

### Push and notifications

- Production FCM project is connected if push notifications are enabled.
- Token registration is user-bound and protected by RLS.
- Duplicate tokens are de-duplicated.
- Notification taps deep-link to a valid route.
- No notification contains sensitive student information on the lock screen unless explicitly appropriate.

### Offline / resilience

- Offline shell loads.
- Network loss does not corrupt application state.
- Pending writes clearly indicate whether they were actually submitted.
- Reconnection refreshes critical application and residence state.
- Service-worker/PWA caching does not keep a stale web bundle indefinitely inside the native shell.

### Google Play user-data compliance

Because ResKonnect supports account creation, Play submission must include:

- Public privacy policy URL.
- Privacy policy accessible inside the app.
- Accurate Data safety declaration.
- Readily discoverable in-app account deletion request path.
- Public web resource where a user can request account deletion without reinstalling the app.
- A defined process that deletes associated user data except data that must lawfully be retained, with that retention disclosed.

### Store review readiness

- Play Console developer/organization identity verified.
- D-U-N-S details match the organization profile.
- App package registered in Play Console.
- App category and content rating completed.
- Ads declaration completed accurately.
- Data safety completed accurately.
- App access section includes working reviewer credentials for any gated flows.
- Screenshots, icon, feature graphic, short description and full description reflect the production app.
- Internal testing track receives the signed AAB before production rollout.

## Automated check

Run:

```bash
node scripts/android-playstore-readiness.mjs
```

For a release-blocking local/CI check after the native project is restored:

```bash
node scripts/android-playstore-readiness.mjs --strict
```

## Current hard blocker

At the time of this audit the repository does not contain the native Android/Capacitor project. Until that source is restored, no claim that the Android build is "Play Store ready" is technically verifiable from GitHub.
