# ResKonnect Android native project

Package: `org.reskonnect.app`  
Capacitor: 8.5.0  
minSdk: 24  
compileSdk / targetSdk: 36  
Java: 21

Refresh native web assets with:

```bash
npm ci
npm install --no-save --package-lock=false @capacitor/core@8.5.0 @capacitor/android@8.5.0 @capacitor/cli@8.5.0
npm run build
npx cap sync android
```

The PR readiness workflow compiles a release AAB as a build proof. The protected Play release workflow signs the AAB using the upload-key values held outside git and verifies the signature.

Do not commit upload keys, credentials, generated web assets, or generated Cordova plugin projects.

Android v1 deliberately excludes background location, contacts, SMS/call-log, broad storage and native notification permissions.
