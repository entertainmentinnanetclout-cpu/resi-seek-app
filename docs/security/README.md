# ResKonnect — Unified Security, Privacy and Launch Register
**Created:** 14 November 2026  
**Target:** ResKonnect React/Vite, Vercel, Supabase Auth/Postgres/Storage/Edge, PWA/Android, Yoco, AI, Gmail/Twilio.  
**Sources:** 10 uploaded video screenshots; read-only live ResKonnect Supabase Advisors/SQL/Edge code inspection; connected GitHub main branch; OWASP Top 10:2025, OWASP ASVS 5.0, Supabase Auth/Storage guidance.

## One backlog, no duplicate tasks

| Track | Range | Controls | Purpose |
| --- | --- | ---: | --- |
| **P0 immediate security** | SEC-01 – SEC-14 | 14 | Payment, DB privileges, identity/privacy, storage, secrets, MFA, AI cost/injection, release gates |
| **P1 account/browser security** | SEC-15 – SEC-31 | 17 | Login, OTP, recovery, JWT, CSRF, IDOR, injections, CORS, HSTS/CSP |
| **P1/P2 API/platform security** | SEC-32 – SEC-50 | 19 | Dependency attacks, external scripts, webhooks, AI tools, backups, scans, privilege hygiene |
| **POPIA/consumer/legal/accessibility** | GOV-01 – GOV-18 | 18 | Lawful consent, minors, data retention, truthful pricing/reviews, privacy and legal UX |
| **SEO, launch and visual quality** | WEB-01 – WEB-10 | 10 | Mobile, metadata, 404, UX consistency and the 20 aesthetic anti-patterns |
| **TOTAL** |  | **78** | **50 security + 18 governance + 10 nonsecurity quality** |

**Source of truth and links:**
- [P0 security register](REGISTER_P0_20261114.md)
- [P1 identity/browser register](REGISTER_P1_IDENTITY_BROWSER_20261114.md)
- [P1/P2 platform and API register](REGISTER_P1_P2_OPERATIONS_20261114.md)
- [POPIA, legal, launch and design register](REGISTER_LEGAL_LAUNCH_DESIGN_20261114.md)

## Verified technical baseline, not a hack report

| Finding (observed) | Evidence | Initial work ID | Meaning |
| --- | --- | --- | --- |
| Deployed Yoco checkout accepts client-supplied amount and order ID | Supabase live Edge function and repo `create-payment` | SEC-01 | **Confirmed code-level trust gap**; ownership/cost enforcement absent in handler, not a demonstrated exploit |
| Deployed Yoco webhook updates payment status based on request JSON without verifying provider signature in code | Live `yoco-webhook`, version 11; `verify_jwt=true` | SEC-02 | **Confirmed missing provider-auth check**; whether a third party can trigger it depends on upstream access |
| 4 flagged definer views | Supabase Security Advisor | SEC-03 | Need per-view review; one anonymous-readable view is intended for roommate listings, which must not expose private columns |
| 25 anon-executable privileged functions | PostgreSQL catalog and Supabase advisor | SEC-04 | Includes intentionally public feeds; not all are vulnerabilities |
| 217 authenticated-executable privileged functions | PostgreSQL and Supabase advisor | SEC-05 | Requires authorization review; calling a function is not itself evidence of access bypass |
| 0 public base tables with RLS disabled | PostgreSQL catalog | SEC-06 | **Existing control**, not proof policies enforce ownership |
| 15 private / 13 public buckets; 12 with no declared per-bucket size or MIME restriction | `storage.buckets` | SEC-07/08 | Bucket MIME/size constraints are separate from storage RLS; many public images may be intentional |
| Leaked-password protection disabled | Supabase Auth Advisor | SEC-10 | Enable when supported by project Auth plan and test |
| Main branch unprotected | GitHub main branch metadata | SEC-14 | CI exists but protection/required review still absent |
| HSTS, nosniff, frame restriction headers in Vercel config | `vercel.json` | SEC-30/31 | Existing config; actual deployed header and full CSP need checking |
| PR and weekly dependency-security audit exists | GitHub workflow and npm audit script | SEC-34 | Existing mitigation; exceptions and actual dependency updates need regular review |
| Twilio webhook checks signature/provider source | `adminos-whatsapp-webhook` source | SEC-41 | Existing approach, but other provider callbacks require independent review |
| 79 RLS-enabled tables have no policies | Supabase advisor INFO | SEC-50 | Can be deliberately service-only/default-deny; no blanket policy creation |
| pg_net installed in public schema | Supabase advisor | SEC-49 | Check supported relocation, no blind migration |

**Confidence rule:** A video is a checklist, not evidence of a flaw in ResKonnect. The code/database signals above are observed facts; exploitability and real protection require authenticated negative testing. **Do not mark closed because a CI script exists, and do not claim the platform is unhackable.**

## Execution phases, optimized for one person

