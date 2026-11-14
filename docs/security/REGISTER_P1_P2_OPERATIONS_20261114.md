# P1/P2 Security Register, Part B — Supply Chain, APIs, AI, Operations
**Stable IDs SEC-32–SEC-50.** This continues P0 and P1 Part A without duplicate tasks.

| ID | One work item: repeated screenshot terms merged | Observed baseline | Exit test |
| --- | --- | --- | --- |
| SEC-32 | **Source maps, debug data, .git and framework leaks** — Next.js header, exposed repo, debug mode, directory listing | TEST; production stack is Vite/React, so Next.js header advice is not directly applicable | Test deployed .git/assets/maps, no secrets/build paths or stack traces |
| SEC-33 | **Subdomain takeover and domain inventory** — stale DNS/CNAMEs, unused subdomains | TEST; canonical host redirects configured, DNS records unverified | Inspect every CNAME/TXT/hosting target, remove dangling DNS, monitor certificates |
| SEC-34 | **Dependency and lockfile supply chain** — scan dependencies, vulnerable packages, outdated transitive libs | EXISTING: PR/weekly dependency gate and build-only advisory exceptions | Runtime CVEs zero; separately document and expire any accepted build-time CVE, keep lockfile and pin trusted actions |
| SEC-35 | **External script/CDN integrity** — Polyfill.io and untrusted third-party scripts | TEST; exact Polyfill.io presence not established | Inventory remote scripts/SDKs, remove unsafe providers and set appropriate CSP/integrity |
| SEC-36 | **API resource consumption** — request-size limit, timeouts, excessive response data, large JSON | TEST; Edge and AI endpoints exist | Bound body bytes, pagination, timeout, external fanout and memory use |
| SEC-37 | **Public bot and spam abuse** — form spam, referral spam, bot protection | TEST; lead, search, referral and email flows exist | Rate limit and challenge by risk, deny synthetic traffic, preserve accessible student flows |
| SEC-38 | **Races, duplicate reservations and idempotency** — race condition, double payment, concurrent updates | PARTIAL: Golden service batch actions use preflight and expected state | Atomic room hold/payment changes, unique operation IDs, concurrency tests |
| SEC-39 | **Safe error handling and response minimization** — remove debug errors, trim API responses | TEST; some Edge functions return raw error text | Generic client errors, no PII/secrets in responses, structured private diagnostics |
| SEC-40 | **Security logging, threat alerts and anomaly detection** — log security events | PARTIAL: admin/Auth events and CI exist; coverage unknown | Alert on failed authentication, excessive paid requests, API/DB denials, webhook anomalies |
| SEC-41 | **All nonpayment webhook signatures** — Twilio/WhatsApp/voice/email/provider callbacks | PARTIAL: Twilio webhook verifies signature or provider REST, other integrations need check | Provider-authenticated raw-body signatures, replay and event dedupe |
| SEC-42 | **Sensitive-data encryption and retention** — encrypt PII, restricted keys, minimal disclosures | TEST: private buckets and RLS exist, field-level controls not proved | Sensitive-field inventory, key policy, secure backups and authorized lifecycle deletion |
| SEC-43 | **AI tool isolation and least privilege** — agent authorization, tool calls and identity | TEST: Brain invokes tools; trust boundary review outstanding | Verify tools independently check roles/ownership and require approval for high-impact writes |
| SEC-44 | **AI output safety, factualness and PII minimization** — unsafe output, unsupported AI recommendations | TEST: agent confidence exists but no complete red-team sign-off | Sanitize output, restrict leakage, verify claims, do not auto-decide housing/funding/WIL |
| SEC-45 | **Production and CI configuration hygiene** — prod env, debug flags, staging secrets, deployment access | TEST: release workflows exist but full Vercel environment not inspected | Verify preview restrictions, independent secrets and secure build settings |
| SEC-46 | **Disaster recovery, encrypted backups and restoration** — safe backup, account recovery, rollback | TEST: no recent successful restore verification in this audit | Run isolated restore, record recovery-point/time objectives and protect backup access |
| SEC-47 | **Continuous SAST/DAST, pen test and fix verification** — 20 prelaunch security checks | TEST: 7 CI gates exist, independent multi-role security test unverified | Map to OWASP ASVS 5, test web/API/mobile, resolve high risks and re-test |
| SEC-48 | **Student 360 and guardian/partner permissions** — student privacy, minors, delegated residence scopes | PARTIAL: God Mode AAL2 and scoped case views exist | Test user, guardian, landlord and partner rights independently; no lifetime profile leak |
| SEC-49 | **Public-schema extension exposure** — least-privileged extension schema | ADVISORY: Supabase flags pg_net in public | Check relocation support, revoke irrelevant calls, avoid breaking jobs |
| SEC-50 | **RLS tables without policies** — intentional default-deny vs missing functionality | INFO: 79 RLS-enabled tables have no policies; many may be service-only | Document each intentional deny, inspect grants and avoid blanket public policies |

### Non-applicable and contextual advice from the screenshots
- **Next.js header:** ResKonnect uses Vite/React, not Next.js. Check generic version/header disclosure under SEC-32, but do not install Next.js-specific mitigations.
- **Changing or removing /admin URL:** is not a meaningful security control; maintain server-side authorization, multifactor and role tests under SEC-11.
- **“Hash passwords”:** do not build duplicate password hashing if Supabase Auth manages credentials; verify safe Auth configuration under SEC-10/19.
- **Polyfill.io:** the video lists a known compromised external-script pattern. Do not assert this exact dependency exists until script inventory under SEC-35 proves it.
- **Security headers:** several headers already exist; extending CSP should follow report-only rollout, not blindly block required Google, Stripe/Yoco, WhatsApp, or Supabase connections.
- **CORS *:** not automatically an exploit for authenticated bearer APIs; review token, cookies and sensitive responses before changing it.
- **Public storage:** public image/media buckets can be legitimate; the obligation is to ensure their contents and write permissions are appropriate.
- **Source code and advisory findings are evidence, not exploit reports.** Dynamic authorized tests remain necessary.

### Completion protocol
Owner, affected feature, severity, source of truth, exact mitigation, CI proof, live negative test, impact on student journeys, rollback, and retest date must be recorded against each unique SEC ID.
