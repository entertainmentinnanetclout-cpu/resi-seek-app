# Phase 1: Area 3 - Dashboard Audit

## 1. God Mode & Specialist Hubs
| Hub | Current Functionality | Broken/Stub | Improvements |
|-----|-----------------------|-------------|--------------|
| **Operations** | Residences, Portals, Applications, Users, Follow-up. | None identified. | Merge Follow-up into Application Timeline. |
| **Media** | News, Events, Slides, Bursaries. | None. | Add rich-text editor for news. |
| **Commerce** | Stores, Products, Marketplace Orders. | **Paused.** | Redesign moderation queue. |
| **System** | Health, WIL, WhatsApp, Settings. | Alerts logic. | Centralized Error Log view. |

## 2. Residence Portal
- **Implemented**: Application list, Status updates, Document review, Analytics.
- **Duplicate**: Some document review logic mirrors the Admin Hub.
- **Missing Enterprise**:
  - Room management (assignment).
  - Bulk application status updates.
  - Automated lease generation.

## 3. Student Dashboard
- **Implemented**: Application tracker, Favorites, Recommended res, Notifications.
- **Improvements**:
  - Personalized news feed based on institution.
  - "Residency Status" card for move-in confirmed students.

## 4. Reusable Dashboard Components
- `AdminLayout`: Standardized navigation shell.
- `QuickActionCard`: Grid of shortcut buttons.
- `StatCard`: Standardized metric display.
- `SectionsManager`: Generic hierarchical data editor (Residences -> Sections).
