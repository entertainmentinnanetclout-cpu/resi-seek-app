# Gmail communications deployment

## Dashboards

- Landlord portal: /residence/communications. Direct actions are available from applications, reservations, and leads.
- ResKonnect admin: /admin/communications?tab=email. Direct actions are available from application and reservation records.
- Outbound subjects and messages are generated from the latest database record. Recipients are never accepted from browser-supplied email addresses.

## Supabase and Google configuration

Project: mefjzkhobkltlbmhusdh.

Environment secrets: GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, GOOGLE_GMAIL_REDIRECT_URI.

Authorized Google OAuth redirect:
https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/gmail-callback

Google API scope: https://www.googleapis.com/auth/gmail.send. OAuth public verification may be required. During Google OAuth Testing, the test Gmail accounts must be explicitly permitted in Google's consent-screen configuration.

The existing Supabase Google sign-in continues independently and is not modified.

## Runtime and database

- gmail-connect: JWT-guarded Gmail connection, status and disconnection.
- gmail-callback: Google OAuth code exchange; PKCE, one-use hashed state and ten-minute expiry; requires no JWT because it receives Google's redirect.
- reskonnect-email: JWT-guarded, records-based manual email previews and sending, encrypted Vault refresh token usage and private sending history.
- gmail-send: previously deployed reservation-only sender; new dashboard uses reskonnect-email.
- SQL migration: supabase/migrations/20261108130000_reskonnect_gmail_communications.sql.
- Live Supabase has the objects already; reconcile migration history when deploying through the CLI.

Authorization: administrators require the admin role. Landlords require the residence_portal role and an active residence_portal_accounts record. Server validation checks the exact residence ownership of each target. Student email addresses remain private to landlords.

Service safety: user-confirmed preview before sending, one-minute same-record duplicate protection, per-account 80-attempt 24-hour cap, audit log, uncertain-delivery status on network failure, and revocable Gmail authorization.

## Test checklist

1. As an authorized landlord, connect a controlled Google test account and verify Gmail shows connected.
2. Preview and send controlled application feedback; compare content with the recorded application status and confirm message appears in Gmail Sent.
3. Test reservation and housing-lead email actions using consenting test records; verify student email remains hidden in the landlord API responses.
4. As an administrator, connect the official ResKonnect Gmail and send controlled application/reservation and consented support enquiry messages from the Communications & Service tab.
5. Deny calls from unauthenticated users, students and unassigned landlords; verify expired OAuth states and invalid IDs are rejected.
6. Test disconnected Gmail, denied permissions, duplicate sends and unknown delivery outcomes. Verify responsive layout and email history.
7. Run the repository CI workflows, review Supabase function logs and complete Google OAuth app verification before production rollout.

## Scope boundaries

The Gmail permission is send-only: replies are not automatically imported, delivery/open receipts are not available, and emails do not change application or reservation statuses. A one-click, authenticated student reservation acceptance flow and automated transactional triggers remain separate features. The existing AdminOS email agent is not replaced.