# SEC-15/16 — Auth CAPTCHA and Abuse-Protection Preparation
**15 November 2026 | ResKonnect project `mefjzkhobkltlbmhusdh`**

## Threat and scope
Supabase Auth has native built-in rate limiting and optional Cloudflare Turnstile/hCaptcha enforcement. Direct Supabase Auth calls do not pass through Vercel WAF. Project-specific current hosted Auth rate limits, bot protection state and provider secret **cannot be read or modified with the connected Supabase database/functions tools**. This release adds **functional frontend Turnstile integration**, not a claim of activated backend CAPTCHA.

### Seven password-based call paths
| Portal | Login | Signup | Request password reset |
| --- | --- | --- | --- |
| Student `/auth` | Token | Token | Token |
| Recruiter `/recruit/auth` | Token | Token | Token |
| Landlord `/residence/login` | Token | — | Token |
| Password recovery `PasswordReset` | — | — | Token |

All seven paths pass the single-use challenge proof in the correct Supabase Auth option location: `signInWithPassword({...,options:{captchaToken}})`, `signUp({...,options:{captchaToken}})`, or `resetPasswordForEmail(email,{...,captchaToken})`. Failure/expiry/timeouts invalidate the proof and the widget is remounted after each attempt. Social OAuth remains untouched.

### Activation sequence — do not reverse
1. Obtain **Cloudflare Turnstile widget** for every active ResKonnect website domain; include staging and local development test domains as needed.
2. Set **only the public Site Key** as `VITE_TURNSTILE_SITE_KEY` in the Vercel project environment; commit **no keys** to GitHub. Never use `VITE_` for the secret key. Build deploys the frontend widget; without this public key the integration stays inactive and the current login flow remains usable.
3. Confirm browsers including the native Android WebView can load `https://challenges.cloudflare.com/turnstile/v0/api.js`, solve verification, and pass token to Supabase Auth on all four pages. Verify reattempts, expired tokens, slow mobile network and reset links.
4. In Supabase Dashboard → **Authentication → Bot and Abuse Protection**, select **Cloudflare Turnstile**, enter the **Secret Key** directly there and enable CAPTCHA. Do this **only after** verifying the new frontend has deployed across all active entry points, including fallback URLs, because older clients without `captchaToken` may otherwise stop authenticating. No secret should be sent to ChatGPT or committed.
5. In Supabase Dashboard → **Authentication → Rate Limits**, review OTP, email, SMS, password reset, verification, refresh and anonymous-signup ceilings. Avoid very strict shared-IP limits (student residences, campus Wi-Fi, mobile NAT). Adjust only with real traffic evidence and approved targets. No hosted rate limits are changed by this release.

### Runtime implementation
- `src/components/auth/AuthBotChallenge.tsx` loads Turnstile's official script only when a site key is configured; no added NPM dependency; no silent bypass when configured. It displays clear connection failure feedback and removes the widget on unmount.
- A shared `requireAuthCaptchaToken` helper ensures every password-based Auth call fails locally rather than sending tokenless requests when the frontend is configured.
- Challenge is not a guarantee of human identity or an alternative to Supabase server-side protection. Guest discovery, Google OAuth and private document flows remain unchanged.

### Verification / limitations
- `scripts/sec15-sec16-auth-captcha.test.mjs` is a mandatory `auth:check` gate for all seven source API call sites, failure and expiry handling, reset and no-key compatibility.
- CI compilation, web/Android tests and deployment checks required before merge.
- Live CAPTCHA Solves and Auth rate-limit HTTP tests are not possible until a valid provider test site key and server enforcement are configured.
- Continue existing leaked-password protection (Security Advisor no warning). Do not claim active Turnstile enforcement by merely merging these changes.
- Rollback: remove `VITE_TURNSTILE_SITE_KEY` from frontend environments and redeploy the previously tested build. If backend CAPTCHA had already been activated, the operator must coordinate restoring compatible clients rather than silently turning off anti-bot enforcement.
