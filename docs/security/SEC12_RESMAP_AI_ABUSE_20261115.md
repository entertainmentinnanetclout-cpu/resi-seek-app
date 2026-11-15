# SEC-12 / SEC-36 — Direct Supabase ResMap AI Abuse Protection
**15 November 2026 — ResKonnect, Supabase project `mefjzkhobkltlbmhusdh`**

## Identified weakness
- `resmap-spatial` (direct public Edge URL) previously checked an IP-derived daily usage row then updated it separately. Concurrent requests can pass the read before writing. Forwarded IP headers are not a verified identity guarantee.
- `resmap-visual-search` (direct public Edge URL) previously used client-supplied `visitor_hash` for guest daily usage and checked it through a non-atomic SELECT/count. Rotating guest IDs or concurrent requests can bypass intended per-actor costs.
- Both endpoints use `SUPABASE_SERVICE_ROLE_KEY` internally and call paid AI providers. Vercel WAF does **not** protect their public Supabase URLs.

## Mitigation
The private, RLS-enabled, 48-hour-pruned `reskonnect_internal.rk_public_rpc_budgets` table is reused by a new `public.rk_consume_ai_budget` RPC. The function is EXECUTE-granted **only to service_role**, verifies the server role, hashes the quota identity, and atomically reserves minute/hour/day per-subject slots plus independent **global minute/hour circuit breakers** before either Edge handler invokes OpenAI. Failed reservations return PostgreSQL `PT429` and surface HTTP 429. Database failures fail closed with 503 for visual search and 503 for map intent. No application, student, document, reservation, or payment table is modified.

| Surface | Actor minute/hour/day | Whole-platform minute/hour |
| --- | --- | --- |
| Visual search | 2 / 8 / 3 guest, 10 authenticated daily | 10 / 60 |
| Map AI intent | 8 / 40 / 20 | 60 / 360 |

These are protective initial ceilings, not guarantees against DDoS or a published service-level commitment. Shared campus IPs, anonymous clients that can rotate browser IDs, and sudden viral demand can affect usage. The *global* spend breaker prevents unlimited AI calls from ID rotation but may intentionally throttle genuine visitors during abuse. Support adjusts values in a reviewed SQL migration based on observed throughput. Per-subject counters are privacy-preserving MD5 labels **for deduplication, not cryptographic authentication**. The original map `resmap_ai_usage` table and visual analytics continue to be maintained; the new atomic budget is authoritative for cost protection.

## Deployment and tests
- Versioned SQL: `supabase/migrations/20261115075500_sec12_resmap_atomic_ai_budgets.sql`. Safe to apply to current production: creates a single scoped function and grants; no existing signature or table/rows changed.
- Re-deploy existing `resmap-spatial` and `resmap-visual-search` with `verify_jwt=false` preserved for guest accommodation discovery; all existing actions and response contracts remain.
- CI: `scripts/sec12-resmap-atomic-budget.test.mjs` is required by `backend:contracts`.
- Live acceptance: PostgreSQL catalog must prove anon/authenticated EXECUTE denied and service_role allowed; rolled-back test request as service_role must reserve five counters; invalid/unauthorized calls must reject. Compare live Edge version and function source; ensure valid route/search traffic and one normal AI request before calling full production acceptance.
- Rollback: redeploy the two previous Edge versions if the budget RPC introduces availability issues. Do not expose the RPC to browser roles to work around outages. Database function may remain dormant; deleting it is optional only after all callers are reverted. Do not clear customer analytics or student accounts.
- The built-in Supabase Auth rate limits are separate from this mitigation. Project-specific settings must be reviewed at `Authentication → Rate Limits`; the connected app cannot change Auth rate-limit settings. Cloudflare Turnstile would require site and secret keys plus an accessibility-reviewed integration before enablement.

## Scope caveats
This fixes a **specific atomic-cost-budget bypass** for two ResMap AI endpoints. It is not general API ingress protection, a full assessment of the remaining 24 public privileged RPCs/206 signed-in privileged RPCs, or an independent penetration test. Worker webhooks and signed callbacks need their own signature and replay reviews.
