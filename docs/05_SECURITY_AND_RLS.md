# 05. Security & RLS

## 1. Permission Architecture
We utilize Supabase Row Level Security (RLS) as our primary security layer.

### Rule 1: Default Deny
All new tables must have RLS enabled immediately:
`ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;`

### Rule 2: Least Privilege
Users should only have access to the data required for their role.

## 2. Policy Patterns

### Student Access
```sql
CREATE POLICY "Users can view own data"
ON public.table_name
FOR SELECT
USING (auth.uid() = user_id);
```

### Admin Access (Global)
```sql
CREATE POLICY "Admins have full access"
ON public.table_name
TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

### Specialist Access (Scoped)
Specialists (e.g., `commerce_lead`) are granted access via specific UI routes and matching RLS policies on domain-relevant tables.

## 3. Storage Security
- **Public Buckets**: Used for non-sensitive assets (hero images, news photos).
- **Private Buckets**: Used for student documents and payment proofs.
- **Path-based RLS**: `(storage.foldername(name))[1] = auth.uid()::text` ensures users can only access their own subfolders.

## 4. Edge Function Security
- Functions must verify the caller's JWT using `supabase.auth.getUser()`.
- Use `service_role` client inside functions only when cross-table bypass is technically required.
