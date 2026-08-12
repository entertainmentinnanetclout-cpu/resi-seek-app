# Phase 5A — University of Pretoria 2027 Course Match source audit

## Source decision

The user-supplied PDF is an official University of Pretoria publication titled **International undergraduate prospectus — Applicants with a school leaving certificate not issued by Umalusi (South Africa) — 2027**. It is not the domestic NSC/IEB prospectus.

UP's official Admission Information page separately publishes both the **Undergraduate Prospectus 2027** and the **International undergraduate prospectus 2027**. The two routes must therefore remain isolated in Course Match.

## Production route enabled in Phase 5A

- Institution: University of Pretoria (`university-of-pretoria`)
- Intake: 2027
- Qualification system: `nsc_ieb`
- Domestic source: UP 2027 undergraduate programme/application-requirement pages and faculty/JuniorTukkie requirement tables
- Life Orientation: excluded from UP APS
- Contact/domestic programme catalogue rows modelled: 128
- Additional distinct UPOnline route reconciled in Phase 5A.1: 1 (`09110003` Higher Certificate in Sports Sciences, 2 years fully online)
- **Total active UP programme rows after reconciliation: 129**
- **Grade 12 matcher candidates after reconciliation: 128**
- Faculty-placement-only rows excluded from matching: 1 (`01130014` BA 4-year faculty-placement route)
- Active requirement rows: 129
- Subject requirement rows: 312
- Selection/additional-assessment rows: 24
- Conditional curriculum rows: 4

### UPOnline reconciliation

The official 2027 UPOnline programme page confirms a distinct **Higher Certificate in Sports Sciences (UPOnline) Part-time**, programme code `09110003`, with:

- minimum duration: 2 years fully online
- English Home Language or English First Additional Language: NSC/IEB level 4 (50–59%)
- APS: 20
- Life Orientation excluded from APS
- part-time access to a school, sports club and/or accredited training facility required for the Sports Practical component

This is **not** the same row as the 1-year contact Higher Certificate in Sports Sciences (`09110004`). Both are student-facing 2027 routes and must remain distinct.

## International route

The supplied international prospectus is registered in `course_match_import_batches` as a verified official source, but its Cambridge/IB/SAT/other non-Umalusi conversion rules are **not enabled** in the domestic matcher.

This is intentional. A future international matcher must explicitly model:

- USAf exemption requirements
- UP percentage conversion tables
- SAT faculty minimums where applicable
- international qualification type and level
- programme-specific international subject requirements

It must not reuse an NSC/IEB percentage or APS result without conversion.

## Production functions

- `public.course_match_up(integer, jsonb, boolean)`
- `public.save_up_course_match(integer, jsonb, text)`

The matcher filters to active, student-facing, matric-direct UP rows with `qualification_system = 'nsc_ieb'`. Because it is data-driven, the verified UPOnline row enters the matcher without a special-case code path.

## QA boundary

Structural QA after Phase 5A.1 reconciliation:

- active programmes: **129**
- active requirements: **129**
- matcher candidates: **128**
- duplicate programme codes: 0
- duplicate slugs: 0
- missing requirements: 0
- pending requirements: 0
- unexpected null APS rows: 0
- faculty-placement leakage: 0
- international-route leakage: 0
- subject requirement rows: **312**
- conditional rows: 4
- selection rows: 24
- full production matcher output at maximum academic marks: **128**

Behavioural regression after UPOnline reconciliation: **28/28 PASS** against the live `course_match_up` RPC. The added guard verifies programme `09110003` returns `eligible` at APS 20 with English 50%.

## Official UP source entry points

- https://www.up.ac.za/students/admission-information
- https://www.up.ac.za/students/faculty-brochures-2027
- https://www.up.ac.za/programmes/undergraduate
- https://www.up.ac.za/programmes/uponline
- https://www.up.ac.za/programmes/uponline/higher-certificate-sports-sciences-uponline-part-time/2027
