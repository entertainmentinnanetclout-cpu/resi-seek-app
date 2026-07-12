## Problem

`ResidenceDetail` is mounted on two routes:
- `/res/:id` (used by TrustedResidencesGrid, ResidenceSectionGrid) — passes a UUID
- `/find-my-res/:slug` (used by FindMyRes cards) — passes a slug (or UUID fallback)

But the component only reads `useParams<{ id }>()` and queries `residences.eq('id', id)`. On the `:slug` route, `id` is `undefined`, so:
- `fetchResidence` early-returns and `loading` stays true → the page just spins forever.
- It only "works sometimes" from Find My Res because when a residence has no `slug` column, the card falls back to `residence.id` (a UUID), which coincidentally matches the `id` route param name… actually it still fails because the param key is `slug`. The Top-30 block works because it uses the `/res/:id` route directly.

## Fix

Update `src/pages/ResidenceDetail.tsx` so it works regardless of which route mounted it:

1. Read both params: `const { id, slug } = useParams<{ id?: string; slug?: string }>();` and use `const key = id || slug`.
2. Look up the residence by trying slug first, then id (UUID-safe):
   - If value looks like a UUID → query `.eq('id', key)`.
   - Otherwise → query `.eq('slug', key)`, and if that returns nothing, fall back to `.eq('id', key)`.
3. Once loaded, use `residence.id` (not the URL param) everywhere downstream: `checkExistingApplication`, `related` query, apply handler's `residence_id`, and the `navigate("/auth?returnTo=...")` return path (use current `location.pathname` so users come back to the same URL they were on).
4. Keep `loading` state honest — always set `loading=false` in `finally`, even when `key` is missing, and show a "Residence not found" state when the lookup returns no row (instead of an infinite spinner).

No other files need to change — the route table, cards, and grids stay as they are.

## Technical notes

- UUID check: simple regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
- Use `.maybeSingle()` (not `.single()`) for the lookup so a missing slug doesn't throw and trip the toast.
- No DB migration needed; `residences.slug` already exists and is what FindMyRes cards emit.

## Out of scope

- Redesigning the detail page or cards.
- Backfilling missing slugs (separate concern; the id fallback covers it).
- Any TVET / referral / admin changes from earlier turns.