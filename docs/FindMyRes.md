# FindMyRes Page: Developer Documentation

This document provides a detailed explanation of the data fetching and filtering logic implemented in the `FindMyRes` component (`src/pages/FindMyRes.tsx`).

## 1. Data Fetching and Real-time Synchronization

The component fetches its primary data from the `residences` table in the Supabase database. This process is handled within a `useEffect` hook that runs once when the component is first mounted.

### Initial Data Load

- **Function**: An anonymous `async` function `fetchResidences` is called inside the main `useEffect` hook.
- **Query**: It executes `supabase.from('residences').select('*')` to retrieve all columns for all entries in the `residences` table.
- **State Management**:
  - The fetched data is stored in the `residences` state variable using `setResidences(data)`.
  - A `loading` state is set to `true` before the fetch begins and `false` once it completes, whether it succeeds or fails.
- **Error Handling**: Any error thrown by the Supabase query is caught, logged to the console, and displayed to the user via a toast notification.

### Real-time Updates

- **Subscription**: The component subscribes to the `residences-changes` channel using `supabase.channel('residences-changes')`.
- **Events**: It listens for all (`*`) changes (INSERT, UPDATE, DELETE) on the `public.residences` table.
- **State Synchronization**:
  - **INSERT**: The new record (`payload.new`) is appended to the `residences` state array.
  - **UPDATE**: The corresponding residence in the `residences` array is updated with the new data (`payload.new`).
  - **DELETE**: The deleted residence is removed from the `residences` array based on its ID (`payload.old.id`).
- **Cleanup**: The subscription is removed when the component unmounts to prevent memory leaks.

## 2. Filtering Logic

The filtering logic is handled by a separate `useEffect` hook that depends on the `residences` state and all filter-related state variables (`searchQuery`, `priceRange`, etc.). This ensures the displayed list of residences is re-evaluated whenever the source data or any filter criteria change.

### Featured Residences

- Before any filtering is applied, the component identifies and separates "featured" residences.
- These are residences where the `featured` boolean is `true`.
- They are sorted by `display_order` and limited to the top 5.
- The result is stored in the `featuredResidences` state variable and rendered in a separate "Top Priority" section.

### Filtering Pipeline

The component applies a series of filters sequentially to the main `residences` array.

1.  **Search Query**: Filters residences based on a text search. It checks for a case-insensitive match in the `name`, `address`, and `description` fields.
2.  **Price Range**: Filters by price. The `priceRange` string (e.g., "2500-3500") is parsed into minimum and maximum values.
3.  **Distance from Campus**: Filters by distance. Similar to the price range, it parses a string to determine the min/max distance.
4.  **Room Type**: Filters for an exact match on the `room_type` field.
5.  **Campus**: Filters for an exact match on the `campus` field.
6.  **Amenities**: Filters residences to ensure they contain *all* selected amenities. It checks if the residence's `amenities` array includes every item from the `selectedAmenities` state.

The final, filtered array is stored in the `filteredResidences` state variable, which is then used to render the main list of accommodations.
