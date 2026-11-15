# SEC-04 — Public Referral, Attribution and Telemetry Abuse Controls
**ResKonnect — 15 November 2026.** Applied directly to the connected Supabase project and versioned in GitHub. This is a targeted abuse/integrity release, not an independent penetration test.

## Scope and purpose
Keep first-time guest browsing, student acquisition, recruiter link redirects, Luna demand analytics, mobile runtime diagnostics and virtual tour tracking functional. They intentionally accept public calls; revoking anonymous EXECUTE would silently break the journey before login. Instead, enforce bounded work and protect existing session ownership inside the PostgreSQL functions.

Existing signatures, return types, client RPC names and RLS business scopes remain unchanged.

### Applied budget controls
| Public surface | Per actor / browser token | Coarse global ceiling (per hour) | Coverage |
| --- | --- | --- | --- |
| Referral click | 15/min; 100/hour | 5,000 | Input sizes, referral-code lookup and session creation |
| Recruiter redirect | 30/min; 300/hour | 10,000 | **Before** even an unknown link key is looked up; successful links also use referral-click budget |
| Luna attribution | 20/min; 120/hour | 25,000 | Limit visitor/session/UTM inputs and require same visitor and signed-in account before updating an existing session |
| Luna demand event | 60/min; 500/hour | 25,000 | 8 KiB max JSON, allowlisted event types, safe bounded arrays/fields, no foreign-session owner claim |
| Virtual tour telemetry | 60/min; 600/hour | 20,000 | 4 KiB max JSON, valid published tour, referenced scene belongs to same tour |
| Mobile runtime telemetry | Authenticated: 30/min; 300/hour; anonymous fallback: 2,000/min; 20,000/hour | 30,000 | Existing diagnostic event allowlist and 4 KiB metadata limit remain; anonymous crash diagnostics still work |

These are **transactional PostgreSQL budgets**, not network IP limits. For a logged-in person, `auth.uid()` is the quota identity; for anonymous traffic, the browser-provided visitor/session token is used as a *heuristic only*. Attackers can rotate those tokens. Global ceilings are deliberately much higher than measured demand, but a malicious actor can still consume them and affect legitimate anonymous telemetry. True IP-/ASN-/device- or bot-based protection requires a trusted reverse proxy/WAF or Edge gateway and verification that forwarded client identity is not spoofable.

Budget accounting uses a private-schema, RLS-enabled, non-browser-readable `reskonnect_internal.rk_public_rpc_budgets` table with concurrent-safe `INSERT .. ON CONFLICT .. UPDATE WHERE used < limit` counters. Exceeded budgets return HTTP-compatible SQLSTATE `PT429`. A named pg_cron job prunes only budget counter rows older than 48 hours. No tracking or customer data is removed by that job.

### Attribution ownership integrity
The former `luna_capture_attribution` upsert accepted an arbitrary session ID and updated `user_id` and marketing fields on conflict. This release permits updates only when the original `visitor_hash` matches and the existing `user_id` is either empty (guest session) or the current user. A signed-in caller cannot claim a **different signed-in user's** attribution or rewrite their first-touch fields through a guessed/known session ID.

The `luna_log_demand_event` follow-on attribution update additionally checks both `session_id`, matching `visitor_hash` and compatible authenticated `user_id`. It can still create a separate demand signal for the caller, but cannot silently relink another student's session. A browser visitor hash is not cryptographic proof of ownership of an unclaimed anonymous session; stronger guest-claim binding needs a trusted signed session token.

### Tested against live Supabase
The migration was applied in three steps: `20261115072500_sec04_public_rpc_budgets_and_guard.sql`, `20261115073000_sec04_referral_attribution_telemetry_bounded.sql`, `20261115074500_sec04_recruiter_redirect_budget_guard.sql`.

All following tests ran in **rolled-back** SQL transactions:
- An anonymous visitor can create a valid Luna attribution session; the **21st** request in a one-minute window receives a rate-limit rejection.
- Oversized 8 KiB+ Luna demand JSON is rejected before inserting a demand event.
- A signed-in second user cannot claim or alter the account/UTM/path of another signed-in user's attribution session.
- Anonymous referral capture using an active code returns a session; anonymous mobile `boot` diagnostics still function.
- Unpublished virtual tours do not create tracking events; oversized tour JSON is rejected.
- The **31st** invalid recruiter link request per minute is rejected before another database lookup.
- Budget tables have RLS and no anonymous or signed-in SELECT/INSERT grants; the cleanup cron is active.
- Pre-change volumes: 5,932 attribution sessions; 29,436 demand events with 634 in the preceding 24 hours, historical hourly peak 467; 0 referral sessions, 0 tour events and 0 mobile events.

No test permanently created attribution sessions, referrals, virtual tours, diagnostic events, messages or customer records. No payments or accommodation approvals were affected.

## Release safeguards and remaining work
The Node source guard `scripts/sec04-public-attribution-security.test.mjs` is included in mandatory `backend:contracts`, alongside the existing 78-task deduplicated security register and other service continuity checks. Security changes to the database are already live; source merge records them and is not an authorization to replay applied migrations blindly. Connected Supabase migration tool applies its own version metadata; reconcile before any CLI deployment.

**Not yet claimed:** IP-level bot protection, WAF limits, automated DDoS protection, full authenticated browser penetration testing, complete public-function audit, verified legitimate published-tour event analytics (no published tour existed during this audit), or leak-password protection. Further high-priority reviews should cover public read-only RPC data exposure, document storage upload policies, session and account recovery, and provider edge rate limiting. Don't equate a successful quota test with proof against distributed attacks.
