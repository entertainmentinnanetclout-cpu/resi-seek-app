# Development Execution Plan (Phase 1a)

## Goal: Establish the Agnostic Core

### 1. Database Schema Update
- Add `institutions` table: `id`, `name`, `slug`, `logo_url`, `type` (university/tvet/private), `website_url`.
- Add `campuses` table: `id`, `institution_id` (FK), `name`, `city`, `coordinates`.
- Migration: Seed with TUT, UP, UJ, Wits data to demonstrate V2 readiness.

### 2. Logic Refactor
- Update `useRealtimeResidences` or create a new `useInstitutions` hook.
- Refactor `FilterSidebar` to fetch categories and campuses from the database instead of static files.

### 3. UI Normalization
- Global search/replace (carefully) for "TUT" in labels and replace with dynamic strings.
- Update `PublicLayout` footer to use dynamic Province/Institution links.

### 4. Verification
- All existing TUT-based residences must still appear and function correctly.
- New residences for "University of Pretoria" can now be added and filtered correctly.
