

# Make Content Pages Publicly Accessible (Share-Friendly)

## Problem
Currently, all content pages (residences, bursaries, events, news, marketplace, deals) are wrapped in `StudentRoute`, which forces login before viewing. Users can't share links — recipients get redirected to `/auth`.

## Solution
Make browse/view pages public. Only require auth when users take actions (apply, favorite, review, order, etc.).

## Routes to Make Public (remove `StudentRoute` wrapper)

These are **read-only browsing** pages — no auth needed to view:

| Route | Page | Currently |
|-------|------|-----------|
| `/find`, `/findmyres` | FindMyRes | `StudentRoute` → **Public** |
| `/res/:id` | ResidenceDetail | `StudentRoute` → **Public** |
| `/bursaries` | BursaryFinder | `StudentRoute` → **Public** |
| `/bursary/:id` | BursaryDetail | `StudentRoute` → **Public** |
| `/marketplace` | Marketplace | `StudentRoute` → **Public** |
| `/product/:id` | ProductDetail | `StudentRoute` → **Public** |
| `/store/:storeId` | Store | `StudentRoute` → **Public** |
| `/discounts` | StudentDeals | `StudentRoute` → **Public** |
| `/hamper` | StudentDeals | `StudentRoute` → **Public** |
| `/events` | Events | `StudentRoute` → **Public** |
| `/campus-news` | CampusNews | `StudentRoute` → **Public** |
| `/roommates` | RoommateFinder | `StudentRoute` → **Public** |

## Routes That Stay Protected (require auth)

| Route | Reason |
|-------|--------|
| `/dashboard` | Personal dashboard |
| `/profile` | Personal data |
| `/applications` | Personal applications |
| `/messages` | Personal messages |
| `/favorites` | Personal favorites |
| `/documents` | Personal documents |
| `/orders` | Personal orders |
| `/cart`, `/checkout` | Purchase flow |
| `/wil` | Personal WIL application |
| `/my-store`, `/store-setup` | Store owner actions |
| `/my-discount-orders` | Personal orders |
| `/setup-profile` | Profile setup |
| All `/admin/*` | Admin only |

## Layout Change for Public Pages

These pages currently use `DashboardLayout` which depends on `useAuth()` for user data. Two approaches:

**Chosen approach**: Make `DashboardLayout` gracefully handle unauthenticated users:
- If `user` is null, show a simplified header with Sign In / Get Started buttons (similar to `PublicLayout`)
- Hide sidebar nav items that require auth (Applications, My WIL)
- Show all browse items (Find My Res, Marketplace, Bursaries)
- Replace profile avatar with Sign In button when not logged in

This avoids rewriting every page to conditionally pick a layout.

## Action Gating (Auth Prompts)

On public pages, when an unauthenticated user tries to:
- **Apply** to a residence → redirect to `/auth` with return URL
- **Favorite** a residence → redirect to `/auth`
- **Submit a review** → redirect to `/auth`
- **Add to cart** → redirect to `/auth`
- **Order a deal/hamper** → redirect to `/auth`
- **RSVP to event** → redirect to `/auth`

Each action component already checks `user` from `useAuth()` — just need to ensure they redirect to `/auth?returnTo=<current_path>` instead of silently failing.

## Auth Page: Return URL Support

Update `Auth.tsx` to read `returnTo` query param and redirect there after successful login instead of always going to `/dashboard`.

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Remove `StudentRoute` wrapper from 12 browse routes |
| `src/components/DashboardLayout.tsx` | Handle unauthenticated users gracefully (show sign-in header instead of crashing) |
| `src/pages/ResidenceDetail.tsx` | Gate apply/favorite/review actions with auth redirect |
| `src/pages/FindMyRes.tsx` | Remove `useAdminRedirect`, gate actions with auth check |
| `src/pages/Marketplace.tsx` | Remove `useAdminRedirect`, gate cart/order actions |
| `src/pages/ProductDetail.tsx` | Gate add-to-cart with auth redirect |
| `src/pages/Events.tsx` | Gate RSVP/interest with auth redirect |
| `src/pages/StudentDeals.tsx` | Gate order actions with auth redirect |
| `src/pages/Auth.tsx` | Support `returnTo` query param for post-login redirect |
| `src/components/FavoriteButton.tsx` | Redirect to auth if not logged in |
| `src/components/ReviewForm.tsx` | Redirect to auth if not logged in |

## No Database Changes Needed

All the browse tables (residences, bursaries, events, campus_news, student_discounts, marketplace_listings, products) already have public SELECT RLS policies. No migration required.

