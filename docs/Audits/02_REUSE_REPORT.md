# Phase 2: Reuse Report - Component & Database Matrix

## 1. Component Reuse Matrix

| Component | Decision | Reason | V2 Extension Plan |
|-----------|----------|--------|-------------------|
| `ResidencePropertyCard` | **Reuse/Extend** | Already supports 80% of requirements. | Add multi-institution accreditation badges. |
| `SmartSearchBar` | **Extend** | Highly functional but needs DB-driven filters. | Replace `TUT_CAMPUSES` with dynamic institution/campus fetch. |
| `StatCard` | **Reuse** | Perfectly agnostic and modular. | No change needed. |
| `SectionsManager` | **Extend** | Good for hierarchy editing. | Support Floor -> Room -> Bed hierarchy. |
| `DocumentUploader` | **Reuse** | Core student utility. | Add "Required Document Templates" per institution. |
| `ApplicationStatusCard`| **Extend** | Basic. | Add "Next Steps" timeline for student. |
| `AdminLayout` | **Extend** | Good shell but sidebar is cluttered. | Implement Hub-based top-level navigation. |

## 2. Database Reuse Matrix

| Table | Decision | Reason | V2 Extension Plan |
|-------|----------|--------|-------------------|
| `residences` | **Extend** | Core entity. | Deprecate `is_tut_accredited`; migrate to `institution_tags` + `residence_accreditations` table. |
| `applications` | **Extend** | Transactional history. | Link to `institutions` for better reporting. |
| `profiles` | **Extend** | Identity. | Add `institution_id` and `current_year_of_study`. |
| `referral_codes` | **Reuse** | Well-designed affiliate engine. | No change needed. |
| `stores` | **Extend** | (Paused) Commerce core. | Add `owner_verification_status`. |

## 3. Policy & Logic Reuse

| Logic / Policy | Decision | Reason |
|----------------|----------|--------|
| `has_role` RPC | **Reuse** | Authoritative and re-runnable. |
| `invokeEdgeFunction` | **Reuse** | Essential for gateway bridge. |
| `admin` RLS Bypass | **Reuse/Extend** | Effective, but needs auditing for new staff roles. |
| `Student KYC` Flow | **Extend** | Support more diverse document types. |

## 4. Deletions & Replacements
- **`TUT_CAMPUSES` constant**: Replace with dynamic `campuses` table.
- **`is_tut_accredited` column**: Replace with many-to-many relationship.
- **Hardcoded header links**: Replace with dynamic `platform_settings` driven navigation.
