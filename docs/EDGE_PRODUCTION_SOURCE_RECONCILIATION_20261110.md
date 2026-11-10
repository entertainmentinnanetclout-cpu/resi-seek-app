# Production-only Edge Function source reconciliation (2026-11-10)

On 10 November 2026, 14 ACTIVE production Edge Functions without local entrypoints were read from project `mefjzkhobkltlbmhusdh` and copied **as-is** to source control. Each file's Git blob SHA is recorded in `scripts/edge-source-provenance.snapshot.json`, and `npm run backend:contracts` now checks exact bytes and `verify_jwt` settings. This is **not** an Edge deployment, schema migration or runtime canary.

| Existing deployed slug | Live version | verify_jwt |
|---|---:|---|
| `NoopCheck` | 3 | true |
| `adminos-twilio-diagnostics` | 8 | true |
| `adminos-twilio-one-shot` | 8 | true |
| `adminos-twilio-profile-once` | 5 | true |
| `adminos-twilio-replay` | 4 | true |
| `adminos-twilio-sync-once` | 4 | true |
| `create-payment` | 10 | true |
| `dimpho-eval-trigger-once` | 5 | false |
| `mobile-runtime-report` | 2 | true |
| `quick-service` | 12 | true |
| `seo-indexnow` | 7 | true |
| `seo-indexnow-processor` | 8 | true |
| `seo-indexnow-worker` | 3 | false |
| `seo-search-console-sync` | 4 | false |

## Limitations and hold points

- Production code remains unchanged. No student accounts, reservations, money, cron jobs, OAuth configuration, policies or secrets were modified.
- `meta-residence-feed` has its own open [PR #155](https://github.com/entertainmentinnanetclout-cpu/resi-seek-app/pull/155); avoid introducing duplicate source in parallel. Compare that PR with the **current** deployed Meta feed before merging.
- The 13 other **substantive** Edge source differences remain in [issue #198](https://github.com/entertainmentinnanetclout-cpu/resi-seek-app/issues/198). A locally archived function may still have authorization or reliability weaknesses; source archival is not a security approval.
- The deployed slug `quick-service` has a display name of `yoco-checkout`. Only the **slug** is a callable endpoint identifier. The separate `yoco-checkout` source-only entrypoint is not deployed.
- `create-payment` and `seo-indexnow-processor` can perform privileged work; review caller restrictions, idempotency and rate limits before redeployment. Keep `yoco-webhook` JWT-protected until Yoco provider-signature, replay prevention and sandbox validation are complete.
- No bulk `supabase functions deploy` may be run against production while substantive drift remains. Do function-by-function code and configuration review first.
- The saved Git hashes protect against accidental future edits to these archived source files. They do **not** monitor subsequent out-of-band Supabase changes or guarantee live Auth, RLS, Google, payments, mail, reservations or cron execution. Those require explicit authorized end-to-end tests.

Baseline frontend production SHA: `7b0ef443d101ad35e8b9fbf9eced28343b86c8b4`.
