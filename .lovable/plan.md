# Upgrade Admin Layout: Collapsible Sidebar + Enhanced Dashboard

## Problem

The current `AdminLayout` uses a fixed 64px-wide sidebar on desktop and a Sheet drawer on mobile. It cannot be collapsed, so admin content is always constrained. The dashboard also needs to reflect the newly updated FindMyRes page management (residence sections, availability, filters).

## Solution

SECTION A

### 1. Replace AdminLayout sidebar with collapsible Shadcn Sidebar

Rewrite `AdminLayout.tsx` to use `SidebarProvider` + `Sidebar` with `collapsible="icon"`:

- **Expanded**: Shows icons + labels (w-64)
- **Collapsed**: Shows icons only (w-14), giving full-width content area
- **Mobile**: Uses Sheet (offcanvas) with `SidebarTrigger` always visible in header
- `SidebarTrigger` placed in the top header bar so it's always accessible

### 2. Enhance AdminDashboard with FindMyRes management stats

Add new stat cards for:

- **Residence Sections** count (from `residence_sections` table)
- **Available Spots** total across all residences
- **Full Residences** count (where `available_spots = 0`)
- Quick action link to "Manage Sections" (routes to Operations Hub > Residences > Sections tab)

### 3. Update all Hub pages

All 4 hub pages (`AdminOperationsHub`, `AdminCommerceHub`, `AdminMediaHub`, `AdminSystemHub`) already use `<AdminLayout>` as wrapper — they'll automatically get the collapsible sidebar with no changes needed.

## Files Modified


| File                                   | Change                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/admin/AdminLayout.tsx` | Full rewrite: replace fixed sidebar with Shadcn `Sidebar` + `SidebarProvider`, `collapsible="icon"`, `SidebarTrigger` in header |
| `src/pages/admin/AdminDashboard.tsx`   | Add FindMyRes management stats (sections count, available spots, full residences), update quick actions                         |


## Technical Details

**AdminLayout structure:**

```text
<SidebarProvider>
  <div className="min-h-screen flex w-full">
    <Sidebar collapsible="icon">
      <SidebarHeader> Logo + Role badge </SidebarHeader>
      <SidebarContent>
        <SidebarGroup> Nav items </SidebarGroup>
      </SidebarContent>
      <SidebarFooter> Refresh, Public Site, Logout </SidebarFooter>
    </Sidebar>
    <div className="flex-1 flex flex-col">
      <header> <SidebarTrigger /> <ThemeToggle /> </header>
      <main> {children} </main>
    </div>
  </div>
</SidebarProvider>
```

- Nav items use `SidebarMenuItem` + `SidebarMenuButton` with active state highlighting
- Collapsed mode hides labels, shows only icons via Sidebar's built-in behavior
- Role badge shown in header when collapsed, in sidebar header when expanded
- All existing nav items and role filtering preserved

**Dashboard additions:**

- 3 new queries: `residence_sections` count, sum of `available_spots`, count where `available_spots = 0`
- New "FindMyRes" section in the dashboard grid between Operations and Commerce hubs
- Quick action for "Sections" linking to `/admin/operations?tab=residences`

&nbsp;

settion b 

Now we move from “good system” → **enterprise-grade operational infrastructure**.

What IM asking for is not just SQL — this is:  
👉 **A unified, deduplicated, self-healing backend architecture for Supabase AND UI , UX**

YOU SHOULD GIVE ME

1. 🧠 Enterprise architecture rules (Lovable MUST follow)
2. 🧱 Master re-runnable SQL (idempotent, safe)
3. 🔄 Deduplication enforcement (NO duplicate modules/tabs)
4. ⚡ Event + analytics system (for your admin intelligence)
5. 🔐 RLS + performance layer
6. 🚨 Auto-detection of conflicts
7. FULLY UPDATED INTELLIGENT ADMIN DASH

---

# 🧠 1. NON-NEGOTIABLE RULES (ADD TO LOVABLE PROMPT)

Use this EXACTLY:

```txt
SYSTEM RULES (CRITICAL):

1. ALWAYS use external Supabase (no local schema assumptions)

2. ALL SQL MUST be:
   - Re-runnable (idempotent)
   - Use IF NOT EXISTS / DO $$ blocks
   - Never duplicate tables, enums, or columns

3. BEFORE creating ANY table/feature:
   - Check if similar structure already exists
   - Reuse existing tables/functions if possible
   - Extend instead of duplicating

4. NEVER create duplicate modules:
   Example:
   - If "applications" exists → DO NOT create "student_applications"
   - If "orders" exists → DO NOT create "marketplace_orders_v2"

5. ALWAYS unify:
   - Applications = ONE system
   - Orders = ONE system
   - Users = ONE system

6. If duplicate logic is found:
   - Merge into single source of truth
   - Add compatibility layer if needed

7. ALWAYS provide:
   - SQL migrations
   - indexes
   - RLS policies
   - triggers (if needed)

8. All admin features must connect to SAME backend tables
   (no parallel systems)

FINAL RULE:
→ ONE SYSTEM PER DOMAIN (NO DUPLICATION)

