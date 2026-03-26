

# Landlord Application System + Landing Page Conversion Upgrade

## Overview

Replace the static `LandlordListingForm` with a tabbed **Landlord Application Portal** that saves to a new `landlord_applications` table (not WhatsApp). Add an admin management tab for reviewing these applications. Enhance the landing page to convert visitors without requiring login first.

## Database: `landlord_applications` Table

New table on external Supabase with full SQL in `docs/LANDLORD_SQL.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.landlord_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_type text NOT NULL DEFAULT 'listing', -- 'listing', 'accreditation', 'both'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'under_review', 'approved', 'rejected'
  -- Property details
  property_name text NOT NULL,
  address text NOT NULL,
  nearest_campus text,
  distance_from_campus numeric,
  room_type text,
  price numeric,
  capacity integer,
  description text,
  amenities text[] DEFAULT '{}',
  province text DEFAULT 'Gauteng',
  -- Landlord contact (stored securely, admin-only visible)
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text NOT NULL,
  company_name text,
  -- Accreditation fields
  registration_number text,
  nsfas_accredited boolean DEFAULT false,
  years_operating integer,
  total_properties integer DEFAULT 1,
  -- Documents
  documents jsonb DEFAULT '[]',
  -- Admin
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: anyone can INSERT (public form), only admins can SELECT/UPDATE/DELETE
-- Indexes on status, created_at, application_type
```

RLS policies:
- **Public INSERT** (no auth required — this is a landing page form)
- **Admin SELECT/UPDATE/DELETE** via `has_role(auth.uid(), 'admin')`

## Landing Page Changes

### 1. Replace `LandlordListingForm` with `LandlordApplicationTabs`

New component with 3 tabs:
- **List My Property** — property details form (similar to current but saves to DB)
- **Get Accredited** — accreditation application (registration number, NSFAS status, years operating)
- **Both** — combined form

All forms save directly to `landlord_applications` table via Supabase insert (no WhatsApp redirect). Show success state with reference number.

### 2. Landing Page Conversion Improvements

Make the page convert visitors into action-takers without requiring login:

- **Header**: Add quick nav links — "Find Accommodation", "List Property", "Bursaries", "Marketplace" (anchor/route links visible to everyone)
- **Hero section**: Keep as-is (already good)
- **"Why Choose" section**: Add CTA buttons inside each feature card linking to relevant pages
- **Trusted Residences**: Add inline "Apply Now" buttons on cards that route to `/res/{id}` (public page)
- **About section**: Replace generic "Get Started" with dual CTAs — "I'm a Student" → `/find`, "I'm a Landlord" → scroll to landlord section
- **Contact form**: Keep but make more compact
- **Remove**: The separate "Connecting Students" SEO text block (redundant with About)
- **Add**: Stats counter section (animated numbers) — "500+ Students Housed", "30+ Verified Residences", "9 Provinces"

### 3. Mobile nav improvements

Add more links to mobile sheet menu: "Find Accommodation", "Bursaries", "Marketplace", "List Property"

## Admin: Landlord Applications Tab

### Add to Operations Hub

Add a new tab "Landlord Apps" to `AdminOperationsHub.tsx`:
- Icon: `Building2` or `ClipboardList`
- Content component: `AdminLandlordApplicationsContent`

### `AdminLandlordApplications.tsx`

- Table view of all `landlord_applications` ordered by `created_at DESC`
- Columns: Reference, Property Name, Type (badge), Status (badge), Contact, Date
- Filter by status and type
- Click to expand/edit:
  - View full details
  - Update status (pending → under_review → approved/rejected)
  - Add admin notes
  - If approved + type is "listing": quick action to create residence from application data

## Files

| File | Action |
|------|--------|
| `docs/LANDLORD_SQL.sql` | **Create**: Full idempotent SQL for `landlord_applications` table, RLS, indexes |
| `src/components/LandlordApplicationTabs.tsx` | **Create**: Replace old form with tabbed application portal (listing/accreditation/both) |
| `src/pages/Landing.tsx` | **Rewrite**: Better conversion flow, replace LandlordListingForm import, add nav links, stats section, dual CTAs |
| `src/pages/admin/AdminLandlordApplications.tsx` | **Create**: Admin management page with table + detail dialog |
| `src/pages/admin/AdminOperationsHub.tsx` | **Update**: Add "Landlord Apps" tab |
| `src/components/LandlordListingForm.tsx` | Keep file but no longer imported from Landing |

## Technical Details

- Landlord form uses `supabase.from('landlord_applications').insert()` with no auth required (public RLS INSERT policy)
- Contact details stored in DB only — never exposed in frontend (per privacy constraint)
- Admin uses standard Supabase queries with admin RLS
- "Convert residence" action on approved listing apps copies property data into `residences` table
- Stats section uses static numbers initially (can be made dynamic later)
- All SQL is idempotent with `IF NOT EXISTS` and `DO $$ EXCEPTION` patterns

