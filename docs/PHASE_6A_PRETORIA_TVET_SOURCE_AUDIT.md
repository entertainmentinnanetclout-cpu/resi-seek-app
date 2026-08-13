# Phase 6A — Pretoria/Tshwane Public TVET Applications Catalogue

## Scope

Phase 6A expands the Pretoria Applications Hub into the full **public TVET-college institution boundary** for Tshwane/Pretoria.

The Department of Higher Education and Training Gauteng directory places these two public TVET colleges in Tshwane:

1. **Tshwane South TVET College (TSC)**
2. **Tshwane North TVET College (TNC)**

Other Gauteng public TVET colleges are outside the Pretoria-first boundary.

## Source-year rule

The current official college sites expose **2026** application/catalogue material. ResKonnect is planning the 2027 journey, but Phase 6A does not relabel 2026 information as 2027 requirements.

Imported catalogue rows therefore use:

- `reference_year = 2026`
- `planning_year = 2027`
- a reverification note requiring the official 2027 material to replace/reconcile the current reference once published.

This allows programme discovery and official application routing now without making unsupported future-admission claims.

---

## Tshwane North TVET College (TNC)

### Official sources

- College: https://www.tnc.edu.za/
- Prospectus & Programmes: https://tnc.edu.za/programmes.php
- Official 2026 prospectus PDF: https://tnc.edu.za/documents/TNC%20Prospectus%202026.pdf
- How to Apply: https://www.tnc.edu.za/how-to-apply

### Campus boundary

TNC identifies six Greater Tshwane campuses: Mamelodi, Pretoria, Rosslyn, Soshanguve North, Soshanguve South and Temba.

### Consolidated current catalogue imported: 31 routes

**Semester — Business Studies N5–N6 (10)**

Management Assistant; Financial Management; Art and Design; Public Relations; Clothing Production; Tourism; Hospitality & Catering Services; Public Management; Legal Secretary; Business Management.

**Trimester — Engineering Studies N4–N6 (6)**

Bricklaying; Plumbing; Electrical; Automotive; Fitting; Boiler Making.

**Year — Business Studies NC(V) NQF 2–4 (5)**

Finance, Economics and Accounting; Generic Management; Office Administration; Marketing; Transport and Logistics.

**Year — Engineering Studies NC(V) NQF 2–4 (5)**

Electrical Infrastructure Construction; I.T and Computer Science; Engineering and Related Design; Civil Engineering and Building Construction; Mechatronics.

**Year — Utility Studies NC(V) NQF 2–4 (4)**

Hospitality; Tourism; Safety in Society; Primary Agriculture.

**Bridging (1)**

Pre-learning Programme (PLP).

The consolidated official TNC page also publishes programme-specific selection criteria. Those criteria are the source boundary for the next TVET eligibility phase; Phase 6A keeps the user-facing decision at programme discovery + official application routing.

Programme rows use `Varies by campus` unless current campus availability has been separately reconciled, rather than guessing a campus from the consolidated catalogue.

---

## Tshwane South TVET College (TSC)

### Official sources

- College: https://www.tsc.edu.za/
- Programmes: https://www.tsc.edu.za/programmes
- How to Apply: https://www.tsc.edu.za/how-to-apply
- Documents library: https://www.tsc.edu.za/documents
- Atteridgeville: https://www.tsc.edu.za/campuses/atteridgeville
- Centurion: https://www.tsc.edu.za/campuses/centurion
- Odi: https://www.tsc.edu.za/campuses/odi

### Prospectus status

The current TSC site exposes a Prospectus navigation entry, but its official Documents library currently reports **0 documents**. Phase 6A therefore does not use a third-party prospectus PDF or invent an official PDF URL.

TSC is grounded in the live official programme/campus pages until an official downloadable prospectus is exposed. Institution metadata records that limitation explicitly.

### Verified current programme rows imported: 25

The import contains **25 routes that are directly verifiable from the current official programme pages and the discoverable Atteridgeville, Centurion and Odi campus catalogues**, plus Pretoria West where an official programme page explicitly confirms it.

This is a **verified-row count, not a claim that 25 is the complete TSC college prospectus total**. The current searchable source does not expose a complete Pretoria West programme index or downloadable prospectus, so Phase 6A deliberately avoids inventing missing routes.

Verified rows:

Bookkeeper Occupational; Bricklayer; Carpenter; Civil & Construction L2–L3; Civil Engineering N4–N6; Financial Management N5–N6; Management Assistant N5–N6; Marketing L2–L4; Natural Sciences — Electrical & Civil Engineering; Office Administration L2–L4; Plumber (Occupational); Retail Buyer Occupational; Cook L4; Electrical Engineering N4–N6; Electrical Infrastructure Engineering L2–L4; Electrician L4; Engineering and Related Design L2–L4; Fitter & Turner L4; Hospitality L2–L4; Hospitality N4–N6; Mechanical Engineering N4–N6; Welder L4; Clothing Production N5–N6; Tourism L2–L4; Tourism N5–N6.

### Verified campus mappings retained

- Atteridgeville and Odi mappings come directly from current official campus pages.
- Centurion mappings come directly from its current official campus page.
- Pretoria West is recorded for Marketing because the current official Marketing programme page explicitly names Pretoria West.
- Additional Pretoria West mappings are not inferred from older or third-party sources.

### Application workflow

TSC's official How to Apply page requires career guidance, a compulsory placement assessment and the online application with supporting documents. TNC likewise directs applicants through the college's official online application process.

ResKonnect therefore sends the final application action to the official college route and does not represent a catalogue match as an admission offer.

---

## Production state

After the Phase 6A Supabase migration:

- 2 active Pretoria/Tshwane public TVET institutions are configured in the Applications Hub.
- TNC has 31 current official catalogue rows.
- TSC has 25 currently verified official catalogue rows under the source limitation above.
- 56 active Pretoria/Tshwane TVET programme rows are searchable in total.
- Both institutions use official How to Apply routes.
- TNC stores the official 2026 prospectus PDF URL.
- TSC stores its official live catalogue/Documents status rather than an unofficial PDF.
- Every imported programme is explicitly marked as a 2026 reference for 2027 planning/reverification.

## Deliberate exclusions

Phase 6A does not:

- claim that 2026 material is a 2027 prospectus;
- claim that the 25 verified TSC rows prove the complete TSC prospectus count;
- import unofficial prospectus PDFs;
- guarantee admission;
- infer unverified campus availability;
- force TVET admissions into a university-style APS-only matcher.

A later Phase 6B can implement TVET eligibility checks using the colleges' actual Grade 9/Grade 12/NC(V), subject and programme-specific selection rules.