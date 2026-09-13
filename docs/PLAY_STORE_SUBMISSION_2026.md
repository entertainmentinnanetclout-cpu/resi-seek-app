# ResKonnect Android — Google Play Submission Pack
**Prepared:** 13 September 2026  
**Package ID:** `org.reskonnect.app`  
**First release:** versionName `1.0.0`, versionCode `1`  
**Target:** Android 16 / API 36  
**Artifact:** Android App Bundle (AAB)

## 1. Play Console identity

Create the Play Console app as **ResKonnect** and use the exact package identity `org.reskonnect.app`.
The package ID becomes permanent after the first published artifact. If Play Console reports that this package is unavailable, stop before uploading any bundle and change the package consistently in Capacitor, Gradle, Java package, strings and this submission pack.

Suggested settings:
- Default language: English (South Africa) if available, otherwise English (United Kingdom).
- App or game: App.
- Category: Education.
- Pricing: Free.
- Contains ads: No, unless an advertising SDK or paid third-party ad placement is introduced before submission.

## 2. Store listing

### App name
ResKonnect

### Short description
Find student living, applications and opportunities with ResKonnect AI.

### Full description
ResKonnect connects the student journey across Living, AI and Opportunity.

**Living**
Discover student accommodation, explore residence information, use ResMap location features, and keep accommodation applications connected to your account.

**ResKonnect AI**
Get guided answers and next-step support across accommodation, applications and your ResKonnect journey. AI guidance is grounded in available ResKonnect information and does not replace official decisions by institutions, funding bodies, employers or accommodation providers.

**Opportunity**
Explore current bursaries, WIL pathways, graduate programmes and student opportunities with source and closing-date context. Signed-in users can save opportunities and receive contextual relevance guidance based on their ResKonnect profile.

**Applications and documents**
Prepare application information, maintain your student profile, upload required documents and track supported workflows from one account.

**My ResKonnect Service Centre**
Create a tracked support request and follow its customer-visible status from submission to resolution.

**Privacy and control**
ResKonnect includes account-security controls, a published privacy policy and both in-app and web account-deletion request paths.

Availability, prices, programme requirements, funding outcomes, admissions, employment and placement decisions remain subject to the relevant official provider or institution.

### Contact / policy URLs
- Website: https://www.reskonnect.org
- Privacy policy: https://www.reskonnect.org/privacy
- Account deletion: https://www.reskonnect.org/delete-account
- Support email: use the monitored ResKonnect support mailbox entered in Play Console.

## 3. App content declarations

### Ads
Answer **No** for "Contains ads" for Android v1 if no advertising SDK or third-party paid ad placement has been added.

### App access
Public Living and Opportunity discovery can be reviewed without privileged staff access.
For account-only areas, provide Google Play with a dedicated reviewer student account before submission. Do not provide an admin, God Mode, residence-admin or real student's account.

Reviewer instructions should say:
1. Open ResKonnect.
2. Sign in with the dedicated reviewer email/password supplied in Play Console.
3. Student home: Dashboard / My ResKonnect.
4. Account and deletion controls: Profile → Account & Data Controls.
5. Service requests: My ResKonnect → Service Centre.
6. Accommodation discovery: Find My Res.
7. Opportunities: Opportunities.

If the reviewer account requires email verification, verify it before submitting the release.

### Target audience
Use the actual intended audience. Current product positioning is tertiary students/applicants and related adult users. If matric applicants aged 16–17 are intentionally included, include the 16–17 bracket as well as 18+. Do not select younger child brackets unless the product is intentionally redesigned for them.

### Content rating
Complete the IARC questionnaire from current production behavior. ResKonnect does not intentionally provide gambling, sexual content, graphic violence or controlled-substance content. Answer user-generated / communication questions according to the live messaging, profile, marketplace or community features visible in the submitted build.

### News
Do not classify ResKonnect primarily as a news app; campus/news content is a supporting feature.

### Financial features
Do not declare ResKonnect as a financial-services or lending app unless such regulated services are added to the submitted Android build.

## 4. Permission declarations

Android v1 declares only:
- INTERNET — core online service.
- CAMERA — user-initiated 360 capture/media capture.
- ACCESS_COARSE_LOCATION — optional foreground nearby/map functions.
- ACCESS_FINE_LOCATION — optional foreground ResMap/navigation functions.

Android v1 deliberately does **not** request:
- Background location.
- Contacts.
- SMS.
- Call logs.
- Broad/manage external storage.
- Package installation.
- Native notification permission.

Location is requested for app functionality and only when the user invokes a location feature. Camera is requested only for a user-initiated capture function.

## 5. Account deletion

Play Console Data deletion URL:
**https://www.reskonnect.org/delete-account**

The same control is discoverable inside:
**Profile → Account & Data Controls → Request account deletion**

The deletion request is stored server-side and supports legal-retention exceptions disclosed in the privacy policy.

## 6. Play App Signing

Use Play App Signing for the new app. Google manages the app-signing key; ResKonnect keeps a separate upload key.

Required GitHub environment: `play-store`

Required environment secrets:
- `RK_ANDROID_UPLOAD_KEYSTORE_B64`
- `RK_ANDROID_UPLOAD_STORE_PASSWORD`
- `RK_ANDROID_UPLOAD_KEY_ALIAS`
- `RK_ANDROID_UPLOAD_KEY_PASSWORD`

Never commit the JKS/keystore or passwords to the repository.

After secrets exist, run:
**Actions → Android Play Store Signed Release → Run workflow**
with:
- version_code: 1
- version_name: 1.0.0

Download the resulting `reskonnect-play-1.0.0-1` artifact and upload `app-release.aab` to Play Console.

## 7. Release track

For an organisation developer account, use Internal testing first, then the release track appropriate to the account's production-access state.

If the Play developer account is a **personal account created after 13 November 2023**, Google requires a closed test with at least 12 testers continuously opted in for 14 days before production access. Follow the requirement shown in the actual Play Console account; do not assume the rule applies to an organisation account.

## 8. Pre-submit gate

Do not submit until all are true:
- PR Android Play Store Readiness workflow is green.
- Signed release workflow passes `jarsigner -verify`.
- versionCode is unique/increased.
- Privacy URL returns successfully.
- Deletion URL returns successfully.
- Reviewer account is valid.
- Data Safety answers match the live build.
- IARC content rating is complete.
- Ads declaration is complete.
- App access declaration is complete.
- Store listing has phone screenshots and required graphics.
- AAB upload produces no Play Console policy or compatibility blocker.

## 9. Current deliberate v1 limitations

- Google OAuth is not run inside the embedded Android WebView. Android v1 uses email/password authentication in-app; Google sign-in remains available on the ResKonnect website until a system-browser/native OAuth bridge is shipped.
- Native push/FCM is not enabled in v1, so POST_NOTIFICATIONS is not requested.
- No background location is requested.
