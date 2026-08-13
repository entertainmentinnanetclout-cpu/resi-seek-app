# Phase 6A — Pretoria/Tshwane Public TVET Applications Catalogue

## Scope

Phase 6A expands the Pretoria Applications Hub from universities into the full **public TVET college** boundary for the Tshwane/Pretoria metro.

The Department of Higher Education and Training (DHET) Gauteng TVET directory identifies the two Tshwane public TVET colleges as:

1. **Tshwane South TVET College (TSC)**
2. **Tshwane North TVET College (TNC)**

No other Gauteng public TVET college is represented as a Tshwane/Pretoria college in the DHET directory. Other Gauteng public TVET colleges (Central Johannesburg, Ekurhuleni East, Ekurhuleni West, Sedibeng, South West Gauteng and Western) remain outside this Pretoria-first boundary.

## Source-year boundary

The live college sources currently expose **2026** catalogues/prospectus material. ResKonnect is planning the 2027 application journey, but Phase 6A does **not** relabel 2026 requirements as 2027 requirements.

Every imported row is therefore tagged with:

- `reference_year = 2026`
- `planning_year = 2027`
- a verification note requiring the official 2027 prospectus/curriculum to be checked when the colleges publish it.

This is intentionally conservative. The catalogue can already support programme discovery and official application routing without making unsupported claims about future admission rules.

---

## 1. Tshwane North TVET College (TNC)

### Official sources

- College: https://www.tnc.edu.za/
- Prospectus & Programmes: https://tnc.edu.za/programmes.php
- Official 2026 prospectus PDF: https://tnc.edu.za/documents/TNC%20Prospectus%202026.pdf
- How to Apply: https://www.tnc.edu.za/how-to-apply

### Campus boundary

TNC states that it operates six campuses in the Greater Tshwane Metropolis:

- Mamelodi
- Pretoria
- Rosslyn
- Soshanguve North
- Soshanguve South
- Temba

The consolidated Prospectus & Programmes page is the Phase 6A catalogue authority. Programme rows use `Varies by campus` until each programme-to-campus relationship has been reconciled against the current campus pages/prospectus. This avoids inventing campus availability.

### Imported programme routes: 31

#### Semester — Business Studies N5–N6 (10)

1. Management Assistant
2. Financial Management
3. Art and Design
4. Public Relations
5. Clothing Production
6. Tourism
7. Hospitality & Catering Services
8. Public Management
9. Legal Secretary
10. Business Management

The official TNC programme page publishes programme-specific selection criteria, including English and relevant subject thresholds. These criteria are retained as the source boundary for the later TVET eligibility engine; Phase 6A itself enables catalogue discovery and official application routing rather than presenting a completed automated eligibility decision.

#### Trimester — Engineering Studies N4–N6 (6)

1. Bricklaying
2. Plumbing
3. Electrical
4. Automotive
5. Fitting
6. Boiler Making

The official consolidated page requires Matric/Grade 12 or NC(V) Level 4 and publishes Mathematics/Technical Mathematics or Mathematical Literacy and Physical Science thresholds by route.

#### Year — Business Studies NC(V) NQF 2–4 (5)

1. Finance, Economics and Accounting
2. Generic Management
3. Office Administration
4. Marketing
5. Transport and Logistics

#### Year — Engineering Studies NC(V) NQF 2–4 (5)

1. Electrical Infrastructure Construction
2. I.T and Computer Science
3. Engineering and Related Design
4. Civil Engineering and Building Construction
5. Mechatronics

#### Year — Utility Studies NC(V) NQF 2–4 (4)

1. Hospitality
2. Tourism
3. Safety in Society
4. Primary Agriculture

#### Bridging (1)

1. Pre-learning Programme (PLP)

### TNC application flow

The official TNC application guidance states that applications are submitted online during specified application periods and may also be completed with online walk-in assistance at a campus. An application is not an offer of admission.

ResKonnect therefore routes applicants to the official TNC application page and does not imply admission approval.

---

## 2. Tshwane South TVET College (TSC)

### Official sources

- College: https://www.tsc.edu.za/
- Programmes: https://www.tsc.edu.za/programmes
- How to Apply: https://www.tsc.edu.za/how-to-apply
- Documents library: https://www.tsc.edu.za/documents
- Atteridgeville Campus: https://www.tsc.edu.za/campuses/atteridgeville
- Centurion Campus: https://www.tsc.edu.za/campuses/centurion
- Odi Campus: https://www.tsc.edu.za/campuses/odi

