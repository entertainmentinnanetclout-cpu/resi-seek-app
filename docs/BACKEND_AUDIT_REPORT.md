# ResKonnect Backend Audit Report
> Generated: March 2026 | MASTER_SQL v4.0

## 1. Audit Summary

✅ **All 34 tables** referenced in code exist in the database schema  
✅ **All 7 storage buckets** referenced in code exist  
✅ **All 5 edge functions** use `EXTERNAL_SUPABASE_*` env vars exclusively  
✅ **All RPC functions** (`has_role`, `is_authorized_residence_user`, `get_user_residence_id`, `generate_ref_code`) exist  
✅ **No missing columns** detected across all queries  
✅ **RLS policies** cover all access patterns for student, admin, and residence_portal roles  

## 2. Tables Used by Code

### Core (14 tables)
| Table | Used By | Status |
|-------|---------|--------|
| profiles | Profile, Dashboard, AdminUsers, RoommateFinder, ResBot | ✅ |
| user_roles | AuthContext, AdminRoute, AdminUsers | ✅ |
| residences | FindMyRes, ResidenceDetail, AdminResidences, Dashboard | ✅ |
| applications | Applications, AdminApplications, AdminFollowUp, ResidencePortal | ✅ |
| documents | Documents, DocumentUploader, AdminDocuments, AdminApplications | ✅ |
| notifications | NotificationCenter, AdminApplications | ✅ |
| favorites | Favorites, FavoriteButton | ✅ |
| reviews | ResidenceDetail, ReviewForm | ✅ |
| residence_portal_accounts | ResidenceLogin, AdminResidencePortals | ✅ |
| application_documents | ResidencePortal, AdminApplications | ✅ |
| application_messages | ResidenceInbox | ✅ |
| application_activity_log | ResidencePortal | ✅ |
| referral_claims | ResidencePortal (auto-created) | ✅ |
| residence_analytics | ResidenceDetail, AdminDashboard | ✅ |

### Content (4 tables)
| Table | Used By | Status |
|-------|---------|--------|
| hero_slides | Landing/CampusNews, AdminSlides | ✅ |
| campus_news | CampusNews, AdminNews | ✅ |
| events | Events, AdminEvents | ✅ |
| bursaries | BursaryFinder, AdminBursaries | ✅ |

### Commerce (8 tables)
| Table | Used By | Status |
|-------|---------|--------|
| student_discounts | StudentDeals, AdminDiscounts | ✅ |
| discount_orders | MyDiscountOrders, AdminDiscountOrders | ✅ |
| hamper_items | StudentDeals, AdminHamperItems | ✅ |
| student_hamper_preferences | StudentDeals | ✅ |
| stores | MyStore, Store, StoreSetup, AdminStores | ✅ |
| marketplace_listings | Marketplace, AdminMarketplace | ✅ |
| marketplace_orders | Orders, AdminMarketplace | ✅ |
| store_reviews | Store, StoreReviewForm | ✅ |

### WIL (4 tables)
| Table | Used By | Status |
|-------|---------|--------|
| wil_applications | MyWIL, AdminWIL | ✅ |
| wil_documents | MyWIL, AdminWIL | ✅ |
| wil_admin_notes | AdminWIL | ✅ |
| wil_assignments | AdminWIL | ✅ |

### System (4 tables)
| Table | Used By | Status |
|-------|---------|--------|
| whatsapp_templates | AdminWhatsAppTemplates | ✅ |
| call_logs | CallLogDialog | ✅ |
| platform_settings | AdminSettings | ✅ |
| marketplace_seller_profiles (view) | Marketplace | ✅ |

## 3. Storage Buckets

| Bucket | Public | Used By | Status |
|--------|--------|---------|--------|
| documents | No | DocumentUploader, DocumentsList, AdminDocuments | ✅ |
| application-documents | No | ResidencePortal | ✅ |
| profile-pictures | Yes | ProfilePictureUpload | ✅ |
| admin-images | Yes | AdminSlides, AdminEvents, AdminDiscounts, AdminResidences, AdminBursaries, AdminNews | ✅ |
| marketplace | Yes | Marketplace | ✅ |
| store-assets | Yes | StoreSetup | ✅ |
| wil-documents | No | MyWIL, AdminWIL | ✅ |

## 4. Edge Functions

| Function | External DB | Status |
|----------|-------------|--------|
| resbot-ai | ✅ EXTERNAL_SUPABASE_* | ✅ |
| create-residence-portal-user | ✅ EXTERNAL_SUPABASE_* | ✅ |
| generate-booking-slip | ✅ EXTERNAL_SUPABASE_* | ✅ |
| download-handover-pack | ✅ EXTERNAL_SUPABASE_* | ✅ |
| update-application-status | ✅ EXTERNAL_SUPABASE_* | ✅ |

## 5. RPC Functions

| Function | Security | Status |
|----------|----------|--------|
| has_role(_user_id, _role) | SECURITY DEFINER, row_security=off | ✅ |
| is_authorized_residence_user(target_residence_id) | SECURITY DEFINER, row_security=off | ✅ |
| get_user_residence_id() | SECURITY DEFINER, row_security=off | ✅ |
| generate_ref_code(app_id) | IMMUTABLE | ✅ |

## 6. Changes in v4.0 (vs v3.0)

| Change | Description |
|--------|-------------|
| **Added WIL tables** | wil_applications, wil_documents, wil_admin_notes, wil_assignments |
| **Added WIL RLS** | Student CRUD own, admin full access |
| **Added wil-documents bucket** | Private bucket with student/admin storage policies |
| **Added WIL trigger** | update_updated_at on wil_applications |
| **Added performance indexes** | 22 indexes across high-query tables |
| **Fixed documents storage policy** | Admin can now view/delete student documents in storage |
| **Fixed WIL storage policy** | Admin can view/delete WIL documents in storage |
| **Added profile picture delete policy** | Users can delete own profile pictures |
| **Added marketplace delete policy** | Users can delete marketplace images |
| **Added admin events policy** | Admin FOR ALL on events table |
| **Made realtime idempotent** | Wrapped ALTER PUBLICATION in exception handlers |

## 7. Missing Backend Objects: NONE

All tables, columns, functions, policies, storage buckets, and triggers required by the frontend code are present and correctly configured.

## 8. Role System

| Role | Access |
|------|--------|
| student | Own profile, applications, documents, favorites, WIL, marketplace, orders |
| admin | Full CRUD on all tables via `has_role(auth.uid(), 'admin')` |
| residence_portal | Scoped to own residence via `is_authorized_residence_user()` |

No `super_admin` or `staff` roles are used in the codebase. The existing 3-role system covers all access patterns.
