# ResKonnect Frontend Upgrade — Progress Checklist

## Homepage
- [ ] Hero upgraded
- [ ] Get Started CTA added
- [ ] Persona cards added
- [ ] Need cards added
- [ ] Confirmation state added

## Onboarding
- [x] Types created
- [x] Mock data created
- [x] Adapter created
- [ ] Student flow
- [ ] Parent flow
- [ ] Private tenant flow
- [ ] Applicant flow
- [ ] WIL flow
- [ ] Landlord flow
- [ ] Institution/business flow
- [ ] Unsure flow

_(Note: Persona & Need selectors are built and can drive a single adaptive `OnboardingForm` — see handoff.)_

## Routes
- [ ] /get-started
- [ ] /living
- [ ] /living/student-accommodation
- [ ] /living/private-rentals
- [ ] /living/parents
- [ ] /applications
- [ ] /applications/tvet
- [ ] /applications/university
- [ ] /applications/private-college
- [ ] /applications/checker
- [ ] /opportunities
- [ ] /opportunities/wil
- [ ] /partners
- [ ] /partners/landlords
- [ ] /partners/institutions

## Admin
- [x] Existing God Mode preserved
- [ ] Sidebar item added
- [ ] Onboarding Hub overview added
- [ ] Mock request table added
- [ ] Metrics added
- [ ] Quick actions added
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