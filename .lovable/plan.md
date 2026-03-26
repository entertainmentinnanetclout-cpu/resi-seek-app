

# Rebuild FindMyRes as a High-Conversion Student Housing Decision Engine

## Overview
Complete rewrite of `FindMyRes.tsx` from a basic listings page into a Property24/Amberstudent-inspired smart matching system with persistent sidebar filters, real-time availability, match scoring, and optimized property cards. The ResidenceDetail page gets upgraded with a proper gallery, pricing breakdown, and "Similar Residences" section.

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│  Smart Search Bar (Campus, Budget, Room Type, NSFAS)    │
├──────────────┬──────────────────────────────────────────┤
│  Filter      │  Results Grid                            │
│  Sidebar     │  ┌──────┐ ┌──────┐ ┌──────┐             │
│  (desktop)   │  │ Card │ │ Card │ │ Card │             │
│              │  └──────┘ └──────┘ └──────┘             │
│  - Campus    │  ┌──────┐ ┌──────┐ ┌──────┐             │
│  - Distance  │  │ Card │ │ Card │ │ Card │             │
│  - Price     │  └──────┘ └──────┘ └──────┘             │
│  - Section   │                                          │
│  - Room Type │  Sort: Price | Distance | Match Score    │
│  - NSFAS     │  Results count + active filter chips     │
│  - Avail.    │                                          │
├──────────────┴──────────────────────────────────────────┤
│  Mobile: Bottom sheet filter drawer                     │
└─────────────────────────────────────────────────────────┘
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/FindMyRes.tsx` | **Full rewrite** | Two-column layout, smart search hero, sidebar filters, grid results |
| `src/components/findmyres/SmartSearchBar.tsx` | **Create** | Guided search: campus, budget slider, room type, NSFAS toggle |
| `src/components/findmyres/FilterSidebar.tsx` | **Create** | Desktop sidebar with all filter controls + price/distance sliders |
| `src/components/findmyres/FilterBottomSheet.tsx` | **Create** | Mobile bottom sheet version of filters |
| `src/components/findmyres/ResidencePropertyCard.tsx` | **Create** | Property24-style card with availability badge, match score, image |
| `src/components/findmyres/ActiveFilterChips.tsx` | **Create** | Removable filter chips showing active filters |
| `src/pages/ResidenceDetail.tsx` | **Enhance** | Better gallery, pricing breakdown, "Similar Residences" carousel, block apply when FULL |
| `src/hooks/useResidenceFilters.ts` | **Create** | Centralized filter state + memoized filtering logic |

## Detailed Plan

### 1. Smart Search Bar (`SmartSearchBar.tsx`)
- Hero section with 4 guided inputs in a single row (desktop) / stacked (mobile):
  - Campus dropdown (from `TUT_CAMPUSES`)
  - Budget range dual slider (R1,000 - R10,000)
  - Room type toggle (Single / Sharing / Any)
  - NSFAS toggle switch
- "Search" button applies all at once
- Results count shown: "Showing X of Y residences"

### 2. Filter Sidebar (`FilterSidebar.tsx`)
Desktop: sticky left sidebar (w-72). Filters:
- **Campus** — checkbox list from `TUT_CAMPUSES`
- **Distance** — range slider (0-10km) using Slider component
- **Price Range** — dual-thumb slider (R1,000 - R10,000)
- **Section Category** — checkbox list from `residence_sections` DB table
- **Room Type** — checkbox list (Single, Sharing, Bachelor, Studio)
- **NSFAS Accredited** — toggle (filters `is_trusted = true` as proxy)
- **Availability** — radio: All / Available Only / Few Spots Left
- **Amenities** — expandable checkbox list
- All filters apply instantly (no submit button, reactive via state)
- "Clear All" button

### 3. Mobile Filter Bottom Sheet (`FilterBottomSheet.tsx`)
- Sheet component triggered by floating filter button
- Same filter controls as sidebar
- "Show X Results" sticky button at bottom
- Filter count badge on trigger button

### 4. Property Cards (`ResidencePropertyCard.tsx`)
Each card (grid layout, 3 cols desktop, 2 tablet, 1 mobile):
- Large image (aspect-video, lazy loaded with `loading="lazy"`)
- **Availability badge** (top-right):
  - Green "Available" when spots > 5
  - Yellow "Few Spots" when spots 1-5
  - Red pulsing "FULL" when spots = 0
- Price bold: `R{price}/mo`
- Distance: `{distance}km from {campus}`
- Room types as small badges
- "Singles Available" green indicator (from `room_types` array)
- **Match score** (optional): calculated from user's search criteria match %
- Favorite button + WhatsApp button overlay
- Click navigates to `/res/{id}`
- **Disable "Apply Now" when FULL** — show "Fully Booked" greyed out

### 5. Match Score Calculation
Client-side scoring based on active filters:
- Campus match: +30%
- Price within budget: +25%
- Room type match: +20%
- Distance within range: +15%
- Has requested amenities: +10%
- Display as circular badge on card when filters are active

### 6. Results Area
- Top bar: result count, sort dropdown, grid/list toggle
- Active filter chips (removable)
- Infinite scroll or "Load More" (groups of 20)
- Empty state with illustration

### 7. ResidenceDetail Page Upgrades
- Block apply button when `available_spots === 0` (already partially done, enforce consistently)
- "Similar Residences" section at bottom (already fetches related by campus — enhance with cards)
- Pricing breakdown card: monthly rent, deposit info if available
- Verified/accredited badges more prominent

### 8. Shortlist / Favorites
Already implemented via `FavoriteButton` + `favorites` table. No changes needed — integrated into new cards.

### 9. Real-time Availability
- Use existing Supabase realtime subscription on `residences` table
- Subscribe to changes on the FindMyRes page to auto-update `available_spots`
- Already have `useRealtimeResidences` hook — integrate it

### 10. Performance
- `loading="lazy"` on all card images
- Memoize filtered results with `useMemo`
- Virtualize list if > 50 results (optional, defer)

### 11. No SQL Changes Needed
All required DB columns already exist:
- `available_spots`, `distance_from_campus`, `price`, `campus`, `room_type`, `room_types`, `section_category`, `is_trusted`, `amenities`, `image_url`, `images`
- `residence_sections` table already exists for section categories
- `favorites` table already exists for shortlisting
- RLS policies already in place

The existing schema fully supports all filter requirements. No migration needed.

## Technical Details
- Slider component already exists at `src/components/ui/slider.tsx`
- Sheet component exists at `src/components/ui/sheet.tsx`
- All campus values from `src/lib/campuses.ts`
- Filters are pure client-side on already-fetched data (residences table is small enough)
- Realtime via `useRealtimeResidences` hook for live availability updates

