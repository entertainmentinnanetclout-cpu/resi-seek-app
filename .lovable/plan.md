
# ResKonnect — Role-Based Dashboard System

## Implemented

### Database Roles (app_role enum)
- `admin` — CEO/Founder, God Mode (all hubs)
- `operations_lead` — Operations Lead (Operations Hub)
- `commerce_lead` — Commerce Lead (Commerce Hub)
- `growth_lead` — Growth Lead (Media Hub + Analytics)
- `system_operator` — Product/System Operator (System Hub)
- `support_agent` — Support (Limited Ops + Commerce)

### Database Function
- `get_user_staff_role(uuid)` — Returns highest-priority staff role for a user

### Role → Hub Access Mapping

| Role | Overview | Analytics | Operations | Commerce | Media | System |
|------|----------|-----------|------------|----------|-------|--------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| operations_lead | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| commerce_lead | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| growth_lead | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| system_operator | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| support_agent | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |

### Post-Login Routing
Each staff role auto-redirects to their primary hub after login.

### Assigning Roles
Use SQL or the admin Users page to assign roles:
```sql
INSERT INTO user_roles (user_id, role) VALUES ('<user-uuid>', 'operations_lead');
```
