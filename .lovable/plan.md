# ResKonnect Premium Onboarding Upgrade — Frontend Only

Credit-aware, build-safe, backend-untouched. Structured for handoff to Jules AI if credits run out mid-execution.

## Guardrails (non-negotiable)

- No Supabase tables, migrations, RLS, edge functions, secrets, or env changes.
- Do not touch `src/integrations/supabase/client.ts`, `types.ts`, or edge functions.
- Do not remove/replace existing God Mode admin, sidebar items, or hubs — extend only.
- Do not break existing routes (`/find`, `/apply`, `/dashboard`, `/admin/*`, `/residence/*`, etc.).
- Exclude NSFAS *application* support entirely (funding-context references may remain where already present).
- Include required disclaimers on all application-facing pages.

## Priority-ordered execution (stop-safe at any priority boundary)

### Priority 1 — Onboarding foundation + homepage entry

Shared data layer:
- `src/lib/onboarding/onboardingTypes.ts` — Persona, Need, OnboardingRequest, Status enums/types.
- `src/lib/onboarding/onboardingMockData.ts` — seed rows for admin hub demo.
- `src/lib/onboarding/onboardingAdapter.ts` — `submitOnboardingRequest`, `getOnboardingRequests`, `updateOnboardingRequestStatus`. Backed by `localStorage` + in-memory merge with mock data. Every function carries `// TODO: connect to Supabase onboarding_requests after backend migration is deployed.`

Core components under `src/components/onboarding/`:
- `PersonaSelector.tsx`, `NeedSelector.tsx`, `OnboardingForm.tsx` (conditional fields per persona+need), `OnboardingResultRouter.tsx`, `OnboardingSummaryCard.tsx`, `GuidedOnboardingModal.tsx`.
- Persona-specific flow wrappers (thin composition around the above): Student, ParentGuardian, PrivateTenant, Applicant, WilApplicant, Landlord, InstitutionBusiness, Unsure.

Pages/routes:
- `src/pages/GetStarted.tsx` → `/get-started` (full-page guided flow).
- Homepage (`src/pages/Landing.tsx`): add `ServicePillarCards` + "Start with one question" section with the 8 need cards launching the modal or routing to `/get-started`.

Build gate: run typecheck, verify Landing renders.

### Priority 2 — Public premium pages

Create under `src/pages/public/`:
- `Living.tsx` → `/living` + subroutes `/living/student-accommodation`, `/living/private-rentals`, `/living/parents`.
- `Applications.tsx` → `/applications` + `/applications/tvet`, `/applications/university`, `/applications/private-college`, `/applications/checker` (marks/APS readiness — client-side calculator, no backend).
- `Opportunities.tsx` → `/opportunities`, `/opportunities/wil`.
- `Partners.tsx` → `/partners`, `/partners/landlords`, `/partners/institutions`.

Every applications-family page renders a `ComplianceDisclaimer` component with the three mandated statements. No NSFAS application CTA anywhere.

Reuse existing PublicLayout, SEO, Button, Card primitives. Register routes in `src/App.tsx` (lazy-loaded) beside existing public routes — do not disturb existing entries.

Build gate: typecheck + smoke each new route.

### Priority 3 — Admin Onboarding Hub (extend, don't replace)

- Add `AdminOnboardingHub.tsx` under `src/pages/admin/` following existing hub pattern (mirrors `AdminOperationsHub` tab structure).
- Sub-components under `src/components/admin/onboarding/`: Overview, RequestsTable, RequestCard, QuickActions, Metrics.
- Register route `/admin/onboarding` in `App.tsx` behind `AdminRoute`.
- Add sidebar entry in the existing admin sidebar (locate current sidebar file, insert Onboarding Hub between Analytics and TVET Hub) — additive only.
- All data flows through `onboardingAdapter` — currently returns mock rows. Actions (Assign, Update Status, Add Note) mutate via adapter; TODO comments mark Supabase wiring.
- CSV export = client-side blob download from current adapter list.

Build gate: typecheck + load `/admin/onboarding`.

### Priority 4 — Polish + handoff

- Responsive review at 375px.
- Empty-state illustrations/copy.
- Final typecheck.

Handoff docs (created early and updated after each priority):
- `docs/JULES_FRONTEND_HANDOFF.md` — completed vs partial, file list, routes, components, known issues, backend hooks awaiting Supabase, exact next steps.
- `docs/FRONTEND_PROGRESS_CHECKLIST.md` — the full checklist from the spec with live tick state.

## Technical notes

- Reuse: `PublicLayout`, `DashboardLayout`, `AdminLayout`, shadcn `Card/Button/Tabs/Dialog`, Sonner toasts, Lucide icons, existing design tokens (vibrant palette already in `index.css`).
- Router: keep `BrowserRouter`; new routes added as `lazy(() => import(...))` in existing `<Suspense>`.
- No new dependencies. Forms use plain React state (persona/need are small enums; skip RHF+Zod overhead).
- Contact CTA reuses existing WhatsApp number `063 732 3192` from project constants.
- Compliance strings centralised in `src/lib/onboarding/complianceCopy.ts` so Jules can adjust in one place.

## Explicit non-goals this turn

- No admin sidebar redesign, no removal of any existing tab.
- No changes to Marketplace paused routes.
- No auth flow changes.
- No edge function or SQL work — Jules will wire `onboardingAdapter` to a future `onboarding_requests` table.

## Stop-safe contract

If credits run out mid-priority: current priority's partial files stay behind feature flags or unlinked routes only if fully compilable; otherwise revert the incomplete component to a stub that renders "Coming soon" so build stays green. `JULES_FRONTEND_HANDOFF.md` will name the exact next file and function to resume.
