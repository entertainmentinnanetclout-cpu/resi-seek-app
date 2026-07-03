# 08. Testing Standard

## 0. Component Reuse Strategy
Refer to the [Phase 2: Reuse Report](./Audits/02_REUSE_REPORT.md) before starting any new development.

## 1. Feature Lifecycle
No feature skips stages. Each stage has a definition of done.

1. **Architecture**: Domain identified, Service layer mapped.
2. **Database**: Idempotent SQL, RLS policies, Indexes.
3. **Backend**: Edge function logic, RPCs.
4. **UI**: Design System followed, Loading/Error states handled.
5. **Testing**: Manual verification, Playwright (for critical paths).
6. **Documentation**: Feature report in `docs/Audits/` or `docs/Guides/`.

## 2. Testing Tiers
- **Tier 1: Static Analysis**: ESLint and TypeScript compilation.
- **Tier 2: Manual Audit**: Review of UI against the Design System.
- **Tier 3: SQL Verification**: Running the verification block in Supabase.
- **Tier 4: E2E Verification**: Playwright scripts for "Happy Paths" (e.g., student signup, application submit).

## 3. Performance Targets
- **LCP (Largest Contentful Paint)**: < 2.5s.
- **Query Latency**: < 300ms for primary datasets.
- **Payload Optimization**: Images must be lazy-loaded and webp-compressed.

## 4. Regression Prevention
Always run existing tests before submitting changes. For any UI change, perform a visual regression check on mobile and desktop views.
