

# Admin Hub Pages — Merge Sub-Pages Into Tabbed Hubs

## What You Want

Instead of 20+ individual sidebar links grouped under headers, you want **4 hub pages** (like the student Marketplace with tabs), and the sidebar should only show 6 clean items:

```text
Overview
Analytics
Operations Hub     → /admin/operations
Commerce Hub       → /admin/commerce
Media Hub          → /admin/media
System Hub         → /admin/system
```

Each hub is a **single page with tabs** that embed the content from existing admin sub-pages.

---

## New Hub Pages

### 1. `src/pages/admin/AdminOperationsHub.tsx`
Route: `/admin/operations`
Tabs: Residences | Portals | Applications | Follow-Up | Documents | Users

Each tab renders the existing page component inline (without its own `AdminLayout` wrapper — the hub provides the layout).

### 2. `src/pages/admin/AdminCommerceHub.tsx`
Route: `/admin/commerce`
Tabs: Marketplace | Stores | Discounts | Discount Orders | Hamper Items

### 3. `src/pages/admin/AdminMediaHub.tsx`
Route: `/admin/media`
Tabs: Hero Slides | News | Events | Bursaries

### 4. `src/pages/admin/AdminSystemHub.tsx`
Route: `/admin/system`
Tabs: WIL Management | WhatsApp Templates | System Status | Settings

---

## Implementation Approach

Each existing admin page (e.g., `AdminResidences`) currently wraps itself in `<AdminLayout>`. To embed them in hub tabs:

1. **Extract content** from each admin page into a separate content component (or render the page content without the `AdminLayout` wrapper)
2. Each hub page wraps itself in `<AdminLayout>` and uses `<Tabs>` to switch between the extracted content components
3. This avoids duplicating any logic — each tab's content IS the existing page logic, just without the outer layout shell

**Pattern**: Each existing admin page gets a small refactor — export a `Content` component alongside the default page export. The hub imports the `Content` version.

---

## Files to Create
| File | Purpose |
|------|---------|
| `src/pages/admin/AdminOperationsHub.tsx` | Tabbed hub: Residences, Portals, Applications, Follow-Up, Documents, Users |
| `src/pages/admin/AdminCommerceHub.tsx` | Tabbed hub: Marketplace, Stores, Discounts, Discount Orders, Hamper Items |
| `src/pages/admin/AdminMediaHub.tsx` | Tabbed hub: Hero Slides, News, Events, Bursaries |
| `src/pages/admin/AdminSystemHub.tsx` | Tabbed hub: WIL, WhatsApp Templates, System Status, Settings |

## Files to Modify
| File | Changes |
|------|---------|
| `src/components/admin/AdminLayout.tsx` | Replace 20 sidebar links with 6 items (Overview, Analytics, 4 hubs) |
| `src/App.tsx` | Add 4 hub routes, keep old routes as redirects to hub with tab param |
| All 16 existing admin pages | Export an inner `Content` component so hubs can embed them without double `AdminLayout` |

---

## Sidebar After Change

```text
Overview           /admin
Analytics          /admin/analytics
Operations Hub     /admin/operations
Commerce Hub       /admin/commerce
Media Hub          /admin/media
System Hub         /admin/system
```

6 items. Clean. God Mode.

Old routes like `/admin/residences` will redirect to `/admin/operations?tab=residences` for backward compatibility.

