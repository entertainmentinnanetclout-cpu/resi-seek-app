# Real residence photography + WhatsApp Business manual smart handoff

## Shared case logic

Both the official HTML email and the WhatsApp handoff use `previewPacket` and its deterministic application/reservation document-awareness and factual decision guards. Uploaded documents alone never imply acceptance. Only recorded `approved`, `rejected`, `conditionally_approved` and `confirmed` statuses can use their formal decision templates.

## Premium residence image

- The server reads the actual **published** primary residence photo from `resmap_residence_media` (or the residence's public cover/listing image).
- Images are accepted only from the project's **public** Supabase storage buckets `admin-images` or `residence-assets`. Signed/private storage links, unexpected origins, unsupported files and redirects are rejected. The backend checks image MIME, signature and size before adding it to PDF.
- Where available, the email HTML shows the real photo, residence name and existing fully branded footer. The A4 PDF letter includes the matching property picture beneath the official case reference. No property photo is generated or falsely substituted when a listing lacks one.
- Email client image loading varies by the recipient's email settings; the photo is also embedded into the PDF when a valid published JPEG or PNG can be loaded.

## WhatsApp Business manual workflow

1. Open the existing applicant, reservation, lead or consented support enquiry. Choose **WhatsApp confirmation/follow-up** (direct case links) or the **WhatsApp** tab inside the Premium Email Dock.
2. Press **Generate WhatsApp confirmation**. The server checks the operator's ResKonnect role and residence assignment, reads current status, checks document uploads and renders the **same** selected email template with the case reference and required steps.
3. Preview the correct applicant and masked WhatsApp contact. Copy the prefilled message if required.
4. Download the official branded PDF and actual residence photo (if available) for attachment.
5. Tick the operator review confirmation and click **Open prefilled WhatsApp Business chat**. This opens a `wa.me` link in WhatsApp Web/Business with the message prefilled. **Nothing is sent by the website.**
6. Inside WhatsApp, optionally attach the photo and PDF, then **press Send yourself**. Afterwards, choose **Mark sent by me** if desired. This records a manual operator claim, not delivery/read status.

No WhatsApp Cloud API, web automation, AI message sending, programmatic media attachment or sending rights are required. Your WhatsApp Business AI assistant remains separate.

### Privacy and operational safeguards

- Phone selection happens on the Supabase server, with strict international number normalization; the preview only shows the last four digits.
- Each `wa.me` link is returned only after explicit operator confirmation and re-verification of the case status, document stage and exact message preview hash.
- Manual handoffs are audited in `reskonnect_whatsapp_handoffs` with only the last four phone digits and a SHA-256 of the message — **not the full applicant phone or message**. RLS is enabled, and service-role Edge Functions alone can access the ledger.
- An opened WhatsApp tab is never reported as sent. The optional operator-marked-sent action is clearly labeled as unverified.
- The process is **one applicant at a time**; WhatsApp mass sending is not enabled. Existing Gmail batch limits are unchanged.

### Setup / verification

- Backend: `supabase/functions/reskonnect-email-dock` plus `residence-media.ts` and `whatsapp.ts`.
- Frontend: `src/components/communications/ManualWhatsAppPanel.tsx` embedded in `PremiumEmailDock.tsx`, with contextual buttons on the landlord and admin application/reservation/CRM views.
- Database migration: `supabase/migrations/20261108160000_reskonnect_manual_whatsapp_handoff.sql` already applied to project `mefjzkhobkltlbmhusdh`.
- Test cases: `scripts/reskonnect-whatsapp-handoff.test.mjs`; CI runs alongside the existing premium email case-decision safety tests.

Manual operator QA with consenting test applicant required: check correct local/international phone, missing document workflow, uploaded document workflow, approval guards, HTML photo render, PDF containing actual photo, WhatsApp prefilled text and manual download/attachment on mobile and desktop. Do not send to real students as part of engineering tests.

WhatsApp click-to-chat reference: https://faq.whatsapp.com/5913398998672934/ .