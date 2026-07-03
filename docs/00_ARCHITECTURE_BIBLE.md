# 00. Architecture Bible (Version 2.0)

**Released**: 23 March 2026
**Status**: Authoritative Reference

---

## Master Index
1. [Architecture Bible (00)](./00_ARCHITECTURE_BIBLE.md)
2. [Business Architecture (01)](./01_BUSINESS_ARCHITECTURE.md)
3. [Database Standards (02)](./02_DATABASE_STANDARDS.md)
4. [SQL Migration Standard (03)](./03_SQL_MIGRATION_STANDARD.md)
5. [UI Design System (04)](./04_UI_DESIGN_SYSTEM.md)
6. [Security & RLS (05)](./05_SECURITY_AND_RLS.md)
7. [Role & Permission Model (06)](./06_ROLE_PERMISSION_MODEL.md)
8. [Deployment & Disaster Recovery (07)](./07_DEPLOYMENT_PLAYBOOK.md)
9. [Testing Standard (08)](./08_TESTING_STANDARD.md)
10. [Backend Provider Strategy (09)](./09_BACKEND_PROVIDER_STRATEGY.md)
11. [Product Roadmap (10)](./10_PRODUCT_ROADMAP.md)
12. [System Manual (11)](./11_SYSTEM_MANUAL.md)
13. [Component Registry (12)](./12_COMPONENT_REGISTRY.md)
14. [Database Relationships (13)](./13_DATABASE_RELATIONSHIPS.md)
15. [Test Scenarios (14)](./14_TEST_SCENARIOS.md)
16. [System Map (15)](./15_SYSTEM_MAP.md)
17. [API Reference (16)](./16_API_REFERENCE.md)
18. [Edge Function Reference (17)](./17_EDGE_FUNCTION_REFERENCE.md)
19. [RLS Reference (18)](./18_RLS_REFERENCE.md)
20. [Storage Reference (19)](./19_STORAGE_REFERENCE.md)
21. [Admin Manual (20)](./20_ADMIN_MANUAL.md)
22. [Residence Admin Manual (21)](./21_RESIDENCE_ADMIN_MANUAL.md)
23. [Student User Manual (22)](./22_STUDENT_USER_MANUAL.md)
24. [Changelog (23)](./23_CHANGELOG.md)
25. [Known Issues (24)](./24_KNOWN_ISSUES.md)
26. [Release Checklist (25)](./25_RELEASE_CHECKLIST.md)

---

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
