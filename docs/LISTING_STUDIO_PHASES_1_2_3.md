# ResKonnect Phases 1–3: Connected listing, landlord studio and accommodation discovery

Release scope: Phase 1 shared residence/inventory foundation; Phase 2 guided landlord studio; Phase 3 advanced search and accurate discovery integration. Supabase project: `mefjzkhobkltlbmhusdh`.

## Existing system reused

- `residences` is the existing property source of truth, including verification, visibility, imagery and advertised availability.
- `residence_room_types` is the existing per-year room-type inventory and pricing table. It was empty before this release. The separate `resmap_rooms` table contained 362 existing room overview records, which are not altered or copied automatically.
- `resmap_residence_media` remains the approved published gallery.
- `residence-assets` is the existing public property-media bucket. Only authenticated portal users may upload under their assigned residence's folder, based on existing Storage policies.
- `residence_portal_accounts` and `is_authorized_residence_user(residence_id)` remain the access-control sources.
- The current ResMap route and advanced finder remain available; this enhancement builds on them rather than creating a separate search index.

## Phase 1: Shared operations and integrity

- New RLS-protected `reskonnect_listing_studio_drafts` holds one durable, revisioned listing draft per residence. Statuses: draft, submitted, changes_requested, approved.
- A database submission guard checks genuine same-residence photo URLs, property details, room capacities/prices, move-in date, lease terms and verification route. Landlords cannot self-approve.
- `reskonnect_review_listing` requires a ResKonnect administrator and a submitted, locked draft. Approval updates only verified listing facts, real photos, room-type prices/capacities and selected confirmed amenities; it preserves accreditation/trust/visibility controls and does not notify applicants.
- Event triggers feed the private `reskonnect_service_events` table with listing, inventory, property publication and reservation-change actions. No applicant contact details are included.
- `reskonnect_discovery_inventory_v` is a security-invoker public read model. It uses configured active room types when available, otherwise falls back to the existing residence's **reported** capacity and rate. This avoids inventing beds for historical listings.
- The existing `useRealtimeResidences` hook merges that projection into the existing finder and refreshes on residence and room-type changes. Cached data may be up to 24 hours old during outages and is expressly labelled as cached.

## Phase 2: Landlord Studio

New route: `/residence/listing/wizard`, with a link from the existing advanced editor and a dedicated landlord-navigation item.

Six stages: property details and letting model; group room capacity/prices; actual residence photos with cover and area tags; lease, earliest move-in and confirmed amenities; verification route and consent; complete preview and submission.

- Automatic debounced draft persistence after changes, plus manual Save and navigation between stages.
- A submitted draft becomes read-only until staff requests changes. Admin reviewer feedback is visible to the landlord.
- Multi-photo upload validates image type, file size and same-residence public storage folder; first image is the cover. Actual images are published only by staff.
- AdminOS **Residences → Listing reviews** shows proposed data, real photos, capacity/pricing, reviewer notes, approve or request corrections.
- Internal full addresses are retained in restricted draft records; new public search emphasizes general city/area. **Important:** the historical `residences` table also contains public address fields. This migration does not retroactively remove historical public address access; a separate privacy audit is required before promising complete address confidentiality.

## Phase 3: Discovery

- Existing `/find` offers a city selector and data-driven city shortcut chips alongside campus, audience, room and budget controls.
- Added 'available only', real-photo-only and platform-verified-price-only filters, plus recent-update ordering.
- Search matches residence, city, neighbourhood, campus and description; it no longer relies on exact street address matching.
- Public results hide `is_visible=false` listings and exclude demo rows.
- Pricing/availability uses the shared inventory projection without an invented accreditation or occupancy claim; active room types carry `room_type_reported` provenance.
- All existing map/discovery components remain available without recreating their 2D/3D functionality.

## Distinctions and safety

1. **Landlord-reported availability is not guaranteed booking availability.** Confirmed room allocations/holds still require dedicated booking-transaction enforcement across `resmap_rooms`, `resmap_room_holds` and `accommodation_reservations`. This release does not claim to solve duplicate booking across all legacy routes.
2. **Admin moderation is for the new guided workflow.** The existing advanced brand editor and legacy administrator residence forms are preserved for compatibility; their direct-edit permissions require consolidation in the next operational hardening cycle.
3. **Trust and accreditation stay staff-controlled.** No self-published verification badges are generated.
4. **Property photos are not synthetic.** Real JPEG/PNG/WebP files uploaded to the residence-owned storage folder are the only photos eligible for reviewed publication.
5. **Public discovery caches may be stale when offline.** Live availability cannot be guaranteed without a transaction-backed room assignment service.
6. No production applicant emails, WhatsApp sends, reservations, payments, residence modifications or approval decisions were performed during implementation.

## Acceptance plan

1. With a consented test landlord account, open the new wizard, populate the six sections, verify autosave and reload resume, upload three actual authorized residence photos and preview on mobile.
2. Test malformed room capacities, zero rent, duplicated room names, insufficient photos and incorrect signed/private storage URLs; submission must fail clearly.
3. Submit a controlled test listing; ensure the landlord cannot self-approve and AdminOS review queue receives it.
4. Have an authorized test admin request changes, verify feedback appears, resubmit and approve. Validate that only the intended residence's facts, room types, approved media, amenity flags and availability change.
5. Open `/find`: check city and campus matching, search by suburb, verified-price-only selection, availability provenance, photo-only filter and mobile layout. Confirm old listings remain discoverable without inventing room types.
6. Revisit the same residence after room-type inventory changes to verify data refresh and event audit. Test the cached/offline banner.
7. Verify authenticated landlord cannot read/edit another property's draft; public client cannot view listing drafts, service logs or private address from the new draft table.
8. Run web TypeScript, Node listing-safety tests, production build, WebKit/Chromium smoke, PWA matrix, Android release readiness, SEO and dependency-security pipelines.
9. Do not send real student communications, create paid subscriptions or modify real reservations during acceptance testing.

## Future convergence

A full atomic room reservation/hold ledger, public-address minimization in all legacy APIs, full legacy advanced-editor moderation, and post-approval applicant notification outbox remain separately scoped operational hardening work. Their completion should not be inferred from this release.