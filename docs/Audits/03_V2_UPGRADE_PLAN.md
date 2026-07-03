# Phase 3: V2 Upgrade Plan (Enterprise Master)

## 1. Upgrade Categorization

### Critical (Immediate Foundation)
| Upgrade | Purpose | Impact | Dependencies | Risk |
|---------|---------|--------|--------------|------|
| **Dynamic Institutions**| Support any Uni/TVET/College. | High (Enables expansion). | `institutions`, `campuses` tables. | Medium (Data migration). |
| **Agnostic Filter Engine**| Remove TUT-only search logic. | High (User experience). | `FilterSidebar`, `SmartSearchBar`. | Low. |
| **FK Cleanup** | Database integrity. | Low (Consistency). | `residence_portal_accounts`. | Medium (PostgREST embeds). |

### High (Core Workflows)
| Upgrade | Purpose | Impact | Dependencies | Risk |
|---------|---------|--------|--------------|------|
| **Referral V2 Dashboard**| Affiliate marketing growth. | High (Growth). | `referral_earnings` analytics. | Low. |
| **Application Timeline** | Transparency for students. | High (Satisfaction). | `applications`, `activity_log`. | Low. |
| **Multi-Institution Acc** | NSFAS/Private/Uni accreditation. | Medium (Trust). | `residence_accreditations`. | Low. |

### Medium (Operational Depth)
| Upgrade | Purpose | Impact | Dependencies | Risk |
|---------|---------|--------|--------------|------|
| **Room Management** | Occupancy tracking. | Medium (Residence Admin). | `rooms`, `beds` tables. | High (Complexity). |
| **Admin Hub Navigation**| Better focus for staff. | Medium (Staff UX). | `AdminLayout`. | Low. |

## 2. Technical Details per Upgrade

### Dynamic Institutions
- **Database**: Add `institutions` and `campuses` tables. Seed with Gauteng data.
- **Frontend**: Update `useResidenceFilters` to fetch campus options from DB.
- **Testing**: Verify `FindMyRes` result counts for "TUT" vs "UP" vs "UJ".

### Referral V2
- **Database**: Add `referral_payout_requests` table.
- **Backend**: Update `referral-capture` function to handle browser-refresh persistence.
- **Frontend**: New "Withdrawal" UI in `Referrals.tsx`.

## 3. Testing Requirements
- **Regression Risk**: Ensure existing TUT residences still show correctly in the new "institution_tags" system.
- **Role Testing**: Verify that "Residence Portal" users only see their scoped residence after the FK cleanup.
- **Mobile Verification**: Ensure the new Hub-based admin navigation is fully responsive.
