
Goal: explain exactly which role grants admin access and why you may still land on student.

1) Required role for admin access
- The app checks `staffRole` from `get_user_staff_role`.
- Any of these roles is treated as staff and allowed into admin pages:
  - `admin`
  - `operations_lead`
  - `commerce_lead`
  - `growth_lead`
  - `system_operator`
  - `support_agent`
- If `staffRole` is `null`, the user is routed to `/dashboard` (student side).

2) What I verified in your current connected backend
- `43v3r2a11@gmail.com` has role `admin` in `public.user_roles`.
- `reskonnect@gmail.com` also has role `admin`.
- `public.get_user_staff_role(...)` returns `admin` for both user IDs.

3) Why you can still land on student despite admin role existing
- Most likely causes:
  - You are logging into a different account than the one updated.
  - The app is pointed at a different backend than the one where role SQL was run.
  - Session/account mix-up (old token, different provider/account during login).

4) Fast validation SQL (run on the backend your app is actually using)
```sql
select
  u.id,
  u.email,
  array_remove(array_agg(ur.role::text), null) as roles,
  public.get_user_staff_role(u.id) as resolved_staff_role
from auth.users u
left join public.user_roles ur on ur.user_id = u.id
where lower(u.email) = lower('43v3r2a11@gmail.com')
group by u.id, u.email;
```
Expected: `roles` includes `admin` and `resolved_staff_role = 'admin'`.

5) Implementation plan to permanently prevent this confusion
- Add a small auth-debug panel (dev/admin only) showing: logged-in email, user_id, resolved `staffRole`, and active backend URL.
- Add explicit error toast on `/auth` when RPC returns null/error for a supposed staff account.
- Keep routing guard unchanged (server-backed role check remains authoritative).