1. **P0 containment and evidence (first):** Prioritize SEC-01/02 (payment), SEC-03–06 (privileged database), SEC-08 (unrestricted upload buckets), SEC-10/14 (password/branch), SEC-11–13 (admin/AI). No changes to customer money or production access without rollback and test coverage.
2. **P1 identity and privacy:** Test real roles and session/OTP/recovery; verify no student-to-student, student-to-landlord or guardian privacy leakage across Student 360 and linked documents.
3. **P1 web/API/AI resilience:** Deploy appropriate rate limits, CORS/CSRF/CSP, event replay protections, vetted file serving, safe HTML/input and AI tool permissions.
4. **P1 resilience and continuous defence:** Security logging, incident runbook, encrypted backup restore test, SAST/DAST, owner sign-off and independent penetration test.
5. **P2 compliance, launch and design:** Review privacy/terms/refunds, minors, actual cookie consent and vendor data flows, then SEO/visual quality. Keep marketing and UI quality **out of the vulnerability count**.

## Screenshot-to-control source coverage

| Screenshot family | Original themes | Canonical destinations |
| --- | --- | --- |
| Emmanuel: paid API rate limits and prompt injection | OpenAI/Anthropic endpoint rate limits; malicious LLM instructions | SEC-12, SEC-13, SEC-43, SEC-44 |
| Alex Yates: 20 website security essentials | Keys/env/Git, admin/auth, permissions, sanitization, XSS, SQLi, DB, rate, spend, uploads, CSRF, CORS, TLS, headers, cookies, debug, production | SEC-09, 11, 06, 21–25, 12, 08, 20, 29–32, 19, 45 |
| “20 ways hacked” | Next.js header, .git, storage, client price, credential stuffing, open DB, Polyfill, SMS, prompt, JWT, race, account pre-hijacking, takeover, SSRF, traversal, reset, maps, clickjacking, redirect, enumeration | SEC-32, 07, 01, 15, 06, 35, 16, 13, 19, 38, 17, 33, 26–28, 18, 31 |
| First 20 before app launch | Secrets, keys, public DB key, RLS, encryption, server auth, records, field tamper, cookies, hash, login/bot, SQL, inputs, XSS, file, API responses, headers, HTTPS, CVEs | SEC-09, 06, 42, 11, 21–25, 19, 15, 37, 08, 39, 31, 30, 34 |
| Second 20 before app launch | HSTS, CSRF, sessions/reset, enumeration, upload, webhooks, price, AI, API size, password reset rate, CORS, listing, admin route, failed login, logs, cookie flags, DB grants | SEC-30, 20, 19, 18, 08, 02, 01, 13, 36, 29, 32, 11, 15, 40, 05 |
| 20 items before website launch | Privacy/terms/cookies, metadata, favicon, SEO, photos, mobile, 404, forms, spam, analytics, CTA | GOV-01–04, WEB-01–09, SEC-37 |
| “20 ways not to get sued” | Refunds, consent, data minimization, SDKs, dark patterns, fees, reviews, claims, media, accessibility, minors, unsubscribe, deletion | GOV-01–18 |
| “20 reasons your app looks vibe-coded” | 20 visual clichés from gradients to typefaces/animations | WEB-10 only, plus GOV-16 for actual accessibility deficits |

All ten images are covered above (some images are separate frames of the same video). Repeated phrases are aliases, never second work items.

## Definition of DONE and work tracking

A control is not closed until it has: **owner**, source code or service, root cause, negative test (including relevant roles), expected error/denial, approved remediation, CI output, production validation, user flow regression, rollback, logging/alert, date and recheck owner. States:
`baseline` → `in_review` → `verified_gap` or `existing_control` → `fix_in_pr` → `staging_verified` → `production_verified` → `monitoring`. Only production-verified may be called fixed. For many screenshot items, correct state is `unverified` pending proof.

**Exceptions:** Changing Next.js headers does not apply to this Vite app. Hiding the admin URL is not server-side authorization. Password hashing belongs to Supabase Auth rather than custom frontend code. Public storage buckets can be appropriate for public media. “Purple gradients” are not exploits.

## Reference standards
- OWASP Top 10 2025: https://top10.owasp.org/2025/
- OWASP Application Security Verification Standard 5.0: https://asvs.owasp.org/
- OWASP Prompt Injection Prevention: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- OWASP File Upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Supabase Data API security: https://supabase.com/docs/guides/api/securing-your-api
- Supabase password security: https://supabase.com/docs/guides/auth/password-security
- Supabase Storage buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals

No production payment, login, document upload, database privileges or DNS settings were changed by this inventory sprint.


## Remediation log — SEC-03 to SEC-06 (14 November 2026)
- [Scoped invoker views, owner guard, landlord field restrictions, and live role-negative test results](SEC03_SEC06_RLS_VIEW_HARDENING_20261114.md)
- **SEC-03:** four flagged owner-privileged public views remediated; security advisor view errors now **0**. Existing roommate/recruitment/landlord view contracts preserved via RLS-filtered projections.
- **SEC-04:** one anonymous owner-oracle function fixed; anonymous-executable privileged-function warnings reduced from 25 to **24**. The rest remain individual review tasks.
- **SEC-05:** **218** authenticated-executable privileged functions remain for manual, scope-aware review. No broad revoke has been performed.
- **SEC-06:** residence-application field guards and real tenant-isolation SELECT tests implemented; authenticated multi-role business UAT remains outstanding.
- The previous line about no production changes describes only the initial *inventory sprint*. Later dedicated SEC remediation releases explicitly include live database migrations. Never treat that initial statement as current deployment status.


