# Enhance Admin Marketplace into a Takealot-Style Store Manager

## Problem

The admin marketplace tab only moderates student `marketplace_listings`. It cannot create products in the `products` table (the newer commerce model that the Marketplace page actually fetches from). Admin has no way to list products as the "ResKonnect Store."

## Architecture

The admin needs a **ResKonnect Official Store** — a store owned by the admin user, just like any student store, but with elevated capabilities. The Commerce Hub marketplace tab will be rebuilt to:

1. **Auto-create a "ResKonnect Store"** for the admin user if one does not exist
2. **Full Product CRUD** — add, edit, delete products in the `products` table (not `marketplace_listings`)
3. **Category management** — manage `product_categories`
4. **Image uploads** to the existing `product-images` bucket
5. **Inventory & variants** — set stock, price, compare-at-price, SKU, variants
6. **Legacy moderation** — keep a sub-tab for moderating student `marketplace_listings`

## Plan

### 1. Rewrite `AdminMarketplace.tsx` with two sub-tabs

- **"ResKonnect Store"** (default): Full product management UI
  - Product grid/table with add/edit/delete
  - "Add Product" dialog/form: name, description, price, compare-at-price, category, images (multi-upload), stock, SKU, tags, is_featured toggle
  - Edit inline or via dialog
  - Image upload to `product-images` bucket
  - Category selector from `product_categories`
  - Quick toggle for `is_active` and `is_featured`
- **"Student Listings"**: Current moderation table (verify/remove student `marketplace_listings`)

### 2. Ensure admin has a store record

- On mount, check if admin's user has a store. If not, auto-create one named "ResKonnect Store" with `verified: true` and `is_active: true`.
- Store the admin's `store_id` for all product inserts.

### 3. Product CRUD operations

- **Create**: Insert into `products` with `store_id` = admin's store
- **Update**: Edit price, stock, images, featured status, active status
- **Delete**: Delete from `products`
- All operations use existing RLS policies (`admins_manage_all_products`)

### 4. Category management (inline)

- Small "Manage Categories" section or button to add/edit categories in `product_categories`

### 5. No database changes needed

- `products`, `product_categories`, `product_variants` tables already exist with proper admin RLS policies
- `product-images` storage bucket already exists and is public

6.products must have product pages with full detail,sizes,texture ,etc.

## Files Modified


| File                                   | Change                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/pages/admin/AdminMarketplace.tsx` | Full rewrite: two sub-tabs (ResKonnect Store + Student Listings), product CRUD form, image upload, category management |


## Technical Details

- Uses `supabase.storage.from('product-images').upload()` for images
- Queries `products` table with `store_id` filter for admin's store
- Categories from `product_categories`
- Products auto-verified and active when admin creates them
- Existing `AdminMarketplaceContent` moderation code preserved as "Student Listings" sub-tab