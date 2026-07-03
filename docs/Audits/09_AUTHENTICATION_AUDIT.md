# Phase 1: Area 9 - Authentication Audit

## 1. Role System (`user_roles`)
- **Student**: Default role.
- **Admin**: Global platform staff.
- **Specialist**: Scoped leads (Operations, Media, etc.).
- **Residence Admin**: Linked to a specific property via `residence_portal_accounts`.

## 2. Role Routing
- Handled in `App.tsx` and the `AuthContext`.
- **First Login Flow**: Currently minimal. V2 needs a "Setup Profile" requirement for students and a "Setup Residence" requirement for portal users.

## 3. Permissions
- **RPC `has_role`**: Centralized logic for role checks.
- **Password Reset**: Standard Supabase Auth flow.
- **Session Management**: 2-hour timeout (standard Supabase JWT).

## 4. Improvements
- **Staff Role Scoping**: More granular permissions for department leads to prevent cross-hub interference.
- **Onboarding Progress**: Tracker to ensure profile is 100% complete before applying.
