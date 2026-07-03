# Phase 1: Area 6 - Find My Res Audit

## 1. Existing Features
- **Filters**: Category (Flats, Communes, Res), Price Range, Gender, Campus, Accreditation (NSFAS/TUT).
- **Search**: Smart Search Hero with result counts.
- **Sorting**: Best Match (MatchScore), Price, Distance, Availability.
- **Comparison**: `CompareDrawer` for side-by-side residence evaluation.

## 2. Reusable Components
- `ResidencePropertyCard`: Highly optimized for marketplace display.
- `SmartSearchBar`: Unified entry for all search parameters.
- `FilterSidebar`: Collapsible sidebar for desktop; bottom sheet for mobile.

## 3. Improvements for V2
- **Dynamic Institutions**: Replace the `TUT_CAMPUSES` constant with database-driven campuses.
- **Accreditation**: Transition from `is_tut_accredited` to a multi-badge system for University/TVET accreditations.
- **Map Integration**: Visual search for students who prioritize location.
- **Distance Logic**: Dynamic distance calculation from the selected institution/campus.
