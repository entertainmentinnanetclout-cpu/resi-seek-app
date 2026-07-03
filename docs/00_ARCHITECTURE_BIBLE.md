# 00. Architecture Bible

## 1. Enterprise Domain Model
ResKonnect is organized into core business domains. Every new feature or entity must belong to exactly one domain.

### Core Domains
- **Identity & Access**: Auth, roles, permissions, profile management.
- **Student Services**: Bursary finder, roommate finder, news, events.
- **Accommodation**: Buildings, floors, rooms, availability, pricing.
- **Institutions**: University, TVET, and Private College records & campuses.
- **Accreditation**: Verification of residences by NSFAS or Institutions.
- **Applications**: The transactional flow from student to residence.
- **CRM**: Communication logs, student follow-ups, and support.
- **Documents**: File storage, verification, and sharing.
- **Notifications**: In-app, push, and future SMS/WhatsApp alerts.
- **Referrals**: Affiliate links, tracking, and commission management.
- **Analytics**: Performance tracking, vacancy stats, and user behavior.
- **Finance**: Payments (EFT/Yoco), payouts, and revenue tracking.
- **Integrations**: External API bridges and third-party services.
- **Media**: Hero slides, news articles, and brand assets.
- **System Administration**: Health monitoring, logs, and global settings.
- **Commerce (Paused)**: Marketplace, stores, and order management.

## 2. Pre-Development Audit (Phase 1)
This Bible is informed by a comprehensive architectural audit:
- [Area 1: Project Structure Audit](./Audits/01_PROJECT_STRUCTURE.md)
- [Area 2: UI Audit](./Audits/02_UI_AUDIT.md)
- [Area 3: Dashboard Audit](./Audits/03_DASHBOARD_AUDIT.md)
- [Area 4: Database Audit](./Audits/04_DATABASE_AUDIT.md)
- [Area 5: Backend Audit](./Audits/05_BACKEND_AUDIT.md)
- [Area 6: Find My Res Audit](./Audits/06_FIND_MY_RES_AUDIT.md)
- [Area 7: Residence Portal Audit](./Audits/07_RESIDENCE_PORTAL_AUDIT.md)
- [Area 8: Applications Audit](./Audits/08_APPLICATIONS_AUDIT.md)
- [Area 9: Authentication Audit](./Audits/09_AUTHENTICATION_AUDIT.md)
- [Area 10: Admin Audit](./Audits/10_ADMIN_AUDIT.md)

## 3. Design Principles
- **Agnostic First**: Data over hardcoding. Support any institution by adding a record, not a page.
- **Provider Abstraction**: UI depends on Services, not directly on Supabase.
- **Security by Default**: RLS on every table; path-based RLS on every bucket.
- **Auditability**: Changes to critical entities must be logged in `application_activity_log` or `system_events`.

## 3. Technology Stack
- **Frontend**: Vite + React + TypeScript + Tailwind.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).
- **Compute**: Lovable-hosted Edge Functions (Deno).
- **Realtime**: PostgreSQL Replication for critical UI updates.
