

# Update KNOWLEDGE_BASE.md — Current State Refresh

## Sections to Update

### 1. Section 5: Authentication & Authorization
**Current state**: Only lists `student` and `admin` roles. No mention of staff roles, `get_user_staff_role` RPC, public access strategy, or `StudentRoute`/`AdminRoute` guard components.

**Update to**:
- Add full staff role table: `admin`, `operations_lead`, `commerce_lead`, `growth_lead`, `system_operator`, `support_agent`
- Document `get_user_staff_role` RPC and priority order
- Replace route guard examples with current `StudentRoute`, `AdminRoute` pattern
- Add **Public Access Strategy** subsection: browse pages are public, actions gate with `/auth?returnTo=`

### 2. New Section: Company Structure & Staff Roles (insert after Auth, before Core Features)
Add the 6-person operating structure:

| Role | Hub Access | Responsibilities |
|------|-----------|-----------------|
| CEO/Founder | All Hubs (God Mode) | Partnerships, product direction, revenue strategy |
| Operations Lead | Operations Hub | Residence onboarding, applications, placements |
| Commerce Lead | Commerce Hub | Marketplace, hampers, discounts, orders |
| Growth Lead | Media Hub + Analytics | User acquisition, content, campus activations |
| System Operator | System Hub | Technical stability, migrations, edge functions |
| Support Agent | Limited Ops + Orders | WhatsApp support, basic application help |

### 3. New Section: Admin Hub Architecture (replace old admin references in Core Features)
Document the 4-hub layout:

- **Operations Hub** (`/admin/operations`): Residences, Portals, Applications, Follow-Up, Documents, Users
- **Commerce Hub** (`/admin/commerce`): Marketplace, Stores, Discounts, Discount Orders, Hamper Items
- **Media Hub** (`/admin/media`): Hero Slides, News, Events, Bursaries
- **System Hub** (`/admin/system`): WIL, WhatsApp Templates, System Status, Settings

Sidebar: Overview, Analytics, + 4 Hubs (6 items total)

### 4. Section 4: Database Schema — user_roles update
Change `user_roles` description from "Role assignments (admin/student)" to list all 6 staff roles plus the `app_role` enum.

### 5. Header metadata
Update "Last Updated" to March 2026, version to 3.0.

### 6. Roadmap
Mark completed items: public access strategy, hub architecture, role-based dashboards.

## File Modified
| File | Change |
|------|--------|
| `KNOWLEDGE_BASE.md` | Rewrite sections 5, add sections 5.5 and 6.9, update section 4 supporting tables, update header and roadmap |

