# Privacy, Legal, Launch and Visual Quality Register
**Separate from the 50 security tasks.** These items came from the screenshot lists, but many are privacy/consumer/SEO/accessibility requirements or design opinions rather than hack vectors. Keep them tracked without mislabeling them as vulnerabilities.

## Privacy, legal, consumer and accessibility — GOV-01–GOV-18

| ID | Unique obligation (merged screenshot wording) | Current state and acceptance |
| --- | --- | --- |
| GOV-01 | **Privacy policy** | React Privacy page exists. Check data collection, retention, contact details, Student 360, minors and integrations against actual practices. |
| GOV-02 | **Terms and conditions / terms of service** | Terms page exists. Legal review, current products, disclaimers, fees, partner services and cancellation rights. |
| GOV-03 | **Refund/cancellation policy** | Verify Yoco/payment-related policy is clear and shown at point of purchase; ensure process works in practice. |
| GOV-04 | **Cookie policy and consent banner** | Privacy page discusses cookies and Meta Pixel; verify consent before nonessential tracking and an easy change of preference. |
| GOV-05 | **Clear service/form contact consents** | Audit all signup, WIL, rental, application, guardian, WhatsApp and email consents or other lawful grounds; retain evidence. |
| GOV-06 | **Children and guardian consent / lawful processing** | Student lifecycle extends to school leavers, including minors. Verify competent-person consent or other lawful basis and separate guardian scope. |
| GOV-07 | **Data minimization and purpose/retention schedules** | Prevent extra document copies in Student 360; implement lawful retention, expiry and data minimization by source. |
| GOV-08 | **Data subject access/correction/deletion** | AccountDeletion page exists; verify end-to-end request, authentication, legal holds, backups and response timelines. |
| GOV-09 | **Third-party SDK/provider data audit** | Identify Meta Pixel, analytics, Google, Twilio, AI, payment providers; privacy controls and processing agreements. |
| GOV-10 | **Unsubscribe and message preference enforcement** | Check each marketing email, WhatsApp and SMS workflow; distinguish transactional notices and marketing opt-out. |
| GOV-11 | **Fee and total-price transparency** | Check residence top-ups, application fees, delivery and cancellation costs before payment; remove hidden fees. |
| GOV-12 | **Genuine student/residence reviews** | No fake reviews, fake rating counts or invented star averages; verify and moderate authentic opinions. |
| GOV-13 | **Truthful public claims** | Verify accreditation, verified landlord, “Africa's first”, AI/SI and rankings with evidence and current dates; remove unsupported claims. |
| GOV-14 | **Business identity and support details** | Ensure actual company identity, appropriate business contact details and support channels are available. |
| GOV-15 | **Media and font licences** | Review logos, photos, generated media, third-party fonts, TikTok embeds and soundtrack rights for lawful use. |
| GOV-16 | **Accessibility: alt text, contrast and keyboard** | Test WCAG-focused text contrast, visible focus, keyboard access, screen-reader labels, reduced motion, form errors and mobile input. |
| GOV-17 | **No dark patterns** | Avoid disguised marketing consent, forced opt-in, deceptive urgency, surprise fees or impossible cancellation. |
| GOV-18 | **POPIA breach response and regulatory obligations** | Define incident notification, evidence preservation, responsible party, processing records and subject notice workflow. |

**Boundary:** Visual alt text and color contrast are maintained under GOV-16; security-oriented XSS validation is SEC-24. Privacy consent is GOV-04/05; cookie-session security is SEC-19/20. Marketing honesty and accreditation are GOV-12/13, not extra security tickets.

## Website launch, discoverability and conversion — WEB-01–WEB-10

| ID | Unique item | Baseline and acceptance |
| --- | --- | --- |
| WEB-01 | **Meta titles/descriptions/social previews** | SEO CI and prerender exist; verify real canonical page previews and truthful content. |
| WEB-02 | **Sitemap and robots.txt** | Both are in repository; test production response, canonicalization and private-page noindex. |
| WEB-03 | **Favicon and PWA/app icon fidelity** | Check actual mobile/installable icons and sharing previews. |
| WEB-04 | **Image compression/responsive images/alt text** | Performance budgets and image quality; accessibility text lives in GOV-16. |
| WEB-05 | **Page speed and mobile usability** | Web and Android CI exist; verify field metrics, real mobile devices, booking and search. |
| WEB-06 | **Custom 404 and broken links** | NotFound component and link tests exist; check production 404 and all key navigation. |
| WEB-07 | **Clear form validation and persistence** | Visible errors, reasonable defaults, save progress and post-login return; server-side validation is SEC-25. |
| WEB-08 | **Privacy-aware analytics and conversion measurement** | Measure confirmed bookings and placements without breaching GOV-04/05. |
| WEB-09 | **One clear conversion CTA per public page** | Reduce duplicated or competing controls; test student and landlord flows. |
| WEB-10 | **Distinctive design system / avoid “vibe-coded” clichés** | One UX task, not 20 vulnerabilities. Design audit includes: purple-blue gradient, gradient hero text, emoji headings, Inter everywhere, colored card borders, glassmorphism, low contrast in dark mode, three icon boxes in a row, badge above every heading, Lucide everywhere, untouched shadcn, fade-in scroll, cursor-following beam, hover fade buttons, inconsistent spacing, excess em dashes, buzzword copy, serif italic accents, Space Grotesk + Instrument Serif, grain over gradients. Prefer distinctive ResKonnect typography, accessible contrast, restrained motion and consistent content. |

### Why the design list is separate
A gradient, an icon library, a font or a glass effect is **not a vulnerability**. Some may be appropriate when used deliberately. The screenshots are a design critique, not evidence that the platform can be hacked. This list is a single design-system review to avoid 20 decorative tickets.

### Completion
Each GOV or WEB ID requires an owner, current behavior, screenshot or URL test, acceptance criteria and recorded resolution. Legal matters must be reviewed against actual South African legal obligations and business practices, not considered compliant merely because a page exists.
