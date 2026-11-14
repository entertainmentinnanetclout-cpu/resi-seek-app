# P1 Security Register, Part A — Accounts, Data and Browser Boundaries
**Stable IDs SEC-15–SEC-31.** No duplicate IDs from P0. TEST means unverified, not a confirmed vulnerability; PARTIAL means existing mitigations need negative testing.

| ID | Single deduplicated work item | Baseline | Required verification or fix |
| --- | --- | --- | --- |
| SEC-15 | **Login limits and credential-stuffing resistance** — login throttling, failed login lock, anti-bot | TEST; Supabase authentication rate configuration unverified | Per-origin and per-account adaptive limits, monitoring and denial-of-service-safe lockout |
| SEC-16 | **OTP and SMS pumping** — SMS quota, resend rate, verification attempts | TEST; phone verification exists | Per-number/IP/device quotas, OTP expiry, replay and cost-limit tests |
| SEC-17 | **Account pre-hijack and identity reconciliation** — duplicate accounts, registration verification, user enumeration at signup | TEST; 11 service cases lack account owner | Verified claim and merge; no matching by name alone; guard minor profiles |
| SEC-18 | **Password reset and recovery** — reset poisoning, reset expiry, reset throttling, enumeration | TEST; Supabase recovery used | Redirect allowlist, generic response, single-use short TTL, throttling, reauthentication |
| SEC-19 | **Sessions and JWT** — weak JWT secret, cookies, sessions after password change | TEST; auth managed by Supabase, app/native lifecycle unverified | Validate issuer/audience/algorithm, storage, rotation, revocation and logout tests |
| SEC-20 | **CSRF on cookie-authenticated state changes** — CSRF tokens, secure cookie flags | TEST; many APIs use bearer JWT not ambient cookies | Inventory cookie-auth endpoints; use SameSite/Origin/CSRF where appropriate |
| SEC-21 | **BOLA and IDOR record-level authorization** — ownership, landlord privacy, Student 360 | TEST; RLS exists but negative tests incomplete | All other-user document, case, reservation and profile reads and writes denied |
| SEC-22 | **Field tampering and mass assignment** — malicious changes to role, price and status | TEST; endpoints accept structured updates | Per-action update allowlist, server-authoritative role and expected-state checks |
| SEC-23 | **SQL injection protection** — parameterized queries, safe dynamic SQL | TEST; Supabase builder helps but database routines need review | Bound data, allowlisted identifiers, SQL audit and negative tests |
| SEC-24 | **XSS and HTML encoding** — escape user content, sanitize rich text and email previews | TEST; React escaping helps but HTML/markdown views need review | Safe rendering and stored-XSS tests, defense-in-depth CSP |
| SEC-25 | **Server-side input validation** — sanitization, request schemas, type/length enforcement | TEST; many intake types and channels | Reject bad types, oversized inputs, unknown fields and unauthorized actions |
| SEC-26 | **SSRF prevention** — outbound URLs, image and document proxies | TEST; remote-media and AI fetch exist | Host/IP/scheme and redirect validation; block local/internal fetch |
| SEC-27 | **Path traversal and unsafe directories** — path traversal, file serving and listing | TEST; storage downloads active | Normalized keys, path rejection, ownership before signed URLs |
| SEC-28 | **Open redirects and callback poisoning** — OAuth, recovery and post-login routes | TEST; multiple callback/domain paths | Trust only approved hosts and safe relative return paths |
| SEC-29 | **CORS scope** — overly broad origins and credential rules | PARTIAL; multiple Edge endpoints return wildcard origin | Public-vs-private endpoint review, restrict where required and test credentials |
| SEC-30 | **HTTPS/TLS/HSTS** — secure transport, forced HTTPS, certificates | PARTIAL; HSTS and canonical redirects in Vercel config | Inspect real responses and certificates on all domains, preload impact |
| SEC-31 | **CSP, security headers and clickjacking** — frame restrictions, nosniff, scripts | PARTIAL; existing CSP is limited to frame-ancestors | Report-only broader CSP, test external resources then enforce |

**Dedup:** SEC-18 owns all password-reset issues; SEC-19 the JWT and session family; SEC-20 CSRF; SEC-31 browser headers and clickjacking; SEC-21 object ownership; SEC-22 field/property tampering. Those are distinct trust boundaries, not separate duplicates.

**Exit process:** attach reproducible role-negative test results, deployment change, rollback plan and date before marking complete.
