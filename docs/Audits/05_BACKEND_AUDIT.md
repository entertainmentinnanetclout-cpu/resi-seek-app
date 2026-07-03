# Phase 1: Area 5 - Backend Audit

## 1. Supabase Client & Integrations
- `client.ts`: Hard-pinned to External Supabase.
- `types.ts`: Automatically generated, but includes custom shims for enterprise tables.

## 2. Edge Functions (Lovable Cloud)
| Function | Used By | Security |
|----------|---------|----------|
| `resbot-ai` | `ResBot.tsx` | JWT forward. |
| `create-residence-portal-user` | `AdminResidencePortals.tsx` | Admin check. |
| `generate-booking-slip` | `Applications.tsx` | Owner check. |
| `update-application-status` | `ResidenceApplicationDetail.tsx` | Residence Admin check. |

## 3. RPC Functions
- `has_role`: Crucial for RBAC.
- `get_user_residence_id`: Used for Residence Portal scoping.
- `capture_referral_sale`: Core of the affiliate engine.
- `validate_handover_pack`: Complex data validation for residence admins.

## 4. Storage Buckets
- `documents`: Private, Student ID and proof.
- `application-documents`: Private, Application-specific files.
- `profile-pictures`: Public, User avatars.
- `admin-images`: Public, Slides, News, Events.
- `marketplace`: Public, Product photos.

## 5. Realtime Subscriptions
- Used for `applications`, `residences`, and `notifications`.
- **Constraint**: Over-subscription in God Mode could cause performance issues; recommend moving to polling for non-critical admin views.
