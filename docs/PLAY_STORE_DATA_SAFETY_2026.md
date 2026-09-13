# Google Play Data Safety Draft — ResKonnect Android v1
Prepared 13 September 2026.

Final Play Console answers must match the exact production build.

## Security and deletion
- Data encrypted in transit: Yes.
- Users can request account deletion: Yes.
- External deletion URL: https://www.reskonnect.org/delete-account
- In-app route: Profile → Account & Data Controls.
- Do not claim an independent security-review badge unless a qualifying review is completed.

## Data categories to disclose conservatively

### Personal information
ResKonnect can collect name, email, phone, account identifiers and student/application identifiers when required by the service.

Uses: app functionality, account management, security, support, personalisation and communications.

### Location
Approximate and precise foreground location can be processed when the user activates ResMap, nearby discovery or navigation. Android v1 does not request background location.

Uses: app functionality and navigation.

### Photos, video and files
Users can choose to upload profile/media content and service documents. 360 capture uses the camera only when started by the user.

Uses: app functionality, verification and user-requested workflows.

### Messages
Support, service-request and connected communication content can be processed.

Uses: app functionality and customer support.

### Transaction information
Order history, payment references or user-uploaded payment evidence can be processed in relevant commerce workflows.

Uses: transaction fulfilment, accounting/support and fraud prevention.

### App activity and diagnostics
Searches, app interactions, attribution, security events and technical diagnostics can be processed.

Uses: app functionality, analytics, security and product improvement.

## Sharing
Infrastructure processors should be handled according to Google's service-provider rules. The privacy policy currently identifies providers such as Supabase, Vercel, Google services, Twilio and AI providers such as OpenAI.

Disclose user-initiated third-party sharing where a workflow sends relevant information to an independent residence, institution, employer/programme partner, or where a user opts into roommate visibility.

## Android v1 permission position
- Camera: optional, user initiated.
- Approximate/precise location: optional foreground use.
- Contacts: not requested.
- SMS and call logs: not requested.
- Background location: not requested.
- Broad storage: not requested.
- Native notification permission: not requested.

## Before saving the Play form
Re-check the submitted manifest, current privacy policy, production integrations, any analytics/ad SDK, commerce behavior, user-generated content, and whether native push or new sensitive permissions were added.
