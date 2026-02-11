

# ResKonnect: Full External Migration, Page Merge, and Master SQL

## Summary
This plan addresses three major areas:
1. Point everything (frontend + all edge functions) to external Supabase only
2. Merge Student Discounts and Student Hamper into one unified page
3. Provide a comprehensive Master SQL script for the external Supabase that covers ALL tables, functions, triggers, RLS policies, and storage buckets

---

## 1. External Supabase - Complete Migration

### Frontend Client (`src/integrations/supabase/client.ts`)
- Hardcode the external Supabase URL (`https://mefjzkhobkltlbmhusdh.supabase.co`) and anon key as primary values
- Remove fallback to Lovable Cloud project (`vmqqkebojldjsyxcewdb`)
- Keep `import.meta.env.VITE_SUPABASE_URL` as override but default to external

### Edge Functions (all 5)
All edge functions already use `EXTERNAL_SUPABASE_*` env vars. Verify and ensure consistency:
- `resbot-ai` - already migrated
- `create-residence-portal-user` - already migrated
- `generate-booking-slip` - already migrated, fix unreachable code after return statement (line 273)
- `download-handover-pack` - already migrated
- `update-application-status` - already migrated

### Fix: `generate-booking-slip` bug
The function has unreachable code (`console.log` after `return`). This will be removed.

---

## 2. Merge Discounts + Hamper into Single Page

### New Combined Page: `src/pages/StudentDeals.tsx`
Merges the Student Discounts page and Student Hamper page into one page with two tabs:
- **Tab 1: "Discounts & Deals"** - All existing discount functionality (browse, order, filter)
- **Tab 2: "Student Hamper"** - All existing hamper preference functionality (want/skip/maybe)

### Routing Changes (`src/App.tsx`)
- `/discounts` -> renders new `StudentDeals` page
- `/hamper` -> renders new `StudentDeals` page (with hamper tab active via URL param)
- Remove separate `StudentHamper` import

### Navigation Changes (`src/components/DashboardLayout.tsx`)
- Merge the two sidebar items ("Discounts" and "Student Hamper") into one: "Deals & Hamper"
- Single icon (Gift or Percent)

### Admin Side
- Admin Discounts and Admin Hamper Items pages remain separate (they manage different tables)
- No admin changes needed

### My Orders
- `MyDiscountOrders` page stays as-is, accessible from the Deals tab

---

## 3. Master SQL Script (`docs/MASTER_SQL.sql`)

A complete, idempotent SQL script that creates everything needed on the external Supabase. This covers ALL tables currently in use (not just the subset in the existing script).

### Tables Included (22 total)

| Table | Purpose |
|-------|---------|
| profiles | User profiles |
| user_roles | Role assignments (admin/student/residence_portal) |
| residences | Accommodation listings |
| applications | Student applications |
| documents | User-uploaded documents |
| notifications | User notifications |
| favorites | Saved residences |
| reviews | Residence reviews |
| residence_portal_accounts | Residence owner accounts |
| application_documents | Per-application documents |
| application_messages | In-app messaging |
| application_activity_log | Audit trail |
| referral_claims | NSFAS referral tracking |
| residence_analytics | Page view analytics |
| hero_slides | Homepage carousel |
| campus_news | News articles |
| events | Campus events |
| bursaries | Bursary listings |
| student_discounts | Discount deals |
| discount_orders | Discount purchase orders |
| hamper_items | Hamper item catalog |
| student_hamper_preferences | Student hamper choices |
| stores | Marketplace stores |
| marketplace_listings | Items for sale |
| marketplace_orders | Purchase orders |
| store_reviews | Store ratings |
| marketplace_seller_profiles | Seller display info (view) |
| whatsapp_templates | WhatsApp message templates |
| call_logs | Admin call tracking |
| platform_settings | App configuration |

### Functions Included (7)
- `has_role()` - Role checking (security definer)
- `is_authorized_residence_user()` - Residence portal auth
- `get_user_residence_id()` - Get residence for portal user
- `generate_ref_code()` - Application reference codes
- `handle_new_user()` - Auto-create profile on signup
- `update_updated_at_column()` - Updated timestamp trigger
- `prevent_last_admin_deletion()` - Safety trigger

### Triggers Included
- `update_updated_at` on profiles, residences, applications, stores, marketplace_listings, marketplace_orders, residence_portal_accounts
- `on_auth_user_created` on auth.users -> handle_new_user()
- `prevent_last_admin_delete` on user_roles

### RLS Policies
Complete set for all 22+ tables covering:
- Student self-access (own data only)
- Admin full access
- Residence portal scoped access
- Public read access where appropriate (residences, reviews, events, news, bursaries)
- System insert permissions (notifications, activity logs, referral claims)

### Storage Buckets
SQL to create all required buckets:
- `documents` (private)
- `application-documents` (private)
- `profile-pictures` (public)
- `admin-images` (public)
- `marketplace` (public)
- `store-assets` (public)

### Realtime
Enable realtime for key tables:
- applications, notifications, application_messages, application_documents

---

## 4. Applications Page Stability

The current Applications page has a potential issue with dynamic Tailwind classes like `border-${color}-500` which don't get compiled. Replace with a mapping object that uses full class names.

---

## Technical Details

### Files to Create
- `src/pages/StudentDeals.tsx` - New merged page

### Files to Modify
- `src/integrations/supabase/client.ts` - Hardcode external credentials
- `src/App.tsx` - Update routes for merged page
- `src/components/DashboardLayout.tsx` - Merge nav items
- `src/pages/Applications.tsx` - Fix dynamic Tailwind classes
- `supabase/functions/generate-booking-slip/index.ts` - Remove unreachable code
- `docs/MASTER_SQL.sql` - Complete rewrite with all tables/policies

### Files to Keep (no changes)
- All edge functions (already pointing to external)
- All admin pages
- `MyDiscountOrders.tsx` (still works, linked from merged page)

### Deployment Steps
1. Update the Master SQL script
2. User runs the SQL on external Supabase (SQL Editor)
3. Code changes deployed automatically
4. Verify edge functions work with external credentials

