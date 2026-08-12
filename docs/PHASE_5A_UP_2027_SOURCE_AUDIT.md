# Phase 5A — University of Pretoria 2027 Course Match source audit

## Source decision

The user-supplied PDF is an official University of Pretoria publication titled **International undergraduate prospectus — Applicants with a school leaving certificate not issued by Umalusi (South Africa) — 2027**. It is not the domestic NSC/IEB prospectus.

UP's official Admission Information page separately publishes both the **Undergraduate Prospectus 2027** and the **International undergraduate prospectus 2027**. The two routes must therefore remain isolated in Course Match.

## Production route enabled in Phase 5A

- Institution: University of Pretoria (`university-of-pretoria`)
- Intake: 2027
- Qualification system: `nsc_ieb`
- Domestic source: UP 2027 undergraduate programme/application-requirement pages and JuniorTukkie application-requirements tables
- Life Orientation: excluded from UP APS
- Active programme catalogue rows modelled: 128
- Grade 12 matcher candidates: 127
- Faculty-placement-only rows excluded from matching: 1 (`01130014` BA 4-year faculty-placement route)
- Subject requirement rows: 311
- Selection/additional-assessment rows: 24
- Conditional curriculum rows: 4

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

The matcher filters to active, student-facing, matric-direct UP rows with `qualification_system = 'nsc_ieb'`.

## QA boundary

Structural QA after import:

- active programmes: 128
- active requirements: 128
- matcher candidates: 127
- duplicate programme codes: 0
- duplicate slugs: 0
- missing requirements: 0
- pending requirements: 0
- unexpected null APS rows: 0
- faculty-placement leakage: 0
- international-route leakage: 0
- subject orphans: 0
- selection orphans: 0
- full production matcher output at maximum academic marks: 127

Behavioural regression: **27/27 PASS** against the live `course_match_up` RPC.

## Official UP source entry points

- https://www.up.ac.za/students/admission-information
- https://www.up.ac.za/juniortukkie/undergraduate-programmes-infographics
- https://www.up.ac.za/programmes/undergraduate
