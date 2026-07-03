# ResKonnect Enterprise Architecture Bible (Version 2.0)

**Authoritative Reference & Technical Source of Truth**

---

## 1. Executive Summary
ResKonnect is a South African digital ecosystem designed to unify student accommodation, campus services, and the student economy. Version 2.0 represents the transition from a TUT-focused tool to a nationwide, institution-agnostic enterprise platform.

---

## 2. Business Architecture
The platform operates as a multi-layered service provider connecting students, property managers, and educational institutions.

### 2.1 Role Hierarchy & Responsibilities
| Role | Responsibility | Primary Dashboard |
|------|----------------|-------------------|
| **Super Admin** | Platform-wide oversight, system configuration, revenue management. | God Mode (Admin) |
| **Operations Lead** | Managing residences, application flows, and manual follow-ups. | Operations Hub |
| **Commerce Lead** | Marketplace moderation, store approvals, and order tracking. | Commerce Hub |
| **Growth Lead** | News, events, bursaries, and marketing content management. | Media Hub |
| **System Operator** | Backend health, error logs, and integration monitoring. | System Hub |
| **Residence Admin** | Managing applications, documents, and residents for a specific property. | Residence Portal |
| **Student** | Browsing, applying, document management, and marketplace usage. | Student Dashboard |

---

## 3. Technical Architecture
ResKonnect utilizes a modern, hybrid serverless stack optimized for rapid scaling and low latency.

### 3.1 Stack Overview
- **Frontend**: Vite + React + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend-as-a-Service**: Supabase (Auth, DB, Storage, Realtime).
- **Compute**: Supabase Edge Functions (Deno).
- **State Management**: React Query (Server-state) + Context API (Global UI state).
- **Deployment**: Lovable Cloud (Frontend & Edge Functions) + External Supabase (Production Data).

### 3.2 The Hybrid Backend Pattern
Due to the hard-pinned client architecture, all edge functions are hosted on a Lovable gateway.
- **Client Call**: `src/lib/lovableFunctions.ts` -> `invokeEdgeFunction`.
- **Authentication**: External Supabase JWT is forwarded to Lovable Functions for identity verification.

---

## 4. Database Architecture
Mastering relationships and enforcing integrity through RLS.

### 4.1 Master Entities
- `profiles`: The central user record.
- `residences`: The core property entity, linked to institutions via `institution_tags`.
- `applications`: The transactional record linking students to residences.
- `referral_codes`: The engine for the affiliate system.

### 4.2 Standards
- **Soft Deletes**: Use `is_active` flags instead of `DELETE` where historical data matters.
- **Naming**: `snake_case` for tables/columns; `camelCase` for JSON keys.
- **Integrity**: Every public table must have RLS enabled and specific policies for `admin` vs `student`.

---

## 5. Platform Services (Shared Services)

### 5.1 Notifications
A unified notification engine using the `notifications` table and `send-push` edge function.

### 5.2 Document Management
Path-based storage in private buckets (`documents`, `application-documents`, `wil-documents`). RLS restricts access to the owner and the assigned residence admin/platform admin.

### 5.3 Authentication
Supabase Auth with role-based routing. The `user_roles` table acts as the authoritative permission source via the `has_role` RPC.

---

## 6. User Journey Maps

### 6.1 The Student Journey
1. **Discovery**: Lands via SEO or Referral -> Browses Find My Res (University/TVET/Private).
2. **Onboarding**: Signs up -> `localStorage` referral captured -> Profile setup.
3. **Action**: Applies to residences -> Uploads required documents -> Tracks status in Dashboard.
4. **Residency**: Receives approval -> Views booking slip -> Communicates via Inbox.

### 6.2 The Residence Admin Journey
1. **Provisioning**: Created by Super Admin -> Receives portal credentials.
2. **Management**: Logs in to Residence Portal -> Views real-time application list.
3. **Operations**: Reviews documents -> Updates status -> Exports Handover Pack for university submission.

### 6.3 The Landlord/Partner Journey
1. **Inquiry**: Lands on "List Your Property" -> Submits `landlord_applications`.
2. **Vetting**: Staff reviews application -> Conducts verification.
3. **Onboarding**: Residence record created -> Portal access granted to owner/manager.

