# Project Structure & TUT-Agnostic Audit

## 1. Project Structure Overview

The project follows a standard Vite + React + TypeScript structure with Supabase as the backend.

### Folder Tree
- `src/`
  - `assets/`: Static assets (images, fonts).
  - `components/`: UI components, organized by domain (admin, findmyres, ui).
  - `contexts/`: React contexts (e.g., AuthContext).
  - `hooks/`: Custom React hooks.
  - `integrations/`: Third-party integrations (Supabase client and types).
  - `lib/`: Reusable utilities and constants.
  - `pages/`: Page components, organized by role (admin, residence, seo).
- `supabase/`
  - `functions/`: Edge functions (Deno).
  - `migrations/`: SQL migrations.
- `docs/`: Technical documentation and SQL packs.

## 2. Routing Structure

Routing is managed in `src/App.tsx` using `react-router-dom`.
- **Public Routes**: `/`, `/auth`, `/find`, `/res/:id`, `/bursaries`, `/apply`, etc.
- **Protected Student Routes**: `/dashboard`, `/profile`, `/applications`, `/documents`, etc.
- **Admin Hub Routes**: `/admin`, `/admin/analytics`, `/admin/operations`, `/admin/commerce`, `/admin/media`, `/admin/system`.
- **Residence Portal Routes**: `/residence/login`, `/residence/*` (Dashboard, Inbox, Analytics).
- **SEO Routes**: Hardcoded patterns like `/student-accommodation-:province`, `/tut-:campus-accommodation`.

## 3. TUT-Agnostic Audit (The "TUT-Only" Mindset)

The platform currently has significant hardcoding for Tshwane University of Technology (TUT).

### UI Hardcodings
- **Labels & Subtitles**:
  - `AudienceSelector.tsx`: "TUT, UP, UNISA & more" in sub-label.
  - `AccreditationCTA.tsx`: "Become TUT Accredited 2026 – 2031".
  - `CategoryHeroSelector.tsx`: "NSFAS & TUT accredited".
  - `ResidencePropertyCard.tsx`: Hardcoded "TUT ✓" badge.
- **Form Placeholders**:
  - `ProductFormDialog.tsx`: Placeholder "e.g. TUT Hoodie — Navy Blue".
- **Keywords**:
  - `CommandPalette.tsx`: Keywords include "tut".
  - `SEO.tsx`: Default keywords include "TUT".

### Logic & Data Hardcodings
- **Campus Lists**:
  - `src/lib/campuses.ts`: Contains only `TUT_CAMPUSES`. This is imported and used in multiple places (`FilterSidebar.tsx`, `SmartSearchBar.tsx`, `LandlordListingForm.tsx`).
- **Filters**:
  - `FilterSidebar.tsx` and `SmartSearchBar.tsx` map over `TUT_CAMPUSES` by default.
- **SEO Routes**:
  - `App.tsx` defines `<Route path="/tut-:campus-accommodation" element={<CampusLanding />} />`.
  - `PublicLayout.tsx` has hardcoded links to `/tut-pretoria-west-accommodation`.

### Database Schema (TUT-Specific Columns)
- `residences` table: `is_tut_accredited` (boolean).
- `residences` table: `institution_tags` (array) is used, which is a better approach, but the boolean column still exists.

## 4. Recommendations for Institution-Agnosticism

- **Refactor `campuses.ts`**: Replace `TUT_CAMPUSES` with a dynamic `institutions` and `campuses` table in the database.
- **Dynamic SEO Routes**: Change `/tut-:campus-accommodation` to `/:institution-:campus-accommodation`.
- **Component Generalization**: Replace hardcoded "TUT ✓" badges with a dynamic accreditation badge based on the `institution_tags` and a new `accreditations` table.
- **Configuration-Driven UI**: Move hardcoded sub-labels and strings to a translation/config file or database-backed `platform_settings`.
- **Schema Migration**: Deprecate `is_tut_accredited` in favor of a many-to-many relationship between `residences` and `accreditations` (or institutions).
