# Admin Sidebar Restructure — 4 Hubs

## Overview

Reorganize the flat 20-item admin sidebar into 4 grouped sections with collapsible headers, plus 2 standalone top-level items (Overview and Analytics). No routes or pages change — purely sidebar UI reorganization.

## New Sidebar Structure

```text
Overview              (standalone)
Analytics             (standalone)

── OPERATIONS HUB ──────────
  Residences
  Residence Portals
  Applications
  Follow-Up
  Documents
  Users

── COMMERCE HUB ────────────
  Marketplace
  Stores
  Discounts
  Discount Orders
  Hamper Items

── MEDIA HUB ───────────────
  Hero Slides
  News
  Events
  Bursaries

── SYSTEM HUB ──────────────
  WIL Management
  WhatsApp Templates
  System Status
  Settings
```

## Changes

### File: `src/components/admin/AdminLayout.tsx`

- Replace flat `navItems` array with a grouped structure: an array of sections, each with a `label` (string or null for standalone items) and `items` array.
- Standalone items (Overview, Analytics) rendered at top without a section header.
- Each hub section gets a muted uppercase label divider (e.g., `text-xs font-semibold text-muted-foreground uppercase tracking-wider`) followed by its nav links.
- No collapsible/accordion behavior needed — just visual grouping with label dividers.
- All existing paths, icons, and labels stay identical.
- fix all missing routes and provide full fk sql fo all missing tables,poliies shemas and everything missing
- turn the admij dahsboard into god mode dashborad 

### No other files modified

All admin pages, routes, and `App.tsx` remain unchanged.