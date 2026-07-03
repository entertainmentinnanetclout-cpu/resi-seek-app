# 02. Database Standards

## 1. Pre-Development Data Audit
Refer to the [Detailed Database Audit](./Audits/04_DATABASE_AUDIT.md) for findings on redundant tables, missing indexes, and unused columns.

## 2. Master Entity Relationship Map (ERM)

### Institution Domain
- **Institution**: `id`, `name`, `slug`, `type` (Uni/TVET).
- **Campuses**: `id`, `institution_id` (FK), `name`, `city`, `coordinates`.
- **Accreditation**: `id`, `residence_id` (FK), `institution_id` (FK), `status`.

### Accommodation Domain
- **Residences**: `id`, `name`, `slug`, `address`, `capacity`.
- **Sections**: `id`, `residence_id` (FK), `name` (e.g., Floor 1).
- **Rooms**: `id`, `section_id` (FK), `room_number`, `type` (Single/Double).
- **Beds**: `id`, `room_id` (FK), `status` (Available/Occupied).

### Student Domain
- **Profiles**: `id` (PK, Auth), `full_name`, `email`, `campus`.
- **Applications**: `id`, `user_id` (FK), `residence_id` (FK), `status`.
- **Documents**: `id`, `user_id` (FK), `file_path`, `type`.
- **Referrals**: `user_id`, `code`, `signup_count`, `total_earned`.

## 2. Naming & Type Standards
- **Tables**: Pluralized snake_case (e.g., `residences`).
- **Columns**: snake_case (e.g., `is_active`).
- **Booleans**: Prefixed with `is_`, `has_`, or `should_`.
- **Timestamps**: `created_at` and `updated_at` (managed by triggers).
- **Primary Keys**: `uuid` with `gen_random_uuid()` default.

## 3. SQL Rules
- Every table must have Row Level Security (RLS) enabled.
- Foreign Keys must have explicit `ON DELETE` actions (usually `CASCADE` or `SET NULL`).
- Use Partial Indexes for common filtered queries (e.g., `WHERE is_active = true`).
- GIN indexes for array columns (e.g., `institution_tags`).

## 4. RLS Verification
Before any migration is finalized, verify:
- `anon` cannot read sensitive data.
- `authenticated` students can only read their own data.
- `admin` can bypass RLS via `has_role` check.
