# Phase 1: Area 1 - Project Structure Audit

## 1. Folder Tree Analysis
- `src/`
  - `assets/`: Static UI assets (logos, hero images). Many are TUT-branded.
  - `backend/`: TypeScript definitions and drivers for the service layer abstraction.
  - `components/`
    - `admin/`: Modular parts of the God Mode hubs (e.g., `SectionsManager`).
    - `findmyres/`: Specialized components for the marketplace (e.g., `AudienceSelector`).
    - `ui/`: shadcn/ui library components.
  - `contexts/`: Global state providers (Auth, Protection).
  - `hooks/`: Domain-specific logic (e.g., `useRealtimeResidences`).
  - `integrations/`: Third-party clients (Supabase).
  - `lib/`: Business logic utilities and constants.
  - `pages/`
    - `admin/`: Pages for God Mode and the 4 Hubs.
    - `residence/`: Pages for the Residence Portal.
    - `seo/`: Specialized landing pages for Google search optimization.
- `supabase/`: Contains Edge Functions and SQL Migrations.
- `docs/`: (Current) Authoritative technical knowledge base.

## 2. Routing Structure (`App.tsx`)
- **Root Layout**: Wrapped in `QueryClientProvider`, `TooltipProvider`, `Toaster`, and `AuthProvider`.
- **Public Routes**: Entry points for SEO and browsing (`/`, `/find`, `/res/:id`).
- **Protected Student Routes**: Scoped with `<StudentRoute>` (Dashboard, Profile, MyWIL).
- **Admin Hub Routes**: Scoped with `<AdminRoute>` and `<ProtectedRoute>`.
- **Residence Portal**: Scoped with `<ResidenceRoute>` under `/residence`.
- **Specialist Routes**: Scoped with `<SpecialistRoute allowedRoles={[...]}>` for Media and Commerce Leads.

## 3. Shared Components
- **Layouts**: `PublicLayout`, `DashboardLayout`, `AdminLayout`, `ResidenceLayout`.
- **UI Atoms**: Standard shadcn/ui components.
- **Business Molecules**: `ResidenceCard`, `StatusBadge`, `StatCard`, `FileUploader`.

## 4. Reusable Utilities
- `src/lib/lovableFunctions.ts`: The mission-critical bridge for Edge Functions.
- `src/lib/exportHelpers.ts`: Logic for CSV/Excel generation.
- `src/lib/utils.ts`: Tailwind class merging.
