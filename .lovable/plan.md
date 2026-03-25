

# Admin-Managed Section Tabs for Residences

## Problem
The collapsible section tabs ("FLATS", "COMMUNES", "RENTALS" on Top 30; campus-based sections on FindMyRes) are hardcoded. Admin cannot add, rename, reorder, or assign residences to custom categories like "Private Accommodations", "Communes", "Student Houses", etc.

## Solution
Create a `residence_sections` database table so admin can fully manage section tabs. Both `TrustedResidencesGrid` and `ResidenceSectionGrid`/`FindMyRes` will read sections from the database instead of hardcoded arrays.

## Plan

### 1. Create `residence_sections` table (migration)
```sql
CREATE TABLE public.residence_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  subtitle text,
  display_order integer DEFAULT 0,
  color text DEFAULT 'bg-blue-500',
  is_active boolean DEFAULT true,
  applies_to text DEFAULT 'both', -- 'trusted', 'findmyres', 'both'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.residence_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sections" ON public.residence_sections
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage sections" ON public.residence_sections
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed defaults
INSERT INTO public.residence_sections (name, slug, subtitle, display_order, color) VALUES
  ('Flats', 'FLATS', 'Pretoria West, CBD, etc', 1, 'bg-blue-500'),
  ('Communes', 'COMMUNES', 'Pretoria West, etc', 2, 'bg-emerald-500'),
  ('Rentals', 'RENTALS', 'Sunnyside, Sosha, E1', 3, 'bg-purple-500'),
  ('Private Accommodations', 'PRIVATE', 'Premium private residences', 4, 'bg-amber-500');
```

### 2. Add "Sections" tab to `AdminResidences.tsx`
Add a third tab alongside "All Residences" and "Top 30 Trusted":
- **Sections Manager**: CRUD for section tabs — add/edit/delete/reorder sections
- Each section row: name, subtitle, color picker, display order, active toggle
- Drag-to-reorder support (same pattern as TrustedResidencesEditor)

### 3. Add `section_category` selector to residence edit form
In the residence add/edit dialog within AdminResidences, add a dropdown that pulls from `residence_sections` so admin can assign any residence to a section.

### 4. Update `TrustedResidencesGrid.tsx`
- Replace hardcoded `SECTIONS` array with a fetch from `residence_sections` where `applies_to IN ('trusted', 'both')`
- Use `slug` for grouping, `name` + `subtitle` for display, `color` for styling

### 5. Update `ResidenceSectionGrid.tsx` and `FindMyRes.tsx`
- Replace hardcoded `SECTION_ORDER` and `SECTION_COLORS` with database-driven sections where `applies_to IN ('findmyres', 'both')`
- Keep campus-based fallback logic for residences without `section_category`

## Files Modified
| File | Change |
|------|--------|
| Migration SQL | Create `residence_sections` table with seed data |
| `src/pages/admin/AdminResidences.tsx` | Add "Sections" tab with CRUD manager; add section dropdown to residence form |
| `src/components/TrustedResidencesGrid.tsx` | Fetch sections from DB instead of hardcoded array |
| `src/components/ResidenceSectionGrid.tsx` | Fetch sections from DB instead of hardcoded constants |
| `src/pages/FindMyRes.tsx` | Use DB sections for `deriveSection` and section filter |

