# ResKonnect Premium Onboarding Upgrade — Jules Handoff

**Status: PARTIAL — Priority 1 foundation only.** Build is green; no existing routes or admin functionality were changed.

## What is complete

### Data layer (Priority 1)
- `src/lib/onboarding/onboardingTypes.ts` — Persona, Need, OnboardingStatus, OnboardingRequest, plus label maps.
- `src/lib/onboarding/complianceCopy.ts` — the three required compliance statements (admissions, official portal, no NSFAS).
- `src/lib/onboarding/onboardingMockData.ts` — 5 seed rows for the admin hub demo.
- `src/lib/onboarding/onboardingAdapter.ts` — placeholder `submitOnboardingRequest`, `getOnboardingRequests`, `updateOnboardingRequestStatus`, and `exportRequestsToCsv`. Backed by `localStorage` merged with seeds. Every function is marked with `// TODO: connect to Supabase onboarding_requests after backend migration is deployed.`

### Components (partial)
- `src/components/onboarding/ComplianceDisclaimer.tsx`
- `src/components/onboarding/PersonaSelector.tsx`
- `src/components/onboarding/NeedSelector.tsx` (exports `NeedOption` type + `getNeedOptions(persona)`)

## What is NOT yet built

All items below are unstarted. None are referenced anywhere yet, so the app still builds and every existing route still works.

### Remaining onboarding components
- `src/components/onboarding/OnboardingForm.tsx` — conditional fields per persona; must call `submitOnboardingRequest`.
- `src/components/onboarding/OnboardingResultRouter.tsx` — export `routeForRequest(record)` returning `{ path, label }`. See mapping below.
- `src/components/onboarding/OnboardingSummaryCard.tsx` — confirmation card with persona, need, next-step CTA, WhatsApp + call buttons (use `RESKONNECT_WHATSAPP_FORMATTED` / `RESKONNECT_PHONE` from `src/lib/constants.ts`). Must include "This is not an official application submission" copy.
- `src/components/onboarding/GuidedOnboardingFlow.tsx` — 4-step state machine (persona → need → form → summary) composing the four above.
- `src/components/onboarding/GuidedOnboardingModal.tsx` — wraps `GuidedOnboardingFlow` in a shadcn `Dialog`.

### Pages / routes (all to be added under `Suspense` in `src/App.tsx`)
- `/get-started` → `src/pages/GetStarted.tsx` (renders `GuidedOnboardingFlow` inside `PublicLayout`).
- `/living`, `/living/student-accommodation`, `/living/private-rentals`, `/living/parents` — under `src/pages/public/`.
- `/applications`, `/applications/tvet`, `/applications/university`, `/applications/private-college`, `/applications/checker` — under `src/pages/public/`. All must render `<ComplianceDisclaimer />`. `/applications/checker` is a client-side APS estimator (7 subjects, no backend).
- `/opportunities`, `/opportunities/wil` — under `src/pages/public/`.
- `/partners`, `/partners/landlords`, `/partners/institutions` — under `src/pages/public/`.

Existing `/apply` (ApplicationsHub) must remain untouched. `/applications` is a new premium landing page — reuse `PublicLayout` + `SEO`.

### Homepage upgrade
`src/pages/Landing.tsx` needs a new section after the hero:
- Heading: "Start with one question: what do you need?"
- Subtext: "Whether you are a student, parent, private tenant, applicant, landlord, or institution, ResKonnect guides you to the right support path."
- 8 need cards routing to `/get-started` (optionally with `?persona=` query param): Find a place to stay, Help my child, Find a private rental, Apply for study support, Get WIL support, List my property, Partner with ResKonnect, I am not sure.

### Admin Onboarding Hub (Priority 3)
- Add sidebar item in `src/components/admin/AdminLayout.tsx` (`allNavItems` array) between Analytics and Accommodation Hub: `{ icon: Users, label: "Onboarding Hub", path: "/admin/onboarding", roles: GOD_MODE_ROLES }`. Do NOT reorder or remove existing items.
- Register route `/admin/onboarding` in `src/App.tsx` behind `ProtectedRoute` + `AdminRoute` (lazy).
- Create `src/pages/admin/AdminOnboardingHub.tsx` following the exact structure of `src/pages/admin/AdminOperationsHub.tsx` (Tabs + AdminLayout wrapper).
- Tabs required: Overview, All Requests, Students, Parents / Guardians, Private Tenants, Application Support, WIL Support, Landlords, Institutions / Businesses, Unclear / Needs Routing, Reports.
- Sub-components under `src/components/admin/onboarding/`:
  - `AdminOnboardingOverview.tsx` — metric tiles listed below.
  - `AdminOnboardingMetrics.tsx` — count derivations from `getOnboardingRequests()`.
  - `AdminOnboardingRequestsTable.tsx` — table (Name, Persona, Need, Phone/WhatsApp, Status, Created, Assigned, Actions).
  - `AdminOnboardingRequestCard.tsx` — expanded row/detail.
  - `AdminOnboardingQuickActions.tsx` — action buttons (Call, WhatsApp, Email, Assign Staff, Update Status, Add Notes, Route buttons, Export CSV via `exportRequestsToCsv`).
