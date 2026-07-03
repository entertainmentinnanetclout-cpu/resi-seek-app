# Phase 1: Area 4 - Database Audit

## 1. Core Table Inspection

| Table | Purpose | RLS | Potential Simplification |
|-------|---------|-----|-------------------------|
| `residences` | Properties | Yes | Deprecate `is_tut_accredited` for `institution_tags`. |
| `applications`| Student Interest | Yes | Combine `funding_type` and `application_term` logic. |
| `profiles` | Identity | Yes | Normalize `campus` field to `campus_id`. |
| `documents` | User Vault | Yes | None. |
| `residence_portal_accounts` | Access | Yes | Drop duplicate residence_id FK. |
| `referral_earnings` | Commissions | Yes | Consolidate `signup` and `sale` types. |

## 2. Duplicate / Redundant Tables
- **`application_prep`**: Potentially overlaps with `profiles.lifestyle_preferences`.
- **`marketplace_seller_profiles`**: This is a VIEW on `profiles`, correctly reused.

## 3. Relationships & Keys
- **Missing FK**: `campus` in `profiles` is a string; should link to a `campuses` table.
- **Missing Relationship**: `residences` lack a direct link to `institutions` (currently using `institution_tags` text array).

## 4. Performance & Indexes
- **Missing Index**: `idx_applications_status_created` for dashboard speed.
- **Missing Index**: `idx_residences_price_available` for search optimization.

## 5. RLS & Security Status
- **Audit**: All tables have RLS enabled.
- **Risk**: Admin bypass policies are broad; ensure `has_role` is highly secure.
