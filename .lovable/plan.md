
# Fix Plan: Applications Page, Residence Portal, and Find My Res Sorting

## Problem Summary

Three issues identified:

1. **Applications page UI not loading** - React hooks violation causing crash
2. **Residence Portal "Failed to send request to Edge Function"** - Edge function wasn't deployed (now fixed), but CORS headers may need adjustment
3. **Find My Res sorting not working** - Sorting dropdown not connected to state

---

## Issue 1: Applications Page Crash

### Root Cause

The component has an **early return before hooks are called**:

```tsx
// Lines 23-27 in Applications.tsx
const Applications = () => {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;  // EARLY RETURN
  const { user } = useAuth();    // HOOK AFTER CONDITIONAL - VIOLATION!
  // ...
```

React's rules of hooks require all hooks to be called unconditionally in the same order. When `shouldBlock` is true, the hooks after the return don't run, and when it changes, React gets confused about hook order.

### Fix

Move ALL hooks before any conditional returns:

```tsx
const Applications = () => {
  // ALL hooks first
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const { applications, loading: applicationsLoading, error } = useRealtimeApplications(user);
  const [detailedApplications, setDetailedApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [userDocuments, setUserDocuments] = useState<UserDocument[]>([]);

  // ... useEffect hooks ...

  // NOW safe to return early
  if (shouldBlock) return null;

  // Rest of component
```

---

## Issue 2: Residence Portal Edge Function Error

### Root Cause

The edge function `create-residence-portal-user` was not deployed. I've now deployed it and verified it responds (returns 401 without auth, which is correct).

### Verification

The function is now live and will work when called with proper admin authentication.

### Additional Hardening

Update the CORS headers to ensure browser preflight works:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

---

## Issue 3: Find My Res Sorting Not Working

### Root Cause

The sorting dropdown exists but isn't connected to state:

```tsx
// Line 440 - NOT connected to sortBy state
<Select defaultValue="price-asc">
```

It should be:

```tsx
<Select value={sortBy} onValueChange={setSortBy}>
```

The `sortBy` state exists (line 92) and the sorting logic exists in `filteredAndSortedResidences` useMemo (lines 199-215), but the UI doesn't update the state.

### Fix

1. Change `defaultValue` to `value={sortBy}`
2. Add `onValueChange={setSortBy}`
3. Add visual indicator showing current sort

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Applications.tsx` | Move hooks before conditional return |
| `src/pages/FindMyRes.tsx` | Fix hooks order + connect sorting dropdown to state |
| `supabase/functions/create-residence-portal-user/index.ts` | Update CORS headers (optional hardening) |

---

## Technical Details

### Applications.tsx Changes

**Before (problematic):**
```tsx
const Applications = () => {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;
  const { user } = useAuth();
  const { applications, loading: applicationsLoading, error } = useRealtimeApplications(user);
  const [detailedApplications, setDetailedApplications] = useState<any[]>([]);
  // ...more hooks
```

**After (correct):**
```tsx
const Applications = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const { applications, loading: applicationsLoading, error } = useRealtimeApplications(user);
  const [detailedApplications, setDetailedApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [userDocuments, setUserDocuments] = useState<UserDocument[]>([]);

  // useEffect hooks here...

  if (shouldBlock) return null;
  
  // rest of component...
```

### FindMyRes.tsx Changes

**Before (lines 74-80):**
```tsx
const FindMyRes = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const navigate = useNavigate();
  if (shouldBlock) return null;
  const { profile } = useRealtimeProfile(user);
  const { applications } = useRealtimeApplications(user);
```

**After:**
```tsx
const FindMyRes = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile } = useRealtimeProfile(user);
  const { applications } = useRealtimeApplications(user);
  // ... all useState hooks ...

  // Early return AFTER all hooks
  if (shouldBlock) return null;
```

**Fix sorting dropdown (around line 440):**

**Before:**
```tsx
<Select defaultValue="price-asc">
```

**After:**
```tsx
<Select value={sortBy} onValueChange={setSortBy}>
```

---

## Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Applications page crash | React hooks after conditional return | Move all hooks before return |
| Edge function error | Function not deployed | Deployed (done) + CORS update |
| Sorting not working | Dropdown not connected to state | Add `value` and `onValueChange` props |

All three issues have clear, targeted fixes that won't require extensive refactoring.
