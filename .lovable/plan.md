## Why

External Supabase is returning `402 exceed_cached_egress_quota` on `/rest` and (per your report) Storage. The `documents` bucket is private, but the app calls `createSignedUrl` on every render / preview click. Signed URLs are unique strings, so each call is a fresh cache miss and burns egress. Fix = generate once per `(bucket, path)` and reuse until near-expiry.

Scope: **frontend only**, in-memory React Query cache. No SQL, no bucket flips (must stay private for PII).

## Changes

### 1. New shared hook + helper — `src/lib/storage/signedUrl.ts`
- `getSignedUrl(bucket, path, ttl=900)` — module-level `Map<string, {url, expiresAt, promise}>` cache keyed by `${bucket}::${path}`.
  - Returns cached URL if `expiresAt - now > 60s`.
  - Coalesces in-flight requests (returns the same `promise` for concurrent callers) so a mounting list of 20 docs = 20 requests, not 400.
  - Logs `[signed-url] mint <path>` once per mint in dev only.
- `useSignedUrl(bucket, path, ttl?)` — thin React Query wrapper: `queryKey: ['signed-url', bucket, path]`, `staleTime: (ttl-60)*1000`, `gcTime: ttl*1000`, `enabled: !!path`. Calls `getSignedUrl` under the hood so both hook + imperative callers share the same cache.

### 2. `src/components/DocumentsList.tsx`
- Replace ad-hoc `createSignedUrl` in `handlePreview` with `getSignedUrl('documents', doc.file_path)`.
- Debounce preview/download button handlers (guard with a `busyId` ref) so double-clicks can't fire two mints.
- Keep `handleDownload` using `.download()` (that returns a Blob, not a URL — no egress cache benefit from signing, but add the same double-click guard).

### 3. Sweep other private-bucket signed-URL call sites
Search + migrate to `getSignedUrl`:
- `src/components/admin/HandoverExportPanel.tsx`
- `src/pages/admin/AdminDocuments.tsx`
- `src/pages/admin/AdminLandlordApplications.tsx`
- `src/pages/admin/AdminSellerApprovals.tsx` (seller-kyc)
- `src/pages/admin/AdminApplications.tsx` / application-documents viewers
- `src/pages/MyWIL.tsx` / `AdminWIL.tsx` (wil-documents)
- Any `payment-proofs` / `landlord-documents` previewers

Rule: **any `createSignedUrl` call that runs inside render, an effect without a stable dep, or a click handler that can repeat → route through `getSignedUrl`.**

### 4. Iframe/img re-mount guard
In every preview `<Dialog>` that renders `<iframe src={previewUrl}>`:
- Only render the iframe when `previewUrl` is truthy AND the dialog is open (already true in `DocumentsList`, verify elsewhere).
- Add `key={previewUrl}` so React reuses the node instead of re-mounting on unrelated state changes.

### 5. Stop background REST refetching (the 402s in your logs are REST, not just Storage)
- Add sane defaults in `src/main.tsx` QueryClient: `refetchOnWindowFocus: false`, `refetchOnReconnect: false`, `staleTime: 60_000`. This is the single biggest cached-egress win because trusted-residences and hero-slides currently refetch on every tab focus.

## What I will NOT do

- Won't make `documents` public (PII).
- Won't add the `storage_signed_url_cache` SQL table — the user picked in-memory only, and a DB cache doesn't help browser egress anyway.
- Won't touch `src/integrations/supabase/client.ts` or edge functions (mixed origin is fine; each side caches its own).
- Won't change bucket URLs to `<ref>.storage.supabase.co` — same egress meter, no benefit, and it would break the existing auth header flow.

## Acceptance

- Opening the Documents page and previewing the same doc 5× results in **1** `POST …/object/sign/documents/*` call (verified via Network tab).
- Switching browser tabs and coming back does **not** refire residence/slide REST queries.
- Preview + download still work end-to-end.

## Out of scope

- Quota top-up on External Supabase (that's a billing action only you can take; the code fix reduces future burn but won't lift today's 402 until the cache resets or the plan is upgraded).
- Any admin/TVET/referral feature work.
