# SEC-12 / SEC-10 — Network-Edge Firewall and Password-Policy Readiness
**ResKonnect — 15 November 2026**
**Deployment status:** Vercel WAF rules are **active and verified** on both projects. Frontend/Auth copy changes are in the accompanying PR and are **not yet deployed** until the PR is merged and a production deployment succeeds. Supabase breached-password screening remains **disabled** as reported by the live Security Advisor; the connected Supabase integration cannot change hosted Auth settings.

## Verified network-edge configuration

**Primary project:** `reskonnect-hub` (`prj_tjqfZtlukq3wc6k4wQGImzDDxSUf`) with `www.reskonnect.org`, `reskonnect.org` and `reskonnect.co.za`. Existing Vercel firewall active; version **4** after this release.

**Secondary project:** `resi-seek-app` (`prj_3is5C6kF6YsO1zc3mQUmUWwFUyq2`) with `resi-seek-app.vercel.app`. Default firewall had no custom rules; now configured, version **2**.

Both projects, on the verified Vercel Hobby team, have exactly two active, valid custom rules:

| Rule | Action and scope | Why |
| --- | --- | --- |
| **SEC-12 ResKonnect public API rate budget** | **240 requests per 60 seconds per Vercel-observed client IP**; fixed window; return **HTTP 429** for excess requests; paths beginning `/api/` and `/sitemaps/`, plus `/sitemap.xml` | Protects Vercel API/sitemap infrastructure from individual high-volume clients without limiting normal page visits |
| **SEC-32 Deny secret-file and legacy CMS probes** | **HTTP 403** for paths beginning `/.git`, `/.env`, `/.svn`, `/wp-admin`, `/vendor/phpunit`; and exact `/wp-login.php`, `/xmlrpc.php` | Rejects common nonexistent or sensitive scanner paths without targeting real student/landlord routes |

No blanket geoblocking, no login CAPTCHA and no rate limits on `/auth`, `/dashboard`, `/find`, `/res` or partner-portal navigation. Those flows are important for ordinary South African students, including users behind campus/shared IP addresses. Existing OWASP/CRS SQLi, XSS and RCE rules were **log-only** on the canonical project; this phase does not claim that those managed rules now block attacks.

**Crucial network boundary:** Frontend Supabase database/Edge/Auth requests go straight to `*.supabase.co`. They do **not** go through Vercel WAF, even when initiated from a page served on `www.reskonnect.org`. The database-side per-actor/global telemetry counters and strict RPC RLS from SEC-03/04/05 remain necessary. Vercel IP limits alone do not protect direct Supabase traffic, authentication endpoints, or provider webhooks.

**Scaling constraints:** Vercel Hobby includes one rate-limit rule per project. Vercel counters can be regional, and shared NAT users count together. If genuine API/crawler traffic exceeds 240/min per IP, review the verified firewall logs before adjusting the cap. No stress/flood test was run against the production site; active/valid Vercel configuration is verified via connector, not a simulated 429 storm.

**Audit and rollback:** The exact project/rule IDs and verified deployment settings are in [the firewall configuration receipt](VERCEL_WAF_SECURITY_BASELINE_20261115.json). Roll back only the offending rule through Vercel Firewall → Configure (or remove it by its recorded rule ID), and check Firewall → Audit Log. Do **not** switch off the whole Vercel firewall. Observe legitimate sitemap responses and real traffic after deployment.

## Supabase leaked-password protection — eligible, pending one dashboard action

- **Plan verified:** ResKonnect's Supabase organization is on **Pro**. This provider feature is supported on Pro and above; no plan upgrade is required.
- **Current state:** the live Supabase Security Advisor still reports `auth_leaked_password_protection` **disabled**.
- **Why not toggled here:** the connected Supabase integration exposes project SQL, functions, Edge, logs and advisors but no hosted Auth configuration-update action. This cannot be legitimately enabled by executing SQL migrations or changing `supabase/config.toml` in the GitHub repository; claiming so would be misleading.
- **Exact user action:** open [Supabase → ResKonnect project → Authentication → Sign In / Providers → Email](https://supabase.com/dashboard/project/mefjzkhobkltlbmhusdh/auth/providers?provider=Email), turn on **Prevent use of leaked passwords**, and click **Save**. Do not share project API keys, OTPs or passwords with anyone. Rerun Security Advisor and confirm the warning disappears.
- **Server authority:** Supabase Auth uses HaveIBeenPwned's compromised-password data to reject unsafe newly submitted passwords when this setting is enabled. We do not submit plaintext passwords to external services from the browser. Existing users' accounts, application records and accommodation documents must not be deleted or automatically reset during the change.
- **Testing:** perform one legitimate test sign-up and a password change with an eligible strong unique password; check that a deliberately weak/leaked password is refused, without logging or persisting any supplied test password. Check recruiter and landlord login, password recovery, and account-session preservation.

## Frontend readiness included in the PR

- A consistent `getAuthErrorMessage` translator handles Supabase `weak_password` / `AuthWeakPasswordError`, including the `pwned` reason, without printing technical errors or calling breach APIs from the browser.
- Student, recruiter and password-reset forms now consistently precheck 8+ characters, uppercase, lowercase and a number. **These checks are usability hints, not server-side enforcement.**
- Recruiter signup now uses the shared error translator instead of blindly exposing the backend error text.
- Student sign-in warns flagged-password users to change it promptly; the password-reset screen no longer falsely claims server-side leaked-password rejection is already active.
- `scripts/sec12-waf-auth-policy.test.mjs` exercises actual transpiled Auth error mapping and checks the live WAF receipt, and is added to mandatory `auth:check`. It does not replace real Auth provider configuration validation.

## Verification state and remaining risks
- **Verified today:** primary and secondary Vercel firewall enabled; four active valid custom rules; two rate-limit caps at 240/60s per provider IP; two scanner deny rules; prior Supabase SQL request budgets still independent; Pro plan eligibility; Advisor still flags disabled leaked password protection.
- **Pending:** explicit hosted Auth toggle and re-run advisor; browser production release verification and end-to-end login tests; WAF traffic trend monitoring/false-positive review; WAF/edge protection for direct Supabase endpoints via a trusted ingress architecture (avoid spoofable client IP headers).
- **Do not claim completed:** full DDoS-proof hosting, leaked-password screening enabled, global authentication abuse prevention, or a full independent penetration test.

## Official references
- [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) — Hobby supports fixed-window IP/JA4 rate limiting, with one rate-limit rule per project.
- [Vercel WAF](https://vercel.com/docs/vercel-firewall/vercel-waf) — custom rules and restoring prior configurations.
- [Supabase Auth password security](https://supabase.com/docs/guides/auth/password-security) — breached-password protection on Pro and higher, independent of frontend validation.
