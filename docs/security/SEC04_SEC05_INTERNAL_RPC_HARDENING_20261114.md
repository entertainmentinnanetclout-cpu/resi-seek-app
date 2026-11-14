# SEC-04 / SEC-05 — Internal RPC and privileged-function boundaries
**ResKonnect production Supabase** — 14 November 2026.

## Threat and remediation
A `SECURITY DEFINER` RPC runs with its owner's database privileges, potentially crossing caller RLS. Having a signed-in user token is not enough to authorize automation that processes arbitrary customer conversations, writes customer-feedback records, generates company operating briefs or retrieves AI knowledge. Supabase's Data API relies on both explicit GRANT and RLS; function calls must be guarded independently.

### 12 previously signed-in-callable functions now service-role-only
- AdminOS scheduled processing: `adminos_generate_executive_brief`, `adminos_generate_proactive_notifications`, `adminos_refresh_next_best_actions`, `adminos_refresh_service_metrics`, `adminos_refresh_service_recovery`.
- Customer conversation / agent writes: `adminos_record_agent_feedback`, `adminos_record_csat`, `adminos_record_learning_gap`, `adminos_set_contact_language`, `adminos_touch_whatsapp_conversion`.
- AI internal data: `dimpho_compile_persona`, `dimpho_search_knowledge`.

Each signature has `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` and an explicit `GRANT EXECUTE ... TO service_role`. These are service/callback/cron operations rather than browser RPCs. The frontend source was checked for direct `supabase.rpc` calls to these methods; the existing WhatsApp and agent Edge functions use service credentials, and the five known scheduled tasks run as `postgres`. Their signatures and schema remain unchanged.

### Three browser-callable operations now have execution-time checks
- `dimpho_intelligence_overview()`: the existing admin dashboard can continue to call the same RPC, but the body now checks `public.adminos_is_staff()`, whose implementation requires a real staff role plus AAL2 MFA for user sessions.
- `validate_handover_pack(uuid)`: now checks the same staff MFA gate before deriving sensitive student handover integrity details. The requester's browser cannot simply supply any residence UUID.
- `virtual_tour_publish_readiness(uuid)`: remains callable by the existing tour Studio after `public.virtual_tour_can_manage_tour(p_tour_id)` proves scope, or directly by a trusted service-role session. Browser users cannot interrogate another owner's unpublished tour.

## Live verification
- **Signed-in-executable `SECURITY DEFINER` functions: 218 → 206.** This is twelve specific removed grants, not a claim that every remaining function is unsafe.
- **Anonymous-executable `SECURITY DEFINER` functions remain 24.** Deliberately public accommodation/marketing/query functions must retain their intended behavior until individually reviewed and rate limited as necessary.
- Actual SQL role impersonation proved an unauthorised signed-in session cannot execute any of the three sensitive data operations (denied with 42501).
- A real admin user under an AAL2 test context successfully executed the existing Dimpho overview and received a JSON result; a valid standalone virtual tour owner was able to execute the readiness RPC.
- Cron jobs for operating brief, next-best actions, proactive WhatsApp, service metrics and service recovery remain active under `postgres`. Most recent recorded runs in the inspection were successful, but this alone is not complete end-to-end verification of every outgoing communication.
- No production user, conversation, payment, reservation, enrolment or document rows were intentionally changed in the authorization tests.
- Re-ran the Supabase Security Advisor: no security-definer-view errors; unresolved warnings include 24 anonymous and 206 authenticated executable security-definer functions, `pg_net` extension location, and leaked-password protection disabled. Informational RLS/no-policy entries may be intentionally service-only.

## Deployment and CI
The applied migration is versioned as `supabase/migrations/20261114230000_sec04_sec05_internal_rpc_boundaries.sql`. The connector's applied version metadata may differ from the checked-in migration filename; reconcile before future CLI deployment. This migration is compatible with the existing four source-protected payment Edge functions and Student 360/RLS changes.

A build regression in `scripts/sec04-sec05-internal-rpc.test.mjs`:
1. Asserts all 12 signatures explicitly block `PUBLIC`, `anon` and `authenticated` but grant `service_role`;
2. Verifies AdminOS and handover MFA guards and tour ownership guard;
3. Checks the existing frontend uses the unchanged admin/tour RPC names;
4. Scans browser `.rpc(\"...\")` calls for accidentally restricted service-only functions;
5. Reconciles the signed-in callable RPC inventory with the live Supabase snapshot.

This test is required by `backend:contracts`, in addition to the existing web, Android, Edge, AdminOS, SEO and dependency-security release workflows.

## Remaining work
**SEC-04 and SEC-05 are in progress, not closed.** Every remaining privileged function must be classified into protected public display / owner-only / staff MFA / trusted service categories, with per-object RLS, data minimization, input-size controls, rate limits, authorization negative tests and consumer evidence. Avoid blanket revocations on the 24 public interfaces, as that may disable referrals, roommate services, search, verified residence reviews and market intelligence.

Separate open controls: breached-password protection in Supabase Auth, public Storage bucket MIME/size constraints and service account / secret rotations. The positive results in this release are database guard checks, not an independent penetration test or a live user-end-to-end session audit.

Source: [Supabase Data API grants and RLS](https://supabase.com/docs/guides/api/securing-your-api).
