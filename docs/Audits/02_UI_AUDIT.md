# Phase 1: Area 2 - UI Audit

## 1. Page-by-Page Inspection

| Page | Purpose | Functionality | Reusable Components | Improvements Needed |
|------|---------|---------------|---------------------|----------------------|
| `Landing.tsx` | Entry Point | Hero slider, categories, featured listings. | `HeroCarousel`, `CategoryRail` | Move away from TUT-only terminology. |
| `FindMyRes.tsx` | Search Engine | Filtering, sorting, comparison. | `SmartSearchBar`, `PropertyCard` | Dynamic campuses from DB. |
| `Applications.tsx` | Tracking | List of user's applications. | `ApplicationStatusCard` | Add "Next Steps" timeline. |
| `Profile.tsx` | User Identity | KYC, preferences, contact info. | `ProfilePictureUpload` | Institution selection in profile. |
| `BursaryFinder.tsx`| Student Support | List of active funding opportunities. | `StatCard` | Category filtering for bursaries. |
| `Referrals.tsx` | Affiliate Hub | Link generation, earnings ledger. | `AffiliateLinkGen` | Better conversion analytics. |
| `Documents.tsx` | Vault | Centralized student file storage. | `DocumentUploader` | Batch delete functionality. |

## 2. Reusable Components
- `ResidencePropertyCard`: Central display unit for accommodation.
- `StatCard`: Visualizing counts in all dashboards.
- `SmartSearchBar`: Advanced filtering engine.
- `StatusBadge`: Consistent status coloring across domains.

## 3. Missing Functionality
- **Map View**: Spatial search in `FindMyRes`.
- **Global Search**: Command palette that searches users/res/apps simultaneously for admins.
- **Save & Resume**: Saving application progress before submission.

## 4. Possible Improvements
- **Mobile Navigation**: God Mode tabs are currently cluttered on mobile.
- **A11y**: Ensure all form inputs have associated labels for screen readers.
- **Branding**: Dynamic themes (colors/logos) based on the user's primary institution.