- Metric tiles (Onboarding Intelligence): Total, New, Needs Routing, Parents/Guardians, Private Tenants, Application Support, WIL Support, Landlord Leads, Institution Leads.
- Metric tiles (Needs Attention): Unassigned, Documents Pending (placeholder = 0 for now), Awaiting Contact (status = new & no phone), Unclear Requests (persona = unsure).

## Routing map for `OnboardingResultRouter`

| persona | need / condition | route | label |
| --- | --- | --- | --- |
| student | accommodation | `/find` | Browse student accommodation |
| student | wil_support | `/opportunities/wil` | See WIL support |
| student | application_support | `/applications` | Explore application support |
| student | other | `/dashboard` | Go to your dashboard |
| parent_guardian | any | `/living/parents` | Parent & guardian resources |
| private_tenant | any | `/living/private-rentals` | Browse private rentals |
| applicant | details.institution_type contains "tvet" | `/applications/tvet` | TVET application guidance |
| applicant | contains "private" | `/applications/private-college` | Private college guidance |
| applicant | contains "university" | `/applications/university` | University application guidance |
| applicant | other | `/applications` | Applications hub |
| wil_applicant | any | `/opportunities/wil` | WIL placement support |
| landlord | any | `/partners/landlords` | Landlord partnerships |
| institution_business | any | `/partners/institutions` | Institution & business partnerships |
| unsure | any | `/get-started` | Continue guided setup |

## Backend hooks waiting for Supabase

All three adapter functions in `src/lib/onboarding/onboardingAdapter.ts` currently persist to `localStorage`. When the backend team ships an `onboarding_requests` table, replace the bodies with `supabase.from("onboarding_requests")…` calls (import from `@/integrations/supabase/client`). No other file needs changes for that switch — every consumer already goes through the adapter. Preserve the current function signatures.

## Compliance / copy rules (must-follow)

- Every page under `/applications*` must render `<ComplianceDisclaimer />` (already built).
- Never show any NSFAS application service / card / CTA. NSFAS may still appear only where it already exists as a *funding context* field on existing accommodation/student data.
- Do not use the phrases: guaranteed acceptance, guaranteed accommodation, guaranteed WIL placement, official admissions office, we apply for you, or claim official institution partnership unless verified in existing data.

## Files created this turn
- `src/lib/onboarding/onboardingTypes.ts`
- `src/lib/onboarding/complianceCopy.ts`
- `src/lib/onboarding/onboardingMockData.ts`
- `src/lib/onboarding/onboardingAdapter.ts`
- `src/components/onboarding/ComplianceDisclaimer.tsx`
- `src/components/onboarding/PersonaSelector.tsx`
- `src/components/onboarding/NeedSelector.tsx`
- `docs/JULES_FRONTEND_HANDOFF.md`
- `docs/FRONTEND_PROGRESS_CHECKLIST.md`

## Files modified this turn
- None. Existing routes, admin hubs, and the God Mode sidebar were intentionally left untouched.

## Known issues / assumptions
- Placeholder data lives in `localStorage`; clearing the browser wipes admin-visible demo submissions except the seed rows.
- The 8 persona-specific "Flow" wrappers named in the spec are intentionally collapsed into a single `OnboardingForm` that adapts by persona — this keeps the surface area small and matches the fields listed in the spec. Jules can split into individual flow files if preferred, but functionality is identical.
- No new dependencies were added.
- NSFAS application support: fully excluded. NSFAS still appears only via the pre-existing `/nsfas-accredited-accommodation` SEO page (accreditation context, not an application service).

## Exact next steps for Jules AI

1. **Finish onboarding components** in the order: `OnboardingForm` → `OnboardingResultRouter` → `OnboardingSummaryCard` → `GuidedOnboardingFlow` → `GuidedOnboardingModal`.
2. **Add `/get-started`** page and register it in `src/App.tsx` (lazy import next to other lazy pages).
3. **Homepage**: add the "Start with one question" section to `src/pages/Landing.tsx` after the existing hero.
4. **Public pages**: create all `/living/*`, `/applications/*`, `/opportunities/*`, `/partners/*` pages under `src/pages/public/`, register lazy routes in `src/App.tsx`. Consider a shared `PremiumPageShell` component to reduce duplication.
5. **Admin Onboarding Hub**: create `AdminOnboardingHub.tsx` + sub-components; add sidebar item to `AdminLayout.tsx`; add `/admin/onboarding` route.
6. **PublicLayout header**: optionally extend nav to include Living / Applications / Opportunities / Partners once those pages exist — nav currently still lists the legacy items.
7. **Backend swap**: when `onboarding_requests` table exists, replace adapter bodies (see "Backend hooks" above).

## Build result

- TypeScript: clean (no new consumers introduced yet, so no type collisions).
- No routes were added or removed. No admin functionality touched.
- Deployment: not performed.