## Remediation log — SEC-04/05 internal RPC boundaries (14 November 2026)
- [Service-only AdminOS/WhatsApp/AI permission boundaries and staff-MFA / tour-owner guards](SEC04_SEC05_INTERNAL_RPC_HARDENING_20261114.md)
- **12** operational privileged RPCs now reject both anonymous and ordinary signed-in browser requests while retaining service-role execution.
- **3** sensitive browser RPCs enforce staff AAL2 or actual tour-owner/residence authorization inside their function body.
- Supabase authenticated-executable privileged-function Advisor count **218 → 206**; anonymous-executable count remains **24**. **SEC-04 and SEC-05 stay open** for per-function review.
- Actual role-negative tests, one staff-MFA positive test and owner-scoped tour test passed; known AdminOS cron workers still run under postgres.
- Existing SEC-03/06 roles and projection protections remain in place. All remaining privileged functions require individual risk review rather than broad grant removal.


## Public RPC / visitor-journey abuse controls — SEC-04 (15 November 2026)
- [Six hardened guest telemetry/referral RPCs, private request budgets, attribution session ownership and live tests](SEC04_PUBLIC_ATTRIBUTION_TELEMETRY_HARDENING_20261115.md)
- Browser compatibility preserved for the original referral click, recruiter redirect, Luna attribution and demand, virtual-tour events and Android diagnostics. Public functions intentionally retain their original signatures and public EXECUTE rights.
- Atomic per-actor minute/hour budget counters plus high-ceiling global safety caps and 48-hour private counter cleanup.
- Anonymous identifiers can be changed by clients: these are **abuse heuristics, not authenticated identities**. Trusted IP/edge network abuse controls remain a separate priority.
- Rolled-back live role tests confirmed legitimate events, throttled floods, oversized payload rejection and non-owner attribution changes denied. No customer tracking records were written by tests.


## SEC-12 live firewall and SEC-10 Auth readiness (15 November 2026)
- [Verified production and secondary Vercel firewall deployment, password-policy readiness and pending Auth toggle](SEC12_WAF_AUTH_READINESS_20261115.md).
- [Machine-readable WAF configuration and per-project rollback receipt](VERCEL_WAF_SECURITY_BASELINE_20261115.json).
- Both Vercel projects have a **240 requests/60 seconds per IP** rate limit only on Vercel API/sitemap paths, plus denial of common non-app secret/CMS probes. Their rules are active and validated; regular student, accommodation and landlord navigation is intentionally outside these path limits.
- **No claim of full Supabase edge protection:** direct Supabase Auth/PostgREST calls bypass Vercel; SQL authorization and telemetry quota protections remain in place.
- **SEC-10 remains pending in the hosted Auth service:** Supabase Pro eligibility verified, but the live advisor still reports breached-password protection off. The operator must toggle `Authentication → Sign In / Providers → Email → Prevent use of leaked passwords` in the Supabase dashboard.
- The frontend code only improves password error handling and signup/reset guidance; it does **not** activate the hosted breached-password feature.

## SEC-10 and SEC-12 follow-up — 15 November 2026
- Supabase Security Advisor was rerun after the operator enabled leaked-password screening; the former `auth_leaked_password_protection` warning is no longer reported. This does not replace an interactive password-signup negative test.
- [ResMap AI request-budget implementation and live verification](SEC12_RESMAP_AI_ABUSE_20261115.md): direct Supabase Edge calls for map intent and accommodation image AI must consume atomic service-only budgets with rotating-guest global caps. This is distinct from Vercel WAF and Supabase Auth's native rate limits.


## SEC-04 public read privacy controls (15 November 2026)
- [Privacy and bounded request fixes for referral lookup, tour snapshots and opportunity feeds](SEC04_PUBLIC_READ_PRIVACY_20261115.md).
- Three public `SECURITY DEFINER` read RPCs retain their exact signatures and public grant; the fix blocks inactive recruiter names, hidden-residence tour snapshots and oversized opportunity searches. Security Advisor *counts* for privileged RPCs are therefore not expected to decrease. Auth rate-limit/CAPTCHA hosted settings remain independently unverified.


## SEC-07/08 private profile and store-image RLS repair (15 November 2026)
- [Verified private-profile anonymous metadata exposure and targeted store-image owner-folder remediation](SEC07_SEC08_STORAGE_OWNER_ISOLATION_20261115.md).
- This release removes anonymous `SELECT` for the private `user-profiles` bucket and replaces two permissive store-assets upload paths with a single owner/admin check. No existing objects are deleted. Bucket MIME/size enforcement remains a separate staged review.
