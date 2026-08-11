# Login "Failed to fetch" on www.reskonnect.org

## What I verified (live, just now)

- **The backend is healthy.** `auth/v1/settings` on the External backend returns `200`, and it explicitly returns `access-control-allow-origin: https://www.reskonnect.org` — so CORS and the auth service are fine.
- **The domain itself is the problem.** `https://www.reskonnect.org/` returns **HTTP 429** with `server: Vercel`, `x-vercel-mitigated: challenge` and a "Vercel Security Checkpoint" page. That is **Attack Challenge Mode / bot mitigation** on the Vercel project.
- **The apex `https://reskonnect.org/` does not respond at all** (connection failure), so a non-www visitor gets nothing.
- No Content-Security-Policy exists in the app, and the service worker has no fetch handler, so neither is blocking requests.

"Failed to fetch" is what the browser reports when the login request never completes — consistent with the challenge layer intercepting requests / the page being served from a challenged, partially-loaded state.

## Fix (hosting, not code)

1. In the Vercel project → Firewall/Security → turn **Attack Challenge Mode OFF** (and check no custom firewall rule is challenging all traffic).
2. Point the **apex `reskonnect.org`** at Vercel and set a 301 redirect apex → `www.reskonnect.org`, so both hosts work.
3. Re-test: `https://www.reskonnect.org/` must return `200`, then sign in again.

## Optional code hardening (only if you want it)

- **Clearer auth errors** in `src/pages/Auth.tsx` and `src/pages/residence/ResidenceLogin.tsx`: map a `TypeError: Failed to fetch` to a friendly message ("Can't reach ResKonnect servers — check your connection or try again shortly") instead of the raw browser string.
- **Startup connectivity check**: a small ping to the backend health endpoint on the auth page so users see a banner rather than a silent failure.

## Not touched
No backend migrations, no RLS, no Edge Functions, no secrets, no deployment.

## Next step
Confirm whether you want me to (a) stop here since the fix is in Vercel settings, or (b) also ship the friendly error handling.
