# Single-room waiting list • live restoration and admin visibility (24 November 2026)

## Verified live evidence

- ResKonnect Supabase project `mefjzkhobkltlbmhusdh` already has `public.single_room_waitlist`; all **33** records for 2027 are present. Breakdown: **31 waiting for the full academic year**, **2 searching for first semester**. All 33 have `room_type='single'`.
- **20 of 33** have no preferred residence. The queue is accommodation-independent, not a subfilter on `admin_applications_safe`.
- Zero rows are currently assigned a `matched_residence_id`. Do not invent matches or merge waiting requests into accepted placements.
- The public landing `student-care` section is **visible=true** in `rk_visual_page_sections`. Landing renders `StudentCareLinks`, and the public route `/single-room-waiting-list` is mapped to the `StudentCare` form. The form uses the existing `rk_join_single_room_waitlist` UPSERT and separate `rk_withdraw_single_room` RPC; this PR does not migrate, delete or mutate any historical record.
- Existing database RLS is **not** public: ordinary students can read only their own records; staff may manage the private queue only when `adminos_is_staff()` is true. That function requires staff role **and AAL2 MFA** (or backend service-role). We do not bypass MFA.

## Why it looked missing

1. Normal Admin Applications loads residence-specific `admin_applications_safe`. Single-room requests are intentionally held in a distinct waiting-list table, so the ordinary applications table has no entries for them.
2. The legacy `/admin/student-care` page defaults to **Residence feedback**, not Single rooms. God Mode previously hid its sidebar link.
3. Legacy Student Care loaded seven unrelated data sources with one `Promise.all`: a failed feedback campaign/partner/profiles query could hide the 33 waiting-list requests.
4. Student `/single-room-waiting-list` also previously fetched feedback campaigns before its private waiting-list data; a feedback outage could mask saved requests.

## Fix

- A dedicated `SingleRoomWaitlistQueue` loads only `single_room_waitlist` after verifying the existing `adminos_is_staff` authorization, with a clear error when AAL2 is missing (never an unexplained zero).
- New staff-only `/admin/single-room-waiting-list` route with AdminLayout and existing ProtectedRoute/AdminRoute. Exposed to God Mode and departmental staff navigation.
- Same queue appears as **Single-room waiting list** under **Accommodation → Applications & Reservations → Single-room waiting list**, and can be opened from the normal Applications header. The old Student Care's Single rooms tab reuses it.
- Sort by date; all-year, semester, name/campus/phone, and status filters; summary counts; student-facing staff responses, statuses and individual Student 360 links. Restricted CSV export deliberately contains personal information; only authorized staff should store it securely. A matched/placed transition requires explicit human confirmation of a genuine single occupancy room.
- The public form now reads **only** the waiting-list table plus optional own profile; a feedback campaign error cannot mask the saved list. Preferred residence is optional, and student landing plus native dashboard clearly say any suitable residence.
- No new database table, permissions, roles, auto-approvals, placements, mass status writes, external emails or WhatsApp messages. Records remain linked to their original students.

## QA

`node scripts/single-room-waitlist-visibility.test.mjs` checks each public and privileged route, independent loading, RLS/AAL2 and publication of existing records. Included in `npm run backend:contracts` for every release.

**User-facing entry:** `https://www.reskonnect.org/single-room-waiting-list`

**Admin direct entry:** `https://www.reskonnect.org/admin/single-room-waiting-list`

**Accommodation workspace:** `https://www.reskonnect.org/admin/accommodation?tab=applications-reservations&view=single-rooms`
