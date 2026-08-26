# ResKonnect 2027 Reservations Release

Production release bundle for the 2027 accommodation intake.

## Live product capabilities

- Pretoria accommodation can accept 2027 reservation interest independently of current-year availability.
- Private/self-funded and NSFAS-funded accommodation prices are stored and displayed separately.
- Residence promotions support price, room type, message, badge, start and end dates.
- Residence cards include map previews with exact coordinates when available and address-based fallback otherwise.
- New reservations create student notifications, admin alerts and system activity events.
- The Admin Accommodation Hub contains dedicated 2027 reservation management and commercial pricing/promotion/map controls.
- Landing-page updates are database-managed and displayed as a premium ResKonnect centre-screen popup.
- Admin can create, edit, schedule, prioritize, enable/disable and delete landing updates.
- Assisted application submission is attributed to Tech-Up; ResKonnect remains responsible for readiness, APS/course guidance and document preparation.
- Platform development attribution is Start To Up Innovations Group.

## Data integrity notes

Exact residence coordinates must come from verified map data or administrator input; the platform does not fabricate coordinates. Until a precise pin is saved, the map component resolves the residence address.

Promotional prices are never invented. A promotion may be enabled with a descriptive campaign while the exact price remains unset until supplied by the residence.
