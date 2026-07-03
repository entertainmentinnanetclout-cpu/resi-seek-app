# 19. Storage Reference (Buckets)

## 1. Bucket Catalog

| Bucket ID | Access | Content | RLS Strategy |
|-----------|--------|---------|--------------|
| `documents` | Private | Student IDs, Bank Statements. | `foldername(name)[1] = uid` |
| `application-documents`| Private | Proof of Registration, Affidavit. | `foldername(name)[1] = uid` |
| `wil-documents`| Private | Logbooks, CVs. | `foldername(name)[1] = uid` |
| `profile-pictures` | Public | User avatars. | Open read; UID write. |
| `admin-images` | Public | Sliders, Bursary logos. | Admin only write. |
| `marketplace` | Public | Product photos. | Owner only write. |

## 2. Policy Implementation Example
```sql
CREATE POLICY "Users can upload own docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
```

## 3. Maintenance Rules
- Never delete files manually via Dashboard; use the application UI to ensure database metadata remains synced.
- Standard image optimization (WebP) is handled at the client level before upload.
