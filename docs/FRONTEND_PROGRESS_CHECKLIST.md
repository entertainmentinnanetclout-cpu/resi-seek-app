# ResKonnect Frontend Upgrade — Progress Checklist

## Homepage
- [x] Hero upgraded to premium dark layout with custom lighting effects
- [x] Get Started CTA added
- [x] Persona cards added
- [x] Need cards added
- [x] Confirmation state added
- [x] Integrated parent-safety FAQ section

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

## Canonical Branding (NEW V2 Upgrade)
- [x] Central Brand Constants File (`src/constants/brand.ts`) created
- [x] Replaced header, footer, auth, preloader, and admin layouts with canonical logo references
- [x] Replaced favicons, apple touch icons, and PWA icons with official logo derivatives
- [x] Implemented premium preloader loading screen with centered CSS pulse scale and gold/orange glow
- [x] Refactored ResidenceCard to include verification badges, distances, available slots, and premium action grids
- [x] Polished ResidenceDetail page with Parent-Safe Comfort Checklists, Deposit safety disclaimers, Last verified audit dates, and Report Detail prompts
- [x] Polished ApplicationsChecker.tsx UI with Achievement Scales reference grid

## Build
- [x] TypeScript passes
- [x] Build passes
- [x] Existing pages still load
- [x] Visual frontend verification complete with zero errors
