# ResKonnect: frontend / Supabase production-contract audit

**Date:** 2026-11-10. **Source:** GitHub `main` at initial inspection `c1f58e83dc214c687c33c34d3843663b65532241`. **Backend:** `mefjzkhobkltlbmhusdh` (ACTIVE_HEALTHY at inspection). **Vercel:** production SHA matches GitHub.

## Verified deployment-drift inventory
- 51 Edge Function entrypoints in GitHub, 63 active Edge Function slugs in Supabase.
- Source-only functions: `og-image`, `update-application-status`, `yoco-checkout`. Do not automatically deploy the latter two without checking whether they are still used and reviewing payment/role authorization.
- 15 production-only slugs: `NoopCheck`, `adminos-twilio-diagnostics`, `adminos-twilio-one-shot`, `adminos-twilio-profile-once`, `adminos-twilio-replay`, `adminos-twilio-sync-once`, `create-payment`, `dimpho-eval-trigger-once`, `meta-residence-feed`, `mobile-runtime-report`, `quick-service`, `seo-indexnow`, `seo-indexnow-processor`, `seo-indexnow-worker`, `seo-search-console-sync`. These may be legacy/operations functions: trace usage, source-control original code and security before decommissioning.
- 48 common Edge entrypoints were independently compared with their **currently deployed** index.ts content. 30 matched byte-for-byte; **18 differed**. `create-residence-portal-user`, `generate-booking-slip`, `download-handover-pack`, several AdminOS workers and payments/AI functions are among the differences. Do **not** bulk redeploy local sources or overwrite deployed hotfixes. Review the differences function-by-function and make explicit reconciliation PRs.

## Confirmed flow-level misrouting
- `src/integrations/supabase/client.ts` points Auth, PostgREST, Storage and direct `supabase.functions.invoke` to the external production project.
- Legacy `src/lib/lovableFunctions.ts` instead forwarded the same external user JWT to a **different Lovable Supabase project** (`vmqqkebojldjsyxcewdb`). This helper was still used for booking-slip HTML generation in `src/pages/Applications.tsx`.
- The required `generate-booking-slip` function is active on the external Supabase project; its deployed code accepts `application_id` and checks the authenticated user/application ownership. The helper was corrected to use the same external gateway/key and existing session token.
- Public social share helpers call `/functions/v1/og-image`, which was not deployed at inspection. Public-only rendering is eligible for a carefully reviewed `verify_jwt=false` deployment because unfederated social crawlers cannot supply Supabase JWTs. Avoid claims of official verification without evidence.

## Critical payment integrity warning
- The active `yoco-webhook` function has `verify_jwt=true`. Its live source **does not verify a Yoco HMAC signature**. Never simply disable JWT verification: it could permit fraudulent paid-order updates. Before reactivating external Yoco callbacks, implement provider-specific signature verification, replay resistance, idempotency and a controlled sandbox test.
- `yoco-checkout` is source-only. It must not be deployed blindly; review current EFT/Yoco user flow and credentials, if applicable.

## Type generation / database metadata drift
- Current live public schema: **409 tables + 36 views**. Original `src/integrations/supabase/types.ts` contains **60 tables + 2 views**. Live type generation contains 296 public functions; the legacy snapshot declares 10. `types.production.generated.ts` is an August 2026 overlay, **not** the full current public schema.
- These differences mean the existing TypeScript build is not proof of database contract correctness, particularly where `as any` suppresses compiler checks.
- Do not commit service keys or schema contents containing customer rows. The checked-in `scripts/backend-live-contracts.snapshot.json` contains **names, callable argument names, status and storage bucket IDs only**, no user data or secret values.
- The production snapshot is point-in-time and must be re-captured after every migration and Edge deployment; PR checks detect changes to consumers relative to the last captured snapshot. They cannot automatically detect an out-of-band production change without an authorized Supabase management connection.
- Periodically regenerate full Supabase TypeScript types into a separate reviewed branch, then migrate code off `any` incrementally with TypeScript and browser checks. Do not replace a 60-table type file with a 409-table definition in an untested one-shot production release.

## Security and operational release gates
- `scripts/backend-contract-audit.mjs` parses every real `.ts/.tsx/.js/.jsx` source file in `src` and Edge Functions using the TypeScript AST. It compares literal relation/RPC/Edge/bucket names, candidate RPC argument keys, runtime JWT flags and source-function inventory against the verified production snapshot.
- The `backend:contracts` gate is invoked by the normal build and the GitHub Actions audit. Dynamic caller names, conditional SQL trigger bodies, authenticated RLS, webhook verification, secrets, provider status, runtime errors and real user journeys require separate tests.
- Preserve all existing users, bookings, RLS and security checks. No automated deployment of security-sensitive Edge Functions; no blind migration or destructive data maintenance.
- Relevant operational incidents: Auth #191, retention/capacity #195, 2027 reservation case-trigger fix PR #196.

## Reconciliation follow-up, 2026-11-10

- PR #197 was merged (GitHub/Vercel production commit `f15daa085ec18248386ea1081340f344df1ec529`; Vercel READY).
- The safe public `og-image` Edge deployment was verified with HTTP 200 and exact source comparison.
- A full second comparison of 18 formerly divergent shared Edge entrypoints separated **4 whitespace-only differences** from **14 containing substantive code differences**. Do not auto-deploy either side.
- In PR #199, `generate-booking-slip/index.ts` was reconciled **from the running production v2.0.1 source back into GitHub**, after confirming JWT authentication, application ownership checks and no embedded credentials. **No Edge function was redeployed** as part of this reconciliation.
- This reduces unresolved substantive differences from 14 to **13**, subject to a final comparison after merging PR #199. Tracked in issue #198.
- PR #199 further pins dynamic booking/viewing/course-match RPC signatures, authenticated email/portal endpoints, and payment webhook JWT guard in CI, plus a safe VAPID public-key smoke.
- A fresh one-hour Auth sample showed one HTTP 500: do not claim complete sign-in reliability; continue issue #191 diagnostics.
