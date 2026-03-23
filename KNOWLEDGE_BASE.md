# ResKonnect Knowledge Base

> **Last Updated:** March 2026  
> **Version:** 3.0  
> **Platform:** React + Vite + Tailwind CSS + Supabase (Lovable Cloud)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication & Authorisation](#5-authentication--authorisation)
6. [Company Structure & Staff Roles](#6-company-structure--staff-roles)
7. [Admin Hub Architecture](#7-admin-hub-architecture)
8. [Core Features](#8-core-features)
9. [User Journeys](#9-user-journeys)
10. [API Reference](#10-api-reference)
11. [Component Library](#11-component-library)
12. [Design System](#12-design-system)
13. [Business Logic](#13-business-logic)
14. [Troubleshooting](#14-troubleshooting)
15. [Roadmap](#15-roadmap)

---

## 1. Overview

### What is ResKonnect?

ResKonnect is South Africa's premier student accommodation platform, designed specifically for TUT (Tshwane University of Technology) students. It connects students with verified residences, provides NSFAS-accredited options, and offers a complete ecosystem for student life including a marketplace, bursary finder, events, and student deals.

### Key Value Propositions

- **For Students:** Find verified, affordable accommodation near campus with transparent pricing
- **For Landlords:** Reach qualified student tenants with streamlined application management
- **For NSFAS:** Ensure students find accredited accommodation within funding limits

### Supported Campuses

| Campus | Location | Province |
|--------|----------|----------|
| Soshanguve South | Soshanguve | Gauteng |
| Soshanguve North | Soshanguve | Gauteng |
| Ga-Rankuwa | Ga-Rankuwa | Gauteng |
| Pretoria (Arcadia) | Pretoria | Gauteng |
| Mbombela | Mbombela | Mpumalanga |
| Polokwane | Polokwane | Limpopo |
| eMalahleni | eMalahleni | Mpumalanga |

---

## 2. Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI Framework |
| Vite | Latest | Build Tool |
| TypeScript | Latest | Type Safety |
| Tailwind CSS | Latest | Styling |
| shadcn/ui | Latest | UI Components |
| React Router | 6.30.1 | Routing |
| TanStack Query | 5.83.0 | Data Fetching |
| Framer Motion | - | Animations |
| Recharts | 2.15.4 | Charts |

### Backend (Lovable Cloud / Supabase)

| Technology | Purpose |
|------------|---------|
| Supabase | Database, Auth, Storage, Edge Functions |
| PostgreSQL | Database |
| Row Level Security | Data Protection |
| Lovable AI Gateway | AI-powered features |

### AI Integration

- **Model:** Google Gemini 2.5 Flash (via Lovable AI Gateway)
- **Use Cases:** ResBot chatbot, recommendations, natural language search

---

## 3. Project Structure

```
src/
├── assets/              # Static images, logos
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── admin/          # Admin-specific components
│   ├── AdminRoute.tsx  # Staff route guard
│   ├── StudentRoute.tsx# Student route guard
│   ├── ResBot.tsx      # AI chatbot
│   ├── NotificationCenter.tsx
│   ├── CommandPalette.tsx
│   └── SmartDashboard.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx  # Auth + role resolution
├── hooks/              # Custom React hooks
│   ├── useRealtimeProfile.ts
│   ├── useRealtimeApplications.ts
│   └── useRealtimeNotifications.ts
├── integrations/       # External integrations
│   └── supabase/       # Supabase client & types (auto-generated)
├── lib/                # Utilities and constants
│   ├── utils.ts
│   ├── constants.ts
│   └── campuses.ts
├── pages/              # Route components
│   ├── admin/          # Admin hub pages
│   ├── residence/      # Residence portal pages
│   ├── seo/            # SEO landing pages
│   ├── Dashboard.tsx
│   ├── FindMyRes.tsx
│   └── ...
└── App.tsx             # Main app with routing

supabase/
├── config.toml         # Supabase configuration
├── functions/          # Edge functions
│   ├── resbot-ai/
│   ├── create-residence-portal-user/
│   ├── generate-booking-slip/
│   ├── download-handover-pack/
│   └── update-application-status/
└── migrations/         # Database migrations
```

---

## 4. Database Schema

### Core Tables

#### `profiles`
Stores user profile information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (matches auth.users) |
| full_name | TEXT | User's full name |
| email | TEXT | Email address |
| phone | TEXT | Phone number |
| student_number | TEXT | University student number |
| campus | TEXT | Selected campus |
| course | TEXT | Course of study |
| year_of_study | TEXT | Year (1st, 2nd, etc.) |
| profile_picture_url | TEXT | Avatar URL |
| looking_for_roommate | BOOLEAN | Roommate finder flag |
| lifestyle_preferences | JSONB | Preferences for roommate matching |

#### `residences`
Stores accommodation listings.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Residence name |
| address | TEXT | Physical address |
| campus | TEXT | Nearest campus |
| province | TEXT | Province |
| price | INTEGER | Monthly rent (ZAR) |
| room_type | TEXT | Single/Sharing/Bachelor/Commune |
| capacity | INTEGER | Total capacity |
| available_spots | INTEGER | Current availability |
| amenities | TEXT[] | List of amenities |
| images | TEXT[] | Image URLs |
| is_trusted | BOOLEAN | Verified by ResKonnect |
| featured | BOOLEAN | Featured listing |
| distance_from_campus | DECIMAL | Distance in km |
| contact_email | TEXT | Contact email |
| contact_phone | TEXT | Contact phone |
| virtual_tour_url | TEXT | 360° tour link |

#### `applications`
Tracks residence applications.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Applicant (FK to profiles) |
| residence_id | UUID | Target residence (FK) |
| status | TEXT | submitted/approved/rejected |
| funding_type | TEXT | NSFAS/self-funded/bursary |
| notes | TEXT | Additional notes |
| application_date | TIMESTAMP | When applied |
| student_profile | JSONB | Snapshot of student info at application time |

#### `documents`
User-uploaded documents.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner (FK to profiles) |
| document_type | TEXT | ID/Registration/NSFAS/etc. |
| file_name | TEXT | Original filename |
| file_path | TEXT | Storage path |
| file_size | INTEGER | Size in bytes |

#### `notifications`
User notifications.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Recipient |
| type | TEXT | application/residence/alert/info |
| title | TEXT | Notification title |
| message | TEXT | Notification body |
| is_read | BOOLEAN | Read status |
| metadata | JSONB | Additional data |

#### `favorites`
Saved residences.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User |
| residence_id | UUID | Saved residence |

### Supporting Tables

- `user_roles` — Staff/student role assignments. Uses `app_role` enum: `admin`, `operations_lead`, `commerce_lead`, `growth_lead`, `system_operator`, `support_agent`, `student`. Unique constraint on `(user_id, role)`.
- `residence_portal_accounts` — Links residence owners to their building for isolated portal access
- `referral_claims` — Tracks billable referral events (NSFAS provisional approvals)
- `application_documents` — Per-application document uploads with verification status
- `application_messages` — In-app messaging between staff and applicants
- `application_activity_log` — Audit trail for all application status changes
- `reviews` — Residence reviews from students
- `bursaries` — Bursary/funding opportunities
- `events` — Campus events
- `campus_news` — News articles
- `student_discounts` — Discount offers
- `discount_orders` — Student discount purchases
- `stores` — Marketplace stores
- `products` — Store products with variants
- `product_variants` — Size/colour variants per product
- `product_categories` — Hierarchical product categories
- `marketplace_listings` — Student-to-student items for sale
- `marketplace_orders` — Marketplace purchase orders
- `store_reviews` — Store ratings
- `hampers` — Student hamper bundles
- `hamper_items` — Individual items available for hampers
- `hamper_bundle_items` — Items included in a hamper
- `hamper_orders` — Hamper purchase orders
- `hamper_order_items` — Line items per hamper order
- `cart` / `cart_items` — Shopping cart
- `shop_orders` — Unified shop orders
- `order_status_history` — Order status audit trail
- `payments` — Payment records
- `hero_slides` — Homepage carousel
- `platform_settings` — App configuration
- `call_logs` — Admin call tracking for student follow-up
- `residence_analytics` — View/click tracking per residence

---

## 5. Authentication & Authorisation

### Auth Flow

1. **Sign Up:** Email/password with auto-confirm enabled
2. **Sign In:** Email/password
3. **Session:** JWT managed by Supabase client
4. **Role Resolution:** `get_user_staff_role` RPC called on login to determine dashboard routing

### Role System

Roles are stored in the `user_roles` table (NEVER on profiles). The `app_role` enum contains:

| Role | Type | Description |
|------|------|-------------|
| `admin` | Staff | Full platform access (God Mode) |
| `system_operator` | Staff | Technical/backend management |
| `operations_lead` | Staff | Accommodation engine owner |
| `commerce_lead` | Staff | Revenue/marketplace owner |
| `growth_lead` | Staff | User acquisition & media |
| `support_agent` | Staff | Limited ops + order support |
| `student` | User | Standard student account |

### `get_user_staff_role` RPC

A `SECURITY DEFINER` function that resolves a user's staff role with priority ordering:

```sql
-- Priority: admin > system_operator > operations_lead > commerce_lead > growth_lead > support_agent
-- Returns NULL if user has no staff role (i.e. student only)
```

The `AuthContext` calls this RPC after session is established and stores the result as `staffRole`.

### Route Guards

```tsx
// Student-only route (redirects staff to their hub)
<StudentRoute>
  <Dashboard />
</StudentRoute>

// Staff-only route (any staff role grants access)
<AdminRoute>
  <AdminDashboard />
</AdminRoute>
```

**`StudentRoute`** — Requires authenticated user with NO staff role. If user has a staff role, redirects to the appropriate hub:

| Staff Role | Redirect Target |
|-----------|----------------|
| admin | `/admin` |
| operations_lead | `/admin/operations` |
| commerce_lead | `/admin/commerce` |
| growth_lead | `/admin/media` |
| system_operator | `/admin/system` |
| support_agent | `/admin/operations` |

**`AdminRoute`** — Requires authenticated user with ANY staff role. Shows "Access denied" toast and redirects to `/dashboard` if `staffRole` is null.

### Public Access Strategy

All content-heavy browse pages are **publicly accessible without authentication** to maximise SEO and link sharing:

| Public Pages | Examples |
|-------------|---------|
| Residence browsing | `/find-my-res`, `/residence/:id` |
| Bursaries | `/bursary-finder`, `/bursary/:slug` |
| Marketplace | `/marketplace`, `/product/:id` |
| News & Events | `/campus-news`, `/events` |
| Student deals | `/student-deals`, `/student-discounts` |
| Roommate finder | `/roommate-finder` |
| SEO pages | `/accommodation/*`, `/province/*` |

**Auth is required only for actions:**
- Applying for a residence
- Adding to favourites
- Submitting a review
- Adding to cart / placing an order
- Uploading documents

When a guest attempts a protected action, they are redirected to `/auth?returnTo=<current_path>` for seamless post-login return.

### RLS Policies

All tables have Row Level Security enabled:
- Users can only read/write their own data
- Staff have elevated access via `has_role()` SECURITY DEFINER function
- Public data (residences, news, events, bursaries) readable by all
- Residence portal users scoped to their building via `residence_portal_accounts`

### Admin Accounts

| Email | Role |
|-------|------|
| 43v3r2a11@gmail.com | admin |
| reskonnect@gmail.com | admin |

---

## 6. Company Structure & Staff Roles

ResKonnect operates with a lean, high-leverage team structure (6 people max). Each role owns an entire system rather than performing fragmented tasks.

```
                CEO (You)
                   │
    ┌──────────────┼──────────────┐
    │              │              │
Operations     Commerce       Growth
   Lead          Lead           Lead
    │              │              │
    └──────┬───────┴──────┬───────┘
           │              │
     Product/System    Support
        Operator      (Optional)
```

| # | Role | Hub Access | Key Responsibilities | KPIs |
|---|------|-----------|---------------------|------|
| 1 | **CEO / Founder** | All Hubs (God Mode) | Partnerships (NSFAS, landlords, brands), product direction, revenue strategy, final approvals | — |
| 2 | **Operations Lead** | Operations Hub | Residence onboarding pipeline, portal account management, application flow, student placement, follow-ups, occupancy tracking | % occupancy, # active residences, application→placement conversion |
| 3 | **Commerce Lead** | Commerce Hub | Marketplace growth, hampers strategy, discount partnerships, order fulfilment | Monthly GMV, hamper revenue, # active sellers |
| 4 | **Growth Lead** | Media Hub + Analytics | User acquisition, social media & content, campus activations, bursaries & news (SEO) | DAU, signups/day, cost per acquisition |
| 5 | **System Operator** | System Hub | Works with Lovable + Supabase, SQL migrations, bug fixes, edge functions, admin dashboard maintenance | System uptime, bugs resolved/week, deployment speed |
| 6 | **Support Agent** | Limited Ops + Orders | Student WhatsApp support, basic application help, order tracking responses | Response time, resolution rate |

---

## 7. Admin Hub Architecture

The admin dashboard is organised into **4 Hub Pages** that consolidate 20+ sub-modules into a tabbed interface. The sidebar contains 6 items: Overview, Analytics, and the 4 Hubs.

### Operations Hub (`/admin/operations`)

Owns the entire accommodation engine.

| Tab | Content | Description |
|-----|---------|-------------|
| Residences | AdminResidences | CRUD residence listings |
| Portals | AdminResidencePortals | Create/manage residence portal accounts |
| Applications | AdminApplications | Review, approve/reject student applications |
| Follow-Up | AdminFollowUp | Track student contact attempts and outcomes |
| Documents | AdminDocuments | View/verify uploaded student documents |
| Users | AdminUsers | Manage student profiles and accounts |

### Commerce Hub (`/admin/commerce`)

Owns all revenue-generating marketplace features.

| Tab | Content | Description |
|-----|---------|-------------|
| Marketplace | AdminMarketplace | Moderate listings, verify items |
| Stores | AdminStores | Manage seller stores |
| Discounts | AdminDiscounts | Create/manage student discount offers |
| Orders | AdminDiscountOrders | Track discount order fulfilment |
| Hampers | AdminHamperItems | Manage hamper bundles and items |

### Media Hub (`/admin/media`)

Owns content, engagement, and acquisition.

| Tab | Content | Description |
|-----|---------|-------------|
| Slides | AdminSlides | Homepage hero carousel management |
| News | AdminNews | Campus news articles |
| Events | AdminEvents | Campus events calendar |
| Bursaries | AdminBursaries | Bursary/funding opportunities |

### System Hub (`/admin/system`)

Owns technical stability and platform configuration.

| Tab | Content | Description |
|-----|---------|-------------|
| WIL | AdminWIL | Work-Integrated Learning management |
| WhatsApp | AdminWhatsAppTemplates | WhatsApp message templates |
| Status | AdminSystemStatus | System health monitoring |
| Settings | AdminSettings | Platform-wide configuration |

### Role → Hub Access Mapping

| Staff Role | Accessible Hubs |
|-----------|----------------|
| admin | All 4 Hubs + Overview + Analytics |
| operations_lead | Operations Hub |
| commerce_lead | Commerce Hub |
| growth_lead | Media Hub + Analytics |
| system_operator | System Hub |
| support_agent | Operations Hub (limited) + Commerce Orders |

---

## 8. Core Features

### 8.1 Smart Dashboard

**Component:** `src/components/SmartDashboard.tsx`

Contextual dashboard that adapts to user's journey stage:
- **New User:** Prompts to complete profile
- **Incomplete Profile:** Shows progress, encourages completion
- **Ready User:** Suggests browsing residences
- **Active User:** Shows application status summary
- **Approved User:** Celebrates approval, shows next steps

### 8.2 AI-Powered ResBot

**Edge Function:** `supabase/functions/resbot-ai/index.ts`  
**Frontend:** `src/components/ResBot.tsx`

Features:
- Personalised responses based on user profile
- Real-time residence data queries
- Application status lookups
- NSFAS information
- Natural conversation with South African expressions
- Fallback to rule-based responses if AI unavailable

### 8.3 Notification Centre

**Component:** `src/components/NotificationCenter.tsx`

- Real-time notifications via Supabase Realtime
- Unread count badge
- Mark as read / Mark all read
- Type-based icons and colours
- Links to relevant pages

### 8.4 Command Palette

**Component:** `src/components/CommandPalette.tsx`

- Keyboard shortcut: `Ctrl/Cmd + K`
- Quick navigation to any page
- Quick actions (apply, upload docs)
- Search across features

### 8.5 Residence Search

**Page:** `src/pages/FindMyRes.tsx`

Filters: Campus, Price range, Room type, Amenities, NSFAS accredited, Distance from campus

Features: Grid/List view toggle, Compare tool (up to 3), Favourites, Virtual tour links

### 8.6 Application System

**Page:** `src/pages/Applications.tsx`

- View all applications
- Status tracking (submitted/approved/rejected)
- Document status per application
- Real-time status updates

### 8.7 Marketplace

**Pages:** `src/pages/Marketplace.tsx`, `src/pages/MyStore.tsx`

- Student-to-student sales
- Store creation
- Product listings with variants
- Order management
- Store reviews

### 8.8 Document Management

**Page:** `src/pages/Documents.tsx`

- Upload ID, registration, NSFAS letter
- Document type categorisation
- Progress tracking
- Secure storage

### 8.9 Residence Portal

**Pages:** `src/pages/residence/*`

Multi-tenant portal for residence owners:
- Isolated per building (scoped via `residence_portal_accounts`)
- View applications for their residence
- Application detail with messaging
- Analytics dashboard
- Inbox for communication

---

## 9. User Journeys

### New Student Journey

```
Land on ResKonnect → Sign Up → Complete Profile → Upload Documents
→ Browse Residences → Add to Favourites → Apply to Residence
→ Wait for Approval → Approved? → Upload Final Docs → Move In!
```

### Admin Journey

```
Login → Role resolved via RPC → Routed to appropriate Hub
→ Review Applications / Manage Residences / Track Analytics
→ Approve/Reject → Notifications sent to student
```

### Guest Journey (Public Access)

```
Land via Google/social link → Browse residences/bursaries/marketplace
→ Click "Apply" or "Add to Cart" → Redirected to /auth?returnTo=...
→ Sign up/login → Returned to original page → Complete action
```

---

## 10. API Reference

### Edge Functions

| Function | Purpose |
|----------|---------|
| `resbot-ai` | AI chatbot (Gemini 2.5 Flash) |
| `create-residence-portal-user` | Create portal account for residence owner |
| `generate-booking-slip` | PDF booking confirmation |
| `download-handover-pack` | Handover documentation bundle |
| `update-application-status` | Status change with notifications |

### Key RPC Functions

| Function | Purpose |
|----------|---------|
| `get_user_staff_role` | Resolve staff role with priority ordering |
| `has_role` | Check if user has a specific role (SECURITY DEFINER) |

### Common Queries

```typescript
// Get user profile
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// Get residences with filters
const { data } = await supabase
  .from('residences')
  .select('*')
  .eq('campus', 'Soshanguve')
  .gte('price', 2000)
  .lte('price', 4000)
  .gt('available_spots', 0);

// Submit application
const { error } = await supabase
  .from('applications')
  .insert({
    user_id: userId,
    residence_id: residenceId,
    status: 'submitted'
  });
```

---

## 11. Component Library

### Layout Components

| Component | Path | Description |
|-----------|------|-------------|
| DashboardLayout | `components/DashboardLayout.tsx` | Main dashboard wrapper with sidebar |
| PublicLayout | `components/PublicLayout.tsx` | Public pages wrapper |
| AdminLayout | `components/admin/AdminLayout.tsx` | Admin dashboard wrapper |
| ResidenceLayout | `pages/residence/ResidenceLayout.tsx` | Residence portal wrapper |

### Route Guards

| Component | Path | Description |
|-----------|------|-------------|
| AdminRoute | `components/AdminRoute.tsx` | Staff-only access guard |
| StudentRoute | `components/StudentRoute.tsx` | Student-only access guard |
| ProtectedRoute | `components/ProtectedRoute.tsx` | Generic auth guard |

### Smart Components

| Component | Path | Description |
|-----------|------|-------------|
| SmartDashboard | `components/SmartDashboard.tsx` | Contextual dashboard section |
| ResBot | `components/ResBot.tsx` | AI chatbot |
| NotificationCenter | `components/NotificationCenter.tsx` | Notifications popover |
| CommandPalette | `components/CommandPalette.tsx` | Quick navigation |

---

## 12. Design System

### Colours (HSL in index.css)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --muted: 210 40% 96%;
  --accent: 210 40% 96%;
  --destructive: 0 84.2% 60.2%;
  --success: 142 76% 36%;
}
```

### Typography

- **Headings:** Font-weight 600-700, tracking-tight
- **Body:** text-sm to text-base
- **Muted:** text-muted-foreground

### Currency

Always format as ZAR: `R2,500` (not $2500)

---

## 13. Business Logic

### Application Status Flow

```
submitted → under_review → approved / rejected
                        ↓
                  documents_required → submitted (resubmit)
```

### NSFAS Referral Claims

When an application with `funding_type = 'nsfas'` is set to `provisionally_approved`, a `referral_claim` is automatically created. This is a billable event for ResKonnect.

### Contact Routing

All residence enquiries route through ResKonnect's WhatsApp:
```
WhatsApp: 063 732 3192 (27637323192)
```
**CRITICAL:** Never expose landlord contact details directly in the frontend or DevTools.

---

## 14. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| User lands on student dash despite admin role | Session/account mismatch or wrong backend | Use auth debug panel on /auth page, verify with SQL |
| Profile picture not uploading | RLS policy | Check `profile-pictures` bucket policies |
| ResBot not responding | Rate limit or AI error | Falls back to rule-based responses |
| Notifications not updating | Realtime not subscribed | Check channel subscription |
| "Failed to load follow-up data" | Missing FK or RLS | Check call_logs table policies |

### Auth Debug Panel

On the `/auth` page, click **"Show debug info"** to see:
- Logged-in email
- User ID
- Resolved staff role
- Active backend URL

### Debugging Steps

1. **Check Console:** Browser DevTools → Console (look for `[AuthContext]` logs)
2. **Check Network:** DevTools → Network for API errors
3. **Check Backend Logs:** Edge function logs in Lovable Cloud
4. **Check RLS:** Ensure policies allow the operation
5. **Validate Role SQL:** Run the validation query from Section 5

---

## 15. Roadmap

### Phase 1 (Completed ✅)
- [x] Smart Dashboard with contextual sections
- [x] AI-powered ResBot
- [x] Notification Centre
- [x] Command Palette
- [x] Public access strategy (browse without login)
- [x] Role-based admin hub architecture (4 hubs)
- [x] Staff role system (6 roles + routing)
- [x] Residence Portal (multi-tenant)
- [x] Marketplace with stores & products

### Phase 2 (Next)
- [ ] Smart residence recommendations
- [ ] Natural language search
- [ ] Document intelligence (validation, expiry tracking)
- [ ] Hub-specific dashboards per staff role (filtered views)

### Phase 3 (Future)
- [ ] Onboarding wizard
- [ ] Campus-specific features
- [ ] Push notifications
- [ ] Email digests
- [ ] Roommate matching algorithm
- [ ] Payment gateway integration

---

## Contact

- **WhatsApp:** [063 732 3192](https://wa.me/27637323192)
- **Email:** reskonnect@gmail.com

---

*This knowledge base is maintained as part of the ResKonnect codebase. Update as features are added or changed.*