---

## 7. Operational Workflows

### 7.1 Accommodation Application Flow
- **Trigger**: Student clicks "Apply" on `ResidenceDetail`.
- **Validation**: Check profile completeness -> Check availability.
- **Persistence**: Insert to `applications` (status: `submitted`).
- **Notification**: Notify Residence Admin (Push/Email) -> Log in `application_activity_log`.

### 7.2 Referral Attribution Flow
- **Capture**: `?ref=X` -> `localStorage.pending_ref`.
- **Sign-up**: User registers -> `capture_referral` RPC called -> `referral_earnings` (signup bonus).
- **Conversion**: User pays (EFT/Yoco) -> `capture_referral_sale` RPC called -> `referral_earnings` (percentage commission).

### 7.3 Accreditation Workflow
- **Application**: Residence applies for accreditation (NSFAS/Institution).
- **Verification**: Admin reviews via `AdminLandlordApplications`.
- **Update**: `residences.institution_tags` updated -> Accreditation badge appears on card.

---

## 8. Security & Permission Model

### 8.1 RBAC Implementation
Access is controlled via the `user_roles` table.
- **Admin**: `has_role(uid, 'admin')` allows full bypass of most table RLS.
- **Specialists**: `operations_lead`, `commerce_lead`, etc., grant access to specific hub pages.
- **Residence Portal**: `is_authorized_residence_user(res_id)` restricts data to a specific residence.

### 8.2 Security Directives
- **Direct DB access**: Restricted to the Supabase Client. No client-side secret exposure.
- **Data Isolation**: Students can only `SELECT` their own records (profiles, applications, documents).
- **Sensitive Storage**: Buckets for ID documents and payments must be private with path-based RLS: `(storage.foldername(name))[1] = auth.uid()::text`.

---

## 9. Scalability & Coding Standards

### 9.1 Scalability Standards
- **Institution-Agnosticism**: Never hardcode an institution name. Use `institution_id` or `institution_tags`.
- **Geographic Flexibility**: Support Provinces and Cities via normalized lookups.
- **Real-time Performance**: Use Supabase Realtime sparingly; prefer React Query for polling/revalidation where instant sync isn't critical.

### 9.2 Coding Standards (Permanent Rules)
1. **Audit First → Reuse Second**: Always check for an existing component before creating a new one.
2. **Edit Source, Not Artifacts**: Never edit `dist/` or bundled files.
3. **Idempotent SQL**: Migrations must be re-runnable without errors (e.g., `CREATE TABLE IF NOT EXISTS`).
4. **No Destructive SQL**: Never `DROP` columns or tables unless part of a planned breaking migration.
5. **Documentation Requirements**: Every significant feature must include a markdown report in `docs/`.

---

## 10. Implementation Roadmap (V2 Upgrade)

### Phase 1: The Agnostic Foundation (Month 1)
- **Objective**: Decouple from TUT and enable nationwide listings.
- **Key Tasks**:
  - Migrate `campuses.ts` to DB tables (`institutions`, `campuses`).
  - Refactor `AudienceSelector` and `SmartSearchBar` for dynamic institutions.
  - Implement dynamic SEO landing pages for all 9 provinces.
- **Testing**: Role testing for multiple institutions.

### Phase 2: Enterprise Operations (Month 2)
- **Objective**: Empower Residence Managers and Platform Staff.
- **Key Tasks**:
  - Add Room Allocation and Lease Management to the Residence Portal.
  - Implement Admin Audit Logs and System Health Monitoring.
  - Enhance the Application Tracker with "Next Steps" timelines.
- **Testing**: Stress test application batch processing.

### Phase 3: Growth & Affiliate Ecosystem (Month 3)
- **Objective**: Automate referrals and scale student economy features.
- **Key Tasks**:
  - Referral V2: Professional Dashboard and automated withdrawal requests.
  - Resume Commerce Hub: Secure payment verification and store moderation.
  - Cross-platform API readiness: Formalize the REST schema for mobile app developers.
- **Testing**: End-to-end referral commission verification.