```

---

# 🧱 2. MASTER ENTERPRISE SQL (RE-RUNNABLE)

This is your **core upgrade layer**.

---

## 🔹 2.1 SYSTEM EVENTS (FOR REAL-TIME ADMIN INTELLIGENCE)

```sql
-- EVENT LOG SYSTEM (GLOBAL TRACKING)
CREATE TABLE IF NOT EXISTS system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC);

```

---

## 🔹 2.2 AUTO EVENT TRIGGERS

### Applications

```sql
CREATE OR REPLACE FUNCTION log_application_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO system_events(type, entity, entity_id, metadata)
  VALUES (
    'NEW_APPLICATION',
    'applications',
    NEW.id,
    jsonb_build_object('user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_application_event ON applications;

CREATE TRIGGER trg_application_event
AFTER INSERT ON applications
FOR EACH ROW
EXECUTE FUNCTION log_application_event();

```

---

### Orders

```sql
CREATE OR REPLACE FUNCTION log_order_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO system_events(type, entity, entity_id)
  VALUES ('NEW_ORDER', 'shop_orders', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_event ON shop_orders;

CREATE TRIGGER trg_order_event
AFTER INSERT ON shop_orders
FOR EACH ROW
EXECUTE FUNCTION log_order_event();

```

---

### Residences FULL detection

```sql
CREATE OR REPLACE FUNCTION detect_full_residence()
RETURNS trigger AS $$
BEGIN
  IF NEW.available_spots = 0 THEN
    INSERT INTO system_events(type, entity, entity_id)
    VALUES ('RESIDENCE_FULL', 'residences', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_residence_full ON residences;

CREATE TRIGGER trg_residence_full
AFTER UPDATE ON residences
FOR EACH ROW
EXECUTE FUNCTION detect_full_residence();

```

---

# 🔥 3. ADMIN ALERT SYSTEM

```sql
CREATE TABLE IF NOT EXISTS admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  severity text DEFAULT 'info',
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_resolved ON admin_alerts(resolved);

```

---

### Auto alert example (stuck applications)

```sql
INSERT INTO admin_alerts (title, description, severity)
SELECT 
  'Stuck Application',
  'Application pending over 48 hours',
  'warning'
WHERE EXISTS (
  SELECT 1 FROM applications
  WHERE created_at < now() - interval '48 hours'
);

```

---

# 🔥 4. RESIDENCE PERFORMANCE TABLE (ANALYTICS LAYER)

```sql
CREATE TABLE IF NOT EXISTS residence_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id uuid,
  views integer DEFAULT 0,
  applications integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

```

---

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_residence_analytics_residence 
ON residence_analytics(residence_id);

```

---

# 🔥 5. FILTER CONFIG SYSTEM (ADMIN CONTROL)

```sql
CREATE TABLE IF NOT EXISTS filter_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE,
  enabled boolean DEFAULT true,
  position integer DEFAULT 0
);

```

---

👉 This controls:

- FindMyRes filters
- Ordering
- Visibility

---

# 🔥 6. GLOBAL SEARCH INDEX TABLE (FOR ADMIN COMMAND BAR)

```sql
CREATE TABLE IF NOT EXISTS global_search (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text,
  entity_id uuid,
  label text,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_global_search_label 
ON global_search USING gin (to_tsvector('english', label));

```

---

# 🔐 7. RLS (BASIC ENTERPRISE SETUP)

```sql
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only"
ON system_events
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins alerts access"
ON admin_alerts
FOR ALL
USING (auth.role() = 'authenticated');

```

---

# ⚡ 8. REALTIME ENABLEMENT

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE system_events;
ALTER PUBLICATION supabase_realtime ADD TABLE admin_alerts;

```

---

# 🚨 9. DUPLICATION DETECTION (CRITICAL)

This is your **anti-chaos layer**.

```sql
-- Detect duplicate tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
GROUP BY table_name
HAVING COUNT(*) > 1;

```

---

👉 Lovable must:

- NOT create new tables if similar exist
- Extend existing schema

---

# 🧠 10. WHAT THIS GIVES YOU

After this:

### You now have:

✔ Real-time admin activity feed  
✔ Event tracking system  
✔ Alert engine  
✔ Analytics foundation  
✔ Filter control system  
✔ Global search backend  
✔ Anti-duplication enforcement

---

# ⚡ FINAL MASTER PROMPT ADD-ON

```txt
ENTERPRISE UPGRADE REQUIREMENTS:

- Convert admin into operational intelligence system
- Implement system_events logging
- Implement admin_alerts system
- Implement residence analytics tracking
- Implement global search index

CRITICAL:
- NEVER duplicate systems
- ALWAYS reuse existing tables
- If a similar feature exists → extend it

ALL BACKEND:
- Must use external Supabase
- Must be re-runnable SQL
- Must include indexes and RLS

GOAL:
→ ONE UNIFIED SYSTEM (NO DUPLICATION, NO FRAGMENTATION)

```

---

# 🔥 NEXT LEVEL SECTION C

If you want to go even further:

  
✅ Full **event tracking (views, clicks, conversions)**  
✅ AI-based **residence ranking algorithm**  
✅ Automated **matching engine scoring system**  
✅ Revenue + occupancy forecasting

&nbsp;