### Prospectus status

TSC's current official website exposes a **Prospectus** entry in the 2026 study navigation, but the official Documents library currently returns **0 documents**. Phase 6A therefore does not import a third-party prospectus PDF or fabricate an official PDF URL.

Instead, TSC is grounded in its current official programme catalogue and campus programme pages. The metadata records:

`prospectus_status = official_downloadable_pdf_not_currently_exposed_in_documents_library`

When TSC publishes an official downloadable prospectus, its URL can be added without replacing or weakening the existing official source trail.

### Campus boundary

TSC identifies four campuses:

- Atteridgeville
- Centurion
- Odi
- Pretoria West

### Imported unique programme routes: 25

1. Bookkeeper Occupational
2. Bricklayer
3. Carpenter
4. Civil & Construction L2–L3
5. Civil Engineering N4–N6
6. Financial Management N5–N6
7. Management Assistant N5–N6
8. Marketing L2–L4
9. Natural Sciences — Electrical & Civil Engineering
10. Office Administration L2–L4
11. Plumber (Occupational)
12. Retail Buyer Occupational
13. Cook L4
14. Electrical Engineering N4–N6
15. Electrical Infrastructure Engineering L2–L4
16. Electrician L4
17. Engineering and Related Design L2–L4
18. Fitter & Turner L4
19. Hospitality L2–L4
20. Hospitality N4–N6
21. Mechanical Engineering N4–N6
22. Welder L4
23. Clothing Production N5–N6
24. Tourism L2–L4
25. Tourism N5–N6

### Verified campus mapping used in Phase 6A

- **Atteridgeville:** Bookkeeper Occupational; Bricklayer; Carpenter; Civil & Construction L2–L3; Civil Engineering N4–N6; Financial Management N5–N6; Management Assistant N5–N6; Marketing L2–L4; Natural Sciences — Electrical & Civil Engineering; Office Administration; Plumber; Retail Buyer.
- **Centurion:** Bookkeeper Occupational; Cook L4; Electrical Engineering N4–N6; Electrical Infrastructure Engineering L2–L4; Electrician L4; Engineering and Related Design L2–L4; Financial Management N5–N6; Fitter & Turner L4; Hospitality L2–L4; Hospitality N4–N6; Management Assistant N5–N6; Marketing L2–L4; Mechanical Engineering N4–N6; Office Administration; Welder L4.
- **Odi:** Bricklayer; Carpenter; Civil & Construction L2–L3; Civil Engineering N4–N6; Clothing Production N5–N6; Cook L4; Electrical Infrastructure Engineering L2–L4; Fitter & Turner L4; Hospitality L2–L4; Hospitality N4–N6; Management Assistant N5–N6; Marketing L2–L4; Mechanical Engineering N4–N6; Natural Sciences — Electrical & Civil Engineering; Office Administration; Plumber; Tourism L2–L4; Tourism N5–N6.
- **Pretoria West:** the current official Marketing programme page explicitly includes Pretoria West. The main TSC site confirms Pretoria West as the fourth campus. Phase 6A does not infer additional Pretoria West programme availability from older or non-current sources.

### TSC application flow

The official TSC process requires applicants to complete career guidance, a compulsory placement assessment and the online application with the required supporting documents. The assessment is described as guidance rather than a simple pass/fail test.

ResKonnect therefore links directly to the official TSC How to Apply route and does not replace the college's assessment/application workflow.

---

## Production import

Phase 6A production state after migration:

- **2** Pretoria/Tshwane public TVET institutions in the Applications Hub
- **31** active TNC programme catalogue rows
- **25** active TSC programme catalogue rows
- **56** active Pretoria/Tshwane TVET programme rows in total
- official application routes normalized for both institutions
- TNC official 2026 prospectus PDF stored in institution metadata
- TSC official programme catalogue + documents-library status stored in metadata
- every programme row explicitly tagged as a 2026 reference for 2027 planning/reverification

## Deliberate exclusions from Phase 6A

Phase 6A does **not**:

- claim that the 2026 catalogue is a 2027 prospectus;
- import unofficial/third-party TSC prospectus PDFs;
- guarantee admission;
- assume a TNC campus for a programme where the consolidated source does not establish that mapping;
- turn TVET matching into a university-style APS-only decision.

A later Phase 6B can implement deterministic TVET eligibility rules using each college's actual Grade 9/Grade 12/NC(V), subject and programme-specific selection logic.