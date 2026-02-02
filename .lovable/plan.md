
# ResKonnect GOD MODE Upgrade Plan

## Executive Summary

This plan addresses 6 major requirements:
1. **Exact application date visibility** on admin dashboard
2. **Branded handover pack** (ZIP + summary PDF) for admin
3. **Branded booking slip** for students (with accommodation info + QR code)
4. **Find My Res page sections** with auto + manual residence grouping
5. **Residence portal creation fix** (edge function deployment)
6. **Master SQL script** for external Supabase compatibility

---

## Part 1: Admin Dashboard - Exact Application Dates

### Current State
- The `applications` table has `application_date` column
- Admin pages display dates but may truncate time information

### Changes Required

**File: `src/pages/admin/AdminApplications.tsx`**
- Update table header from "Date" to "Applied"
- Show full date + time (e.g., "15 Jan 2026, 14:32")
- Add a "Days Ago" indicator for quick reference

**File: `src/pages/admin/AdminFollowUp.tsx`**
- Already shows `applicationDate` - will ensure time is visible
- Add column for exact timestamp

---

## Part 2: Admin Handover Pack (ZIP + Summary PDF)

### New Edge Function: `download-handover-pack`

**File: `supabase/functions/download-handover-pack/index.ts`**

This function will:
1. Accept `residence_id` OR array of `application_ids`
2. Verify admin authorization
3. For each application:
   - Fetch application data + student profile
   - Fetch all documents from `documents` table (user's uploaded docs)
   - Fetch all application-specific docs from `application_documents` table
4. Generate standardized filenames using the pattern:
   - `{ResidenceSlug}_{StudentName}_{RefCode}_{DocType}_{Date}.{ext}`
5. Create a summary PDF for each student (one page with key details)
6. Bundle everything into a ZIP file with structure:
   ```
   HandoverPack_{ResidenceName}_{Date}/
     ├── {StudentName}_{RefCode}/
     │     ├── Application_Summary.pdf
     │     ├── ID_Copy.pdf
     │     ├── Proof_of_Registration.pdf
     │     └── NSFAS_Letter.pdf
     ├── {StudentName2}_{RefCode2}/
     │     └── ...
     └── Full_Summary.pdf (all applications in one PDF)
   ```
7. Return signed URL or stream the ZIP

### Frontend Changes

**File: `src/pages/admin/AdminApplications.tsx`**
- Add "Download Handover Pack" button in the bulk actions bar
- Add "Download Pack" option per-residence in the table

**New Component: `src/components/admin/HandoverPackButton.tsx`**
- Reusable button that triggers the edge function
- Shows loading state during generation
- Handles download via signed URL

---

## Part 3: Student Booking Slip (Branded + QR)

### Booking Slip Content
Based on your selections, the slip will include:
- **Basic info**: Student name, residence name, application reference, date/time applied
- **Accommodation info**: Room type, monthly price, residence address, contact details
- **QR/verification code**: Generated 8-character reference code (already exists via `generate_ref_code()`)
- **ResKonnect branding**: Logo, colors, footer with support contact

### New Edge Function: `generate-booking-slip`

**File: `supabase/functions/generate-booking-slip/index.ts`**

This function will:
1. Accept `application_id`
2. Verify the requesting user owns this application
3. Fetch application + residence data
4. Generate a branded PDF with:
   - ResKonnect header/logo
   - Student details
   - Residence details (name, address, room type, price)
   - Application reference code (8-char from UUID)
   - QR code encoding the reference
   - "This confirms your application was submitted" disclaimer
5. Return PDF as download or base64

### Frontend Changes

**File: `src/pages/Applications.tsx`**
- Add "Download Booking Slip" button on each application card
- Only show for submitted/approved applications

---

## Part 4: Find My Res - Campus Sections with Manual Override

### Database Changes

**New Column on `residences` table:**
```sql
ALTER TABLE residences 
  ADD COLUMN IF NOT EXISTS section_category TEXT DEFAULT NULL;
```

This allows manual override while falling back to `campus` for automatic grouping.

**Section Priority Logic:**
1. If `section_category` is set, use it (manual override)
2. Otherwise, derive from `campus`:
   - "Soshanguve North" / "Soshanguve South" -> "Soshanguve"
   - "Arts (Pretoria)" -> "Arts"
   - "Arcadia" -> "Arcadia"
   - "Pretoria West" -> "Pretoria West"
   - etc.

### Frontend Changes

**File: `src/pages/FindMyRes.tsx`**

Major restructure:
1. Add section headers with collapse/expand
2. Group residences by derived section
3. Add section filter tabs: "All | Soshanguve | Arts | Arcadia | Pretoria West | ARLC | Other"
4. Add sorting options: "Price | Distance | Newest | Availability"
5. Add section badges on residence cards

**New Component: `src/components/ResidenceSectionGrid.tsx`**
- Renders a section header with count
- Shows residences in that section
- Collapsible with animation

### Admin Residence Editor Update

**File: `src/pages/admin/AdminResidences.tsx`**
- Add "Section Category" dropdown in residence edit form
- Options: "Auto (use campus)", "Soshanguve", "Arts", "Arcadia", "Pretoria West", "ARLC", "Other"

---

## Part 5: Residence Portal Creation Fix

### Current Issue
The edge function `create_residence_portal_user` exists but may not be deployed. The frontend calls it but gets errors.

### Solution

1. **Verify edge function is deployed** - Deploy the existing function
2. **Update function naming** - Rename to `create-residence-portal-user` (with hyphens, Deno convention)
3. **Test the full flow**:
   - Admin creates portal account
   - Auth user is created
   - `user_roles` entry is created with `residence_portal`
   - `residence_portal_accounts` entry is created

### Edge Function Update

**File: `supabase/functions/create-residence-portal-user/index.ts`**

Ensure the function:
- Has proper CORS headers
- Creates user with `email_confirm: true`
- Inserts role into `user_roles`
- Inserts record into `residence_portal_accounts`
- Has proper rollback on failure

### Frontend Update

**File: `src/pages/admin/AdminResidencePortals.tsx`**
- Update function invoke name to match the deployed function
- Add better error handling and display

---

## Part 6: Master SQL Script

This script will be provided to run on external Supabase instances. It consolidates all schema changes from migrations.

### Script Contents

```sql
-- =====================================================
-- RESKONNECT MASTER SQL SCRIPT
-- Version: 2.0 (February 2026)
-- Run this on a fresh or existing Supabase project
-- =====================================================

-- 1. Create app_role enum (if not exists)
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'student', 'residence_portal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add residence_portal if enum exists but value doesn't
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'residence_portal';

-- 2. Core tables (profiles, residences, applications, etc.)
-- [Full CREATE TABLE statements with all columns]

-- 3. Residence Portal tables
-- [residence_portal_accounts, application_documents, etc.]

-- 4. Helper functions
-- [is_authorized_residence_user, generate_ref_code, has_role]

-- 5. RLS Policies
-- [All policies for multi-tenant isolation]

-- 6. Triggers
-- [updated_at triggers]

-- 7. Storage buckets
-- [application-documents, documents, etc.]

-- 8. Realtime publication
-- [Add tables to supabase_realtime]

-- 9. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

The full script will be ~500 lines covering all tables, functions, and policies.

---

## File Changes Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/download-handover-pack/index.ts` | Admin handover pack generation |
| `supabase/functions/generate-booking-slip/index.ts` | Student booking slip generation |
| `src/components/admin/HandoverPackButton.tsx` | Reusable download button |
| `src/components/ResidenceSectionGrid.tsx` | Grouped residence display |
| `docs/MASTER_SQL.sql` | Full SQL script for external Supabase |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/AdminApplications.tsx` | Add exact timestamps, handover pack button |
| `src/pages/admin/AdminResidences.tsx` | Add section_category field |
| `src/pages/admin/AdminResidencePortals.tsx` | Fix function invoke name |
| `src/pages/Applications.tsx` | Add booking slip download button |
| `src/pages/FindMyRes.tsx` | Major restructure with sections, filters, sorting |
| `supabase/functions/create_residence_portal_user/index.ts` | Rename + verify deployment |

### Database Changes

| Change | Type |
|--------|------|
| Add `section_category` to `residences` | Migration |
| Deploy `create-residence-portal-user` | Edge function |
| Deploy `download-handover-pack` | Edge function |
| Deploy `generate-booking-slip` | Edge function |
| Deploy `update-application-status` | Edge function (already exists) |

---

## Implementation Phases

### Phase 1: Critical Fixes (Immediate)
- Fix residence portal creation by deploying edge function
- Verify all existing tables/policies are in place

### Phase 2: Admin Enhancements
- Exact date/time on applications
- Handover pack edge function + UI

### Phase 3: Student Features
- Booking slip generation
- Download button on applications page

### Phase 4: Find My Res Overhaul
- Add section_category column
- Rebuild FindMyRes.tsx with sections
- Admin section management

### Phase 5: Documentation
- Generate master SQL script
- Test on fresh Supabase instance

---

## Technical Notes

### Edge Function Dependencies
For PDF generation, we'll use a lightweight approach:
- Simple HTML-to-PDF via headless rendering
- Or structured PDF with basic formatting (no external deps)

### QR Code Generation
- Use a pure-JS QR encoder in the edge function
- Embed as base64 image in PDF

### ZIP Generation
- Use Deno's built-in compression or a lightweight library
- Stream response for large packs

### Application Count Discrepancy Fix
The issue where "130 applications exist but filter shows 93" is likely caused by:
1. Default Supabase row limit (1000) - not the issue here since under limit
2. Filter logic not matching all statuses
3. Student applied to multiple residences, counting unique students vs total applications

Fix: Ensure the admin dashboard counts **applications** not **students**, and shows applications across all residences.

---

## Estimated Scope

- **Edge Functions**: 3 new functions (~200-300 lines each)
- **Frontend Components**: 2 new, 5 modified
- **Database**: 1 new column, verify existing schema
- **SQL Script**: ~500 lines comprehensive script
