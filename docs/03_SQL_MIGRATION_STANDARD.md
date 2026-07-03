# 03. SQL Migration Standard

## 1. Migration Structure
Every SQL change must be re-runnable and idempotent.

### Required Header
```sql
-- Migration: [Descriptive Name]
-- Date: [YYYY-MM-DD]
-- Domain: [Domain Name]
```

### Idempotency Patterns
- **Tables**: `CREATE TABLE IF NOT EXISTS public.table_name (...)`
- **Columns**: `ALTER TABLE public.table_name ADD COLUMN IF NOT EXISTS column_name data_type;`
- **Policies**: Use `DO` blocks to check for existence before `CREATE POLICY`.
- **Functions**: `CREATE OR REPLACE FUNCTION ...`

## 2. The Verification Block
Every migration must conclude with a verification block to confirm success.
```sql
-- Verification
SELECT count(*) FROM table_name;
SELECT * FROM pg_policies WHERE tablename = 'table_name';
```

## 3. Rollback Strategy
Include a commented-out rollback block at the bottom of the file.
```sql
/* ROLLBACK:
   DROP TABLE IF EXISTS table_name;
   ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;
*/
```

## 4. Duality Management
- **External Supabase**: The authoritative production database.
- **Lovable Mirror**: Used for preview and staging.
**Rule**: Migrations must be run on the Lovable Mirror first, then immediately applied to External Supabase.

## 5. Security Checklist
- `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- `GRANT ALL ON TABLE table_name TO service_role, postgres, authenticated, anon;` (Explicitly limit anon later).
- Define policies for SELECT, INSERT, UPDATE, DELETE.
