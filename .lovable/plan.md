

# Make All UI Slider Images Admin-Manageable

## Problem
Three pages have **hardcoded carousel slides** with imported local images that bypass the Admin Media Hub:

1. **Landing Page** (`Landing.tsx`): 4 fallback slides (campusDinokeng, artsFestival, studentStudying, studentsCelebration) — only used when DB is empty
2. **Student Dashboard** (`Dashboard.tsx`): 2 hardcoded slides (heroAccommodation, Unsplash URL) — never fetches from DB
3. **Campus News** (`CampusNews.tsx`): 2 fallback slides (artsFestival, heitaMagazine) — only used when DB is empty

The admin can only manage `hero_slides` in the Media Hub. Dashboard slides and fallback slides are invisible to admin.

## Solution

### 1. Make Dashboard use database slides (like Landing page already does)
Change `Dashboard.tsx` to use `<HeroCarousel useDatabase={true} />` with the same `hero_slides` table, keeping the current hardcoded slides as fallbacks only.

### 2. Add a "Dashboard Slides" category to `hero_slides`
Add a `slide_location` column (`text`, default `'landing'`) to `hero_slides` so admin can assign slides to specific pages: `landing`, `dashboard`, `news`, or `all`.

### 3. Update Admin Media Hub Slides tab
- Add a `slide_location` selector in the slide form (Landing / Dashboard / News / All)
- Show location badges on each slide card so admin sees where each slide appears
- Group/filter slides by location

### 4. Update HeroCarousel to filter by location
Pass a `location` prop to `HeroCarousel` so it fetches only slides matching that location (or `'all'`).

### 5. Seed existing hardcoded images into the database
Insert the current fallback slides as actual `hero_slides` records with appropriate `slide_location` values, so they appear in admin and can be edited/replaced.

## Database Migration
```sql
ALTER TABLE public.hero_slides 
  ADD COLUMN slide_location text NOT NULL DEFAULT 'landing';

-- Seed dashboard slides from current hardcoded values
INSERT INTO public.hero_slides (title, description, image_url, cta_text, cta_link, display_order, is_active, slide_location) VALUES
  ('Find Your Perfect Res', 'Discover comfortable, affordable student accommodation near your campus', '/assets/hero-accommodation.jpg', 'Browse Residences', '/findmyres', 0, true, 'dashboard'),
  ('Student Grocery Discounts', 'Save up to 30% on grocery hampers specially curated for students', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=600&fit=crop', 'Get Discounts', '/marketplace?tab=deals', 1, true, 'dashboard');
```

## Files Modified
| File | Change |
|------|--------|
| Migration SQL | Add `slide_location` column, seed dashboard slides |
| `src/components/HeroCarousel.tsx` | Add `location` prop, filter query by `slide_location` |
| `src/pages/Dashboard.tsx` | Use `<HeroCarousel useDatabase location="dashboard" />`, keep hardcoded as fallback |
| `src/pages/Landing.tsx` | Pass `location="landing"` to HeroCarousel |
| `src/pages/CampusNews.tsx` | Pass `location="news"` to HeroCarousel |
| `src/pages/admin/AdminSlides.tsx` | Add location selector to form, show location badges, add filter dropdown |

