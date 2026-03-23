# Fix: Restore Admin Role for [43v3r2a11@gmail.com](mailto:43v3r2a11@gmail.com)

## Problem

The user `43v3r2a11@gmail.com` (user_id: `cbdb123f-d3bb-4a10-8144-670cc594ef95`) currently has only the `student` role. They should have `admin` only.

## Fix

Single data operation via the insert tool:

1. Delete the `student` role row for this user
2. Insert the `admin` role

```sql
DELETE FROM user_roles WHERE user_id = 'cbdb123f-d3bb-4a10-8144-670cc594ef95' AND role = 'student';
INSERT INTO user_roles (user_id, role) VALUES ('cbdb123f-d3bb-4a10-8144-670cc594ef95', 'admin') ON CONFLICT DO NOTHING;
```

No code changes needed. After this, the user will be routed to `/admin` on login as expected. also provide rerunnable sql for external supabase to ensure thats also inplace