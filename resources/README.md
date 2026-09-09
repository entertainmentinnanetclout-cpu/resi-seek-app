# ResKonnect native icon assets

Canonical native icon masters:

- `icon.png` — 1024×1024 ResKonnect app icon for iOS AppIcon generation and legacy Android launcher output.
- `icon-foreground.png` — transparent ResKonnect symbol for Android adaptive icon foreground generation.

These files intentionally reuse the approved brand assets already tracked in `src/assets` so the web/PWA, iOS and Android applications do not drift into different icons.

When the missing Capacitor native projects are restored, generate/sync platform assets from these masters and verify them on a physical Android device and in the iOS AppIcon catalog. Do not substitute a different logo or create a second application identity.

Expected native targets after restoration:

- Android: `android/app/src/main/res/mipmap-*`, `mipmap-anydpi-v26/ic_launcher.xml`, round icon, adaptive foreground/background.
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset` including the 1024×1024 App Store icon.

The application/package identifier must be read from the recovered Capacitor/Android/iOS source and matched to the existing Play Console application before generating a signed release.