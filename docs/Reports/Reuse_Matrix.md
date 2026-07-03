# Component Reuse Matrix (Phase 2)

Based on the audit of existing components and V2 requirements.

| Existing Component | Decision | Reason | V2 Extension Plan |
|--------------------|----------|--------|-------------------|
| `ResidencePropertyCard` | **Extend** | Supports 90% of requirements. | Replace hardcoded TUT badges with dynamic accreditation icons. |
| `SmartSearchBar` | **Extend** | Highly functional. | Replace `TUT_CAMPUSES` import with database-driven institutions & campuses. |
| `StatCard` | **Reuse** | Clean, modular atom. | No changes needed. |
| `AdminLayout` | **Extend** | Solid shell. | Update sidebar to reflect the new "Hub" hierarchy (Operations, Media, etc.). |
| `ResidenceLayout` | **Reuse** | Effective for scoped access. | No changes needed. |
| `ApplicationStatusCard`| **Extend** | Good for lists. | Add "Next Steps" action items and "Document Checklist" summary. |
| `DocumentUploader` | **Extend** | Core utility. | Support "Required Document Templates" provided by the residence/institution. |
| `ReferralCard` | **Extend** | Basic. | Add "Earnings Graph" and "Request Withdrawal" CTA. |
| `AdminResidences` | **Extend** | Functional list. | Add filtering by Institution and Province. |
| `ResidenceInbox` | **Extend** | Good for management. | Add "Batch Actions" (e.g., Approve 5 at once). |

## Database Table Reuse Matrix

| Table | Decision | Reason | V2 Extension Plan |
|-------|----------|--------|-------------------|
| `residences` | **Extend** | Core entity. | Deprecate `is_tut_accredited`; rely on `institution_tags` and new `accreditations` table. |
| `applications` | **Extend** | Core entity. | Add `institution_id` for better reporting. |
| `profiles` | **Extend** | Core entity. | Add `preferred_institution_id` and `current_academic_year`. |
| `referral_codes` | **Reuse** | Well-structured. | No changes needed. |
| `referral_earnings` | **Reuse** | Well-structured. | No changes needed. |

## Strategy for New Creations
Only create new components when:
1. A new entity requires a specialized UI (e.g., `InstitutionDashboard`).
2. An existing component has too many TUT-specific conditionals making it "un-refactorable."
3. A completely new workflow is introduced (e.g., `RoomAllocationGrid`).
