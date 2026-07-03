# 16. API Reference (Database & RPC)

## 1. Primary RPCs (Stored Procedures)

### `has_role(_user_id, _role)`
- **Purpose**: Verify user permissions in SQL and Auth context.
- **Input**: User UUID, Role Name (`app_role` enum).
- **Return**: Boolean.

### `get_user_residence_id()`
- **Purpose**: Returns the `residence_id` linked to the current authenticated session.
- **Return**: UUID.

### `capture_referral(_code, _referred)`
- **Purpose**: Assigns a new user to a referrer code.
- **Input**: Referral Code (string), Referred User ID (UUID).

### `validate_handover_pack(_residence_id)`
- **Purpose**: Runs a data integrity check to ensure all move-in data is ready for institutional export.
- **Return**: JSON validation report.

## 2. Shared Hooks (Data Services)

### `useRealtimeResidences()`
- Fetches all active residences with real-time status updates.
- Source: `public.residences`.

### `useRealtimeApplications()`
- Fetches applications filtered by current user or residence portal scope.
- Source: `public.applications`.

### `useProfile()`
- Centralized fetch for the current user's profile and KYC status.
- Source: `public.profiles`.
