# Admin Hub Pages — Merge Sub-Pages Into Tabbed Hubs

## Status: ✅ Complete

## Structure

```text
Overview           /admin
Analytics          /admin/analytics
Operations Hub     /admin/operations   (Residences | Portals | Applications | Follow-Up | Documents | Users)
Commerce Hub       /admin/commerce     (Marketplace | Stores | Discounts | Discount Orders | Hamper Items)
Media Hub          /admin/media        (Hero Slides | News | Events | Bursaries)
System Hub         /admin/system       (WIL Management | WhatsApp Templates | System Status | Settings)
```

6 sidebar items. Each hub is a tabbed page embedding existing admin content components.

## Files Created
- `src/pages/admin/AdminOperationsHub.tsx`
- `src/pages/admin/AdminCommerceHub.tsx`
- `src/pages/admin/AdminMediaHub.tsx`
- `src/pages/admin/AdminSystemHub.tsx`

## Files Modified
- All 16 admin sub-pages: exported `Content` component, removed `AdminLayout` wrapper from content
- `src/components/admin/AdminLayout.tsx`: Simplified sidebar to 6 items
- `src/App.tsx`: Added 4 hub routes, kept legacy routes for backward compatibility
