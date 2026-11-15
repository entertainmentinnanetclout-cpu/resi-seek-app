# SEC-07/08 — Storage upload MIME and file size caps
**15 November 2026 — project `mefjzkhobkltlbmhusdh`**

## Observed baseline
Twelve established buckets have `file_size_limit IS NULL` and `allowed_mime_types IS NULL`. This leaves uploads subject only to broader project limits and any client-side restrictions, which do not defend direct Storage API calls. Their existing owner/RLS policies have been reviewed separately under PR #229.

Across these buckets, existing files were JPEG/PNG images except four historical `application/octet-stream` objects in `admin-images`; there were no existing KYC or complaint uploads. No file contents or identifiable names were inspected. The largest observed image in `admin-images` was 14,886,584 bytes, below the new 25 MiB limit. Existing objects are not modified or deleted by this migration.

## New bucket server settings
| Bucket | Max file | Allowlist |
| --- | ---: | --- |
| `admin-images` | 25 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |
| `bursary-images` | 10 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |
| `campaign-assets` | 10 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |
| `complaint-attachments` | 15 MiB | `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, `image/avif`, `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `hamper-images` | 10 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |
| `marketplace` | 10 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |
| `product-images` | 12 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |
| `profile-pictures` | 5 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |
| `seller-kyc` | 15 MiB | `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, `image/avif` |
| `store-assets` | 10 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |
| `store-banners` | 12 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |
| `user-profiles` | 8 MiB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif` |

The allowlists reject **new** arbitrary MIME, HTML and scriptable SVG uploads. Historical `application/octet-stream` objects in `admin-images` remain readable; replacing one as another octet-stream file will now be blocked unless the client identifies an allowed image type. MIME metadata is not a complete content validator—file signatures, malware scanning, CDN content-security headers, and privileged review remain follow-up requirements.

## Student, seller and administrator UX
`ImageInput`, `StoreSetup` and `StoreEdit` now validate against the same image allowlist before uploading. `SellerOnboarding` validates logos and private verification documents, explicitly accepts JPEG/PNG/WebP/HEIC/HEIF/AVIF/PDF identity evidence, and **fails submission if upload fails** instead of silently saving an empty verification file. Existing profile photo uploader already enforces 5 MiB and JPEG/PNG/WebP/GIF, all of which remain compatible.

## Deployment and acceptance
1. Read live Supabase Storage settings and object MIME/size distributions before modifying; confirm precisely 12 unconfigured buckets.
2. SQL migration sets only the two standard bucket configuration columns; it changes no Storage schema objects, bucket visibility, file contents, ownership, access grants or RLS policies. Fail closed if baseline has shifted.
3. Verify exact 12 limits and MIME arrays from live `storage.buckets`, preexisting object counts, role-level SELECT/INSERT controls and Security Advisor.
4. Confirm mandatory CI tests and seven release workflows. Actual HTTP multipart upload tests should also be performed with a dedicated disposable testing account before claiming that Storage's external service rejects spoofed content-type or oversized payloads.
5. If compatibility failures occur, use the official Storage dashboard/API to edit **only the affected bucket**. Do not roll back ownership/privacy fixes or disable global safety controls.

## Auth controls remain independent
Supabase Auth hosted rate limits, OTP/recovery throttles and bot protection must be inspected under **Authentication > Rate Limits** and **Authentication > Bot and Abuse Protection**. The connected Supabase database tools do not expose current effective values. No dashboard-only Auth settings or CAPTCHA/Turnstile secrets are changed by this PR. Avoid enabling CAPTCHA at the server before signup and recovery flows can pass provider tokens.
