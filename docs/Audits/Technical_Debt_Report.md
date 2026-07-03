# Technical Debt Report (V2 Audit)

## 1. Hardcoded UI Content
- **Files**: `src/components/PublicLayout.tsx`, `src/components/SEO.tsx`, `src/pages/Landing.tsx`.
- **Debt**: "TUT", "Pretoria", and "Tshwane" are used as the primary descriptors in headers, footers, and metadata.
- **Risk**: Low (branding/SEO impact).
- **V2 Fix**: Move these strings to a `platform_settings` entry or a localized config file.

## 2. Static Campus Logic
- **Files**: `src/lib/campuses.ts`.
- **Debt**: Only contains TUT campuses.
- **Risk**: High (blocks expansion to other institutions).
- **V2 Fix**: Migrate to a dynamic `campuses` table.

## 3. Schema Redundancy
- **Table**: `residences`.
- **Debt**: `is_tut_accredited` is a boolean, while `institution_tags` is an array.
- **Risk**: Low (schema clutter).
- **V2 Fix**: Deprecate the boolean column; migrate all data to `institution_tags` or a new `residence_accreditations` junction table.

## 4. Fragmented Referral Logic
- **Files**: `src/pages/Auth.tsx` (capture), `src/pages/Referrals.tsx` (display), `supabase/functions/referral-capture` (logic).
- **Debt**: Logic is split across three layers without a unified service.
- **Risk**: Medium (attribution errors).
- **V2 Fix**: Centralize referral state management in a `useReferral` hook.

## 5. Lovable Cloud / External Supabase Duality
- **File**: `src/lib/lovableFunctions.ts`.
- **Debt**: Edge functions must be called via a custom fetch wrapper due to project pinning.
- **Risk**: Medium (developer confusion, breaking `supabase.functions.invoke`).
- **V2 Fix**: Maintain the `invokeEdgeFunction` helper as the single source of truth for function calls.
