# 24. Known Issues

## 1. Technical Debt
- **TUT Hardcoding**: Several components still reference "TUT" in strings. (Fix scheduled for Phase 1a).
- **FK Duality**: `residence_portal_accounts` has a redundant foreign key causing PostgREST embed errors in some environments.

## 2. Performance
- **Image Size**: Some landlord-uploaded images exceed 5MB. Client-side compression is partially implemented but needs enforcement.
- **Realtime**: Too many active subscriptions on the God Mode dashboard can cause lag on low-end mobile devices.

## 3. UI/UX
- **Mobile God Mode**: Tabs are too wide for small screens; some hub pages require horizontal scrolling.
- **Save & Resume**: Not implemented; students lose form progress if they leave the page without submitting.
