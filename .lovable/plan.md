

# Fix: Missing `/auth` Route in App.tsx

## Root Cause
The `/auth` route was accidentally removed from `App.tsx` during the public routes reorganization. Any navigation to `/auth` (login, signup, redirects from protected routes) hits the `*` catch-all and shows the 404 page.

## Fix

### File: `src/App.tsx`

Add the missing auth route back into the public routes section:

```tsx
<Route path="/auth" element={<Auth />} />
```

Place it right after the landing route (`/`) and before the other public browse routes. Also add `/terms` and `/privacy` routes if missing.

One line addition. No other changes needed.

