# Feature-Specific Audits

## 1. Find My Res (V3 Readiness)

- **Search & Filters**:
  - `SmartSearchBar` and `FilterSidebar` use `TUT_CAMPUSES`. Need to move to institution-linked campuses.
  - Sorting logic (`matchScore`) is robust but could be improved with more detailed student preferences.
- **Comparison Tool**: `CompareDrawer` supports up to 3 residences. This is a solid enterprise feature.
- **Missing Features**:
  - Distance from specific campus (currently a number, needs to be dynamic based on the selected campus's coordinates).
  - Map View (spatial search).

## 2. Residence Portal (Operations Readiness)

- **Applications Management**:
  - `ResidenceInbox` provides status-based filtering.
  - `update-application-status` edge function handles business logic.
- **Documents & Reports**:
  - Basic document verification is present.
  - "Handover Pack" export exists but needs verification for all required columns.
- **Missing Workflows**:
  - Lease signing automation.
  - Room allocation.
  - Resident maintenance requests.

## 3. Applications Hub (Workflow Readiness)

- **Tracking**: `Applications.tsx` shows status but lacks a detailed "Next Steps" timeline for students.
- **Document Upload**: `DocumentUploader` is generic; needs specialization for different institutions (e.g., some need Affidavit, some need ID of parent).
- **New Feature Recommendation**: "Save & Resume" - Save application progress to `application_prep` before final submission.

## 4. Authentication & Role Routing

- **Current Flow**: Redirects to `/dashboard` (Student), `/admin` (Admin), or `/residence` (Residence Portal) based on role.
- **Permissions**: `has_role` RPC is correctly implemented.
- **Enterprise Improvement**: "First Login Flow" for residence admins to set up their profile and residence details.

## 5. Referral V2 (Deep Dive)

- **Current Implementation**:
  - `pending_ref` stored in `localStorage`.
  - `capture_referral_sale` RPC triggers on payment.
  - Referral links: `auth?ref=CODE`.
- **Gaps for V2**:
  - **Survivability**: `localStorage` is fragile. A cookie or server-side "pending referral" associated with an email before signup would be better.
  - **Attribution**: No tracking for "incomplete applications" that eventually convert.
  - **Withdrawal Management**: The UI shows "Paid out" but lacks a "Request Withdrawal" workflow for students.
  - **Analytics**: `Referrals.tsx` is basic. Needs conversion rates (signups / clicks).
- **Infrastructure**: `referral_codes`, `referral_earnings`, and `referral_claims` tables are in place.
