# ResKonnect V2 Master Blueprint

## 1. Vision & Architectural Shift

**Old Focus**: A TUT-specific residence finder.
**V2 Focus**: A South African Student Services Platform supporting Universities, TVETs, and Private Rentals nationwide.

### Core Architectural Principles
1. **Institution-Agnostic**: All institutions and campuses are database-driven.
2. **Role-Based Hierarchy**: Clear separation between Super Admin, Internal Staff, Residence Admin, and Students.
3. **API-First Readiness**: Logic resides in Edge Functions and RPCs to support future mobile/cross-platform expansion.
4. **Resilient Referrals**: Referral tracking that survives sessions and supports automated commission payouts.

## 2. Technical Debt & Immediate Fixes

### Critical
- **TUT Hardcoding**: Refactor `campuses.ts` and UI labels into dynamic database lookups.
- **FK Cleanup**: Resolve duplicate foreign keys on `residence_portal_accounts` to prevent PostgREST embed errors.

### High
- **Referral Attribution**: Improve `localStorage` tracking to a more robust cookie or server-side "pending signup" model.
- **Admin Navigation**: Streamline "God Mode" into the new Hub-based hierarchy to reduce menu clutter.

## 3. V2 Upgrade Roadmap (Phased)

### Phase 1: The Agnostic Core (High Priority)
- **Database**: Create `institutions` and `campuses` tables.
- **Refactor**: Update `FindMyRes` and `SmartSearchBar` to fetch campuses from DB.
- **Cleanup**: Remove "TUT-only" labels from public-facing components.

### Phase 2: Enterprise Operations (Medium Priority)
- **Residence Portal**: Add Room Management and Resident Communication tools.
- **Admin Hub**: Implement full audit logging for admin actions.
- **Applications**: Add "Save & Resume" progress tracking.

### Phase 3: Growth & Referrals (Medium Priority)
- **Referral V2**: Implement Marketing Dashboard with conversion analytics.
- **Withdrawals**: Create the student commission withdrawal workflow.
- **SEO**: Dynamic landing pages for every major institution/city in SA.

## 4. Regression Risk Assessment

| Feature | Risk | Mitigation |
|---------|------|------------|
| Campus Refactor | High | Ensure `TUT_CAMPUSES` remains as a fallback/default while migrating to DB. |
| DB Migrations | Medium | Use Idempotent SQL with rollback scripts. Run on Lovable mirror before External. |
| Edge Functions | Low | Maintain the `invokeEdgeFunction` wrapper for gateway compatibility. |

## 5. Testing Requirements

- **Role Testing**: Verify that Residence Admins cannot see other residence data.
- **Cross-Institution Testing**: Verify that filtering by "DUT" doesn't show "TUT" residences.
- **Referral Testing**: Verify that a user signing up via `?ref=CODE` correctly attributes the `signup` earning to the referrer.
