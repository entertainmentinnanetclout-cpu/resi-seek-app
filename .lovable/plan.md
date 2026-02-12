

# WIL (Work Integrated Learning) Module - Implementation Plan

## Overview
Build a complete WIL Placement Assistance module with a student-facing form page and an admin management dashboard, fully integrated with the database backend.

---

## 1. Database Changes (Migration)

Create 4 new tables and a storage bucket via migration:

### Tables
- **wil_applications** - Student WIL submissions (student_id, full_name, student_number, course, year_level, wil_duration, funding_status, campus, preferred_area, notes, status, doc_type)
- **wil_documents** - File metadata linked to WIL applications (application_id, file_name, file_url, doc_type, uploaded_at)
- **wil_admin_notes** - Internal admin notes per application (application_id, admin_id, note)
- **wil_assignments** - Staff assignment tracking (application_id, assigned_to, assigned_by)

### RLS Policies (using `has_role()` function - no direct table queries)
- Students: INSERT/SELECT/UPDATE own WIL application only
- Admins: ALL access on all 4 tables
- Students: INSERT/SELECT own WIL documents
- Admins: ALL access on wil_documents, wil_admin_notes, wil_assignments

### Storage
- Create `wil-documents` bucket (private)
- RLS: students upload to own folder, admins can read all

### Trigger
- `update_updated_at` trigger on wil_applications

---

## 2. Student Page: "My WIL" (`src/pages/MyWIL.tsx`)

### Layout
Uses `DashboardLayout` wrapper (same as all student pages).

### Form Sections
1. **Personal Info** (auto-filled from profile): Full Name, Student Number
2. **Academic Info**: Course (text input), Year Level (dropdown 1-4), Campus (dropdown from `TUT_CAMPUSES`)
3. **WIL Details**: Duration (1/3/6/12 months dropdown), Funding Status (NSFAS/Self-Funded), Preferred Placement Area (text), Additional Notes (textarea)
4. **Document Uploads**: Reuses the same `DocumentUploader` pattern - upload to `wil-documents` bucket with types: ID, Proof of Registration, CV, Academic Record, Placement Letter Request, Motivation Letter

### Behavior
- Fetches existing WIL application on load (one per student)
- If exists and status is "submitted", allow editing
- If status is "processing"/"placed"/"not_suitable", show read-only view with status badge
- Form validation before submit
- Toast confirmation on submit/update
- Status timeline display (Submitted -> Processing -> Placed)

---

## 3. Admin Page: "WIL Management" (`src/pages/admin/AdminWIL.tsx`)

### List View
- Table with columns: Student Name, Student Number, Course, Year, Duration, Funding, Campus, Status, Date Submitted, Actions
- Search by name/student number
- Filter by status, campus, funding type
- Bulk select with checkboxes
- Export to CSV button

### Detail Dialog
When admin clicks "View":
- Full student info card
- All uploaded WIL documents (downloadable via signed URLs)
- Admin notes section (add/view internal notes)
- Status change dropdown (Submitted/Processing/Placed/Not Suitable)
- Assignment section - assign to staff member (dropdown of admin users)
- Activity timeline
- "Mark as Placed" quick button
- Export individual application to PDF (HTML printable view)

### Status Badges
- Submitted: yellow
- Processing: blue
- Placed: green
- Not Suitable: red

---

## 4. Routing and Navigation

### App.tsx
- Add route: `/wil` -> `StudentRoute` -> `MyWIL`
- Add route: `/admin/wil` -> `AdminRoute` -> `AdminWIL`

### DashboardLayout.tsx (Student sidebar)
- Add nav item: `{ icon: Briefcase, label: "My WIL", path: "/wil" }`

### AdminLayout.tsx (Admin sidebar)
- Add nav item: `{ icon: Briefcase, label: "WIL Management", path: "/admin/wil" }`

---

## 5. Files to Create

| File | Purpose |
|------|---------|
| `src/pages/MyWIL.tsx` | Student WIL form page |
| `src/pages/admin/AdminWIL.tsx` | Admin WIL management page |

## 6. Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add 2 new routes |
| `src/components/DashboardLayout.tsx` | Add "My WIL" nav item |
| `src/components/admin/AdminLayout.tsx` | Add "WIL Management" nav item |

---

## 7. Technical Notes

- All database queries use the existing `supabase` client from `@/integrations/supabase/client`
- RLS policies use `has_role(auth.uid(), 'admin')` to avoid recursive policy issues
- WIL document uploads follow the same pattern as `DocumentUploader` component (upload to storage bucket, save metadata to DB)
- The types file will auto-regenerate after migration - until then, queries will use `.from('wil_applications' as any)` casting
- No collision with existing tables - all prefixed with `wil_`
- CSV export reuses patterns from `src/lib/exportHelpers.ts`

