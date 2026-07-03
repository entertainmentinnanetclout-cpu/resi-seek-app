# 06. Role & Permission Model

## 1. App Roles (`app_role` Enum)
| Role | Level | Description |
|------|-------|-------------|
| `admin` | 100 | Full platform control. Bypass RLS. |
| `operations_lead` | 80 | Manage residences and applications. |
| `commerce_lead` | 80 | Manage marketplace and commerce. |
| `growth_lead` | 80 | Manage news, events, and content. |
| `system_operator` | 80 | View-only access to system health and logs. |
| `residence_portal`| 50 | Scoped to a specific residence. |
| `student` | 10 | Standard user. Access to own data only. |

## 2. Role Verification (RPC)
The `has_role(uid, role)` RPC is the source of truth for authorization in both SQL and Frontend.

## 3. Scoped Permissions
### Residence Portal Access
Determined by `is_authorized_residence_user(res_id)`. This checks if the `auth.uid()` is linked to the `residence_id` in the `residence_portal_accounts` table.

## 4. Permission Review
Annual audit of role assignments is required to ensure no stale admin access exists.
