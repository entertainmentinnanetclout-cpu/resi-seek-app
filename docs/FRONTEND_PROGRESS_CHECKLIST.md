# ResKonnect Frontend Upgrade — Progress Checklist

## Homepage
- [x] Hero upgraded
- [x] Get Started CTA added
- [x] Persona cards added
- [x] Need cards added
- [x] Confirmation state added

## Onboarding
- [x] Types created
- [x] Mock data created
- [x] Adapter created
- [x] Student flow
- [x] Parent flow
- [x] Private tenant flow
- [x] Applicant flow
- [x] WIL flow
- [x] Landlord flow
- [x] Institution/business flow
- [x] Unsure flow

## Routes
- [x] /get-started
- [x] /living
- [x] /living/student-accommodation
- [x] /living/private-rentals
- [x] /living/parents
- [x] /applications
- [x] /applications/tvet
- [x] /applications/university
- [x] /applications/private-college
- [x] /applications/checker
- [x] /opportunities
- [x] /opportunities/wil
- [x] /partners
- [x] /partners/landlords
- [x] /partners/institutions

## Admin
- [x] Existing God Mode preserved
- [x] Sidebar item added
- [x] Onboarding Hub overview added
- [x] Mock request table added
- [x] Metrics added
- [x] Quick actions added
- [x] Backend TODOs added (in adapter)

## Compliance
- [x] No NSFAS application service
- [x] No guaranteed acceptance wording
- [x] No official institution claim
- [x] Admissions disclaimer added (component ready)
- [x] Official portal disclaimer added (component ready)

## Build
- [x] TypeScript passes
- [x] Build passes
- [x] Existing pages still load
## Intent engine (this turn)
- [x] `UserIntentProvider` mounted in `App.tsx` (inside `AuthProvider`), persists to localStorage.
- [x] `IntentQuickStep` added as step 3 of the guided flow (institution, campus/area, funding, budget). Skippable.
- [x] `deriveFiltersFromIntent` maps intent -> Find My Res filters (audience, campus, nsfasOnly, price, room type).
- [x] `IntentNotice` explains applied filters, offers "Show everything", and shows a private-rental request panel (no student residences mislabelled as rentals).
- [x] WhatsApp-ready link helpers in `src/lib/whatsappLinks.ts` (click-to-chat only, no API/secrets).
- [x] Corrected placeholder WhatsApp number in `OnboardingSummaryCard` to 063 732 3192.

### Backend TODOs
- Private rental listings table does not exist — private tenants get a request/WhatsApp panel instead of listings.
- Intent profile sync to `onboarding_requests.metadata` still pending (adapter stubs in `src/lib/intent/userIntentAdapter.ts`).
