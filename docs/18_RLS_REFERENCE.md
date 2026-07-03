# 18. RLS Reference (Security Policies)

## 1. Global Policies

### Default Deny
All tables have `ENABLE ROW LEVEL SECURITY`. Default behavior is to return 0 rows for unauthenticated or unauthorized requests.

### Admin Override
Most tables include this policy:
`CREATE POLICY "Admins have full access" ON "public"."table" TO authenticated USING (has_role(auth.uid(), 'admin'));`

## 2. Domain Policies

### Student Scoped Tables
- `profiles`: `auth.uid() = id`.
- `applications`: `auth.uid() = user_id`.
- `documents`: `auth.uid() = user_id`.
- `notifications`: `auth.uid() = user_id`.

### Residence Portal Scoped Tables
- `applications`: `is_authorized_residence_user(residence_id)`.
- `application_documents`: `is_authorized_residence_user(residence_id)`.
- `residence_portal_accounts`: `auth.uid() = user_id`.

### Publicly Readable Tables
- `residences`: Read-only for `anon` and `authenticated`.
- `hero_slides`: Read-only for everyone.
- `campus_news`: Read-only for everyone.
- `student_discounts`: Read-only for everyone.

## 3. Marketplace Policies
- `stores`: Only the owner can `UPDATE` (`auth.uid() = user_id`).
- `marketplace_listings`: Anyone can `SELECT` where `status = 'active'`.
