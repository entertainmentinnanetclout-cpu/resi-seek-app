# UI & Dashboard Audit

## 1. Dashboard Analysis

### God Mode (AdminDashboard.tsx)
- **Purpose**: Centralized command centre for platform administrators.
- **Functionality**:
  - High-level stats across all hubs (Operations, Commerce, Media, System).
  - Attention-needed alerts (Pending Apps, Unverified Listings, Full Residences).
  - Recent activity feed (System Events).
  - Quick action links.
- **Reusable Components**: `StatCard`, `AdminLayout`, `ActivityFeed` (logic), `QuickActionCard`.
- **Missing Enterprise Features**:
  - Multi-user admin audit logs (who did what).
  - Revenue/Commission tracking (currently mostly commerce-focused).
  - Advanced system health monitoring.
- **Improvements**: Transition from "God Mode" (TUT-centric heritage) to "Enterprise Operations Center."

### Accommodation Hub (AdminOperationsHub.tsx)
- **Purpose**: Manage the core residence and application data.
- **Functionality**: Residences, Sections, Filters, Portals, Applications, Landlord Apps, Follow-Up, Documents, Users.
- **Duplicate Functionality**: Some "Documents" and "Applications" management overlaps with the "Residence Portal."
- **Improvements**: Unified "Application Timeline" view instead of separate tabbed lists for documents and status.

### Residence Portal (ResidenceDashboard.tsx)
- **Purpose**: Dashboard for residence managers to handle their own applications.
- **Functionality**: Application stats, recent application list, quick review actions, basic analytics.
- **Reusable Components**: `ResidenceLayout`, `ApplicationCard`, `StatusBadge`.
- **Missing Enterprise Features**:
  - Room management (assignment of students to specific rooms).
  - Inventory management.
  - Billing/Invoice integration.
  - Communication broadcast (one message to all residents).
- **Broken/Stub Functionality**: The "Inbox" and "Analytics" pages need verification for data accuracy on External Supabase.

### Student Dashboard (Dashboard.tsx)
- **Purpose**: Personalized student hub for tracking applications and discovering services.
- **Functionality**: Application status tracker, favorites, recommended residences, quick links.
- **Reusable Components**: `DashboardLayout`, `TrackerStep`, `FavoriteCard`.

## 2. Page-by-Page Audit

| Page | Current Purpose | Reusable Components | Improvements |
|------|-----------------|---------------------|--------------|
| `Landing.tsx` | Entry point, SEO, Hero | `HeroCarousel`, `CategoryRail` | Move from TUT-focus to Institution-agnostic hero. |
| `FindMyRes.tsx` | Marketplace for res | `SmartSearchBar`, `PropertyCard` | Dynamic institution/campus filters. |
| `Applications.tsx` | Student application list | `ApplicationStatusCard` | Add "Save & Resume" functionality. |
| `ResidenceDetail.tsx`| Detailed residence info | `ImageSlideshow`, `AmenityGrid` | Multi-institution accreditation badges. |
| `Profile.tsx` | User profile management | `ProfilePictureUpload` | Add "Preferred Institution" to profile. |

## 3. "TUT-Only" UI Terminology Audit

- **Filter Labels**: "TUT Accredited" (should be "Accredited" or "Institution Approved").
- **Placeholder Text**: Many inputs use TUT-specific examples.
- **Campus Selectors**: Hardcoded to TUT campuses in many forms.
- **SEO Text**: Footer and landing page descriptions are TUT-heavy.

## 4. Reusable Component Catalog

- **UI Atoms**: `Button`, `Badge`, `Card`, `Input`, `Select` (from shadcn/ui).
- **Molecules**: `PropertyCard`, `StatusBadge`, `StatCard`, `FileUploader`.
- **Organisms**: `AdminLayout`, `DashboardLayout`, `ResidenceLayout`, `SmartSearchBar`, `FilterSidebar`.

## 5. Potential Improvements

- **Global Search**: A true global command palette for admins to find any user, res, or application instantly.
- **Unified Branding**: Ensure color schemes for Universities vs TVETs are handled dynamically.
- **Mobile Responsiveness**: Some admin hub tabs are currently "hidden sm:inline", which might hide critical info on mobile.
