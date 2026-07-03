# Database & Backend Audit

## 1. Supabase Schema Audit

### Key Tables & Relationships
- **Core Entity**: `residences` is the central table. It supports institution-agnosticism through `institution_tags` (GIN index) and `section_category`.
- **User Roles**: `user_roles` and the `app_role` enum manage permissions (`admin`, `student`, `residence_portal`, etc.).
- **Applications**: `applications` table tracks student interest. Relates to `residences` and `profiles`.
- **Commerce (Paused)**: Tables like `products`, `stores`, `shop_orders` exist but are currently isolated from primary workflows.

### "TUT-Only" Debt
- `residences.is_tut_accredited` boolean column exists alongside the more flexible `institution_tags`.
- Many `delivery_zones` are hardcoded to "TUT Soshanguve South Drop-off", etc.
- `application_prep` checklist defaults often include TUT-specific items.

### Potential Database Improvements
- **Missing Institutions Table**: Currently, institutions are just strings in arrays/tags. A dedicated `institutions` table with metadata (logo, domain, type) is needed for V2.
- **Missing Campuses Table**: Campuses are currently hardcoded in the frontend (`campuses.ts`). They should be moved to a database table related to `institutions`.
- **Unused/Duplicate Columns**:
  - `applications.funding_type` vs `residence_handover_export_v.funding_source` shims.
  - Legacy FKs on `residence_portal_accounts` need careful management (documented in `ADMIN_DEEP_SCAN_REPORT.md`).

## 2. Backend Logic (RPCs & Edge Functions)

### Edge Functions
- Hosted on **Lovable Cloud** (`vmqqkebojldjsyxcewdb`), not the External Supabase.
- **Key Helper**: `invokeEdgeFunction` in `src/lib/lovableFunctions.ts` is critical for routing calls to the correct gateway while forwarding the External JWT.
- **Functions Catalog**: `resbot-ai`, `generate-booking-slip`, `update-application-status`, `create-residence-portal-user`, etc.

### RPC Functions
- `has_role`: Standard role-based access check.
- `get_user_residence_id`: Used for Residence Portal scoping.
- `validate_handover_pack`: Complex logic for ensuring applications are ready for export.
- `capture_referral_sale`: Core logic for the referral system.

## 3. API Readiness & Abstraction

- **Current State**: The frontend is tightly coupled to the Supabase client (`supabase.from('...')`).
- **Mobile Readiness**: Since logic is largely in Edge Functions and RPCs, the "Backend-as-an-API" is already partially abstracted. However, direct table access in the UI would need to be replaced by a Service Layer or Repository Pattern for true provider-agnosticism.
- **Recommendation**: Introduce a `services/` directory in the frontend to wrap Supabase calls, making it easier to swap the data source or add caching layers later.

## 4. RLS & Security

- Policies are generally robust, using `has_role` and `is_authorized_residence_user`.
- **Enterprise Risk**: Admin RLS overrides must be carefully audited to ensure they don't leak data if new admin roles are added.
- **Storage**: Path-based RLS on `user-uploads` and `application-documents` buckets is implemented.
