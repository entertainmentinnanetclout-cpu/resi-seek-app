# SEC-04 / SEC-21 / SEC-25 — Public Privileged Read Boundaries
**15 November 2026 — ResKonnect Supabase project `mefjzkhobkltlbmhusdh`**

## Scope
Three intentionally anonymous-callable `SECURITY DEFINER` read RPCs were reviewed against their live PostgreSQL bodies and the consuming React source. They remain callable to support pre-login students, referrals and tours; the goal is privacy, safe request sizes and predictable access, **not** blanket revocation of public RPCs.

| Endpoint | Observed issue | Scoped mitigation |
| --- | --- | --- |
| `get_referral_public(text)` | Inactive recruiter code lookup could return a full name even when the referral was disabled; no bound on input text. | Preserve the three-column public response; reject excessively long lookup strings and return only active codes. Existing `getReferralPublic` already maps missing/inactive rows to null. |
| `virtual_tour_public_snapshot(uuid)` | A previously published token could continue returning a stored tour snapshot even if its linked residence was later hidden, because publication status was checked without re-checking the residence's current visibility. | Return an empty object for unpublished/expired/hidden residence tours; preserve standalone public workspaces with null `residence_id`. |
| `reskonnect_opportunity_feed(text,text,integer)` | An anonymous caller could submit unbounded query and opportunity-type text before a privileged full-text-style search. | Reject query strings greater than 256 bytes and type strings greater than 96 bytes with SQLSTATE `22023`; keep existing sorting, page limit 1–100 and result schema. |

### Baseline and impact
At inspection: zero published tours; zero inactive referral codes; five active referral codes; zero published public opportunities. The risks were confirmed from the callable implementation and queries, **not from a demonstrated production data breach**. We did not change student records, residence visibility, referral activation, placement outcomes or checkout amounts. Signed-in users keep their current personal course/campus relevance; pre-login users retain the feed and tour experience.

### Verification
- The migration is built from live `pg_get_functiondef` rather than diverging historical definitions; original signature/grants/return shapes are preserved.
- `scripts/sec04-public-read-privacy.test.mjs` is included in `backend:contracts` to prevent accidental regression.
- Live acceptance uses rolled-back `anon` calls to validate normal positive responses and boundaries. No production scan or malicious request flood is required.
- GitHub release workflows, package contracts and direct Postgres function source/grant checks must pass before merging.
- **Rollback:** Reapply the previous `pg_get_functiondef` bodies for only these three RPCs through a reviewed rollback migration. Do not disable RLS, revoke other public interfaces, or change existing student data.

### Auth throttling remains a separate control
Supabase Auth's hosted rate-limit and CAPTCHA provider settings cannot be inspected or modified by the connected database/functions/advisor tools. Under SEC-15/16/18, an operator should review the project's **Authentication → Rate Limits** and **Authentication → Bot and Abuse Protection** settings, monitor legitimate campus/shared-IP traffic, then configure sign-in/OTP/recovery anti-abuse protection. Enabling Cloudflare Turnstile or hCaptcha requires the provider site/secret pair **and corresponding frontend `captchaToken` flows for signup and password recovery before enabling server-side enforcement**. No CAPTCHA or Auth caps are claimed activated by this change. Supabase leaked-password screening was independently rechecked as enabled (Advisor warning absent).
