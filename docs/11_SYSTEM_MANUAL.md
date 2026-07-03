# 11. System Manual

## 1. Accommodation
- **Purpose**: Manage and display housing inventory (buildings, sections, rooms).
- **Users**: Students (Search), Residence Admins (Manage), Super Admin (Accredit).
- **DB Tables**: `residences`, `residence_sections`, `residence_analytics`.
- **API**: `useRealtimeResidences` hook.
- **Workflow**:
  - Admin: Add residence -> Staff: Accredit -> Student: View.
- **Future Upgrades**: Room-level availability and maintenance tickets.

## 2. Applications
- **Purpose**: Student application and status tracking.
- **Users**: Students, Residence Admins.
- **DB Tables**: `applications`, `application_activity_log`, `application_messages`.
- **API**: `useRealtimeApplications` hook.
- **Workflow**:
  - Student: Apply -> Residence: Review docs -> Residence: Approve -> Student: View slip.
- **Edge Cases**: Withdrawn applications, missing parents' ID.

## 3. Referrals
- **Purpose**: Affiliate marketing and rewards.
- **Users**: Students (Promoters), Admin (Paymasters).
- **DB Tables**: `referral_codes`, `referral_earnings`, `referral_claims`.
- **API**: `capture_referral` RPC.
- **Workflow**:
  - Promoter: Share code -> New User: Sign up -> System: Credit Promoter.

## 4. Accreditation
- **Purpose**: Verify residences for NSFAS or University standards.
- **Users**: Landlords, Super Admin.
- **DB Tables**: `landlord_applications`, `landlord_application_documents`.
- **Workflow**:
  - Landlord: Apply -> Staff: Verify docs -> Staff: Update tags -> Residence: Visible as 'Accredited'.

## 5. Residence Portal
- **Purpose**: Property management dashboard for partners.
- **Users**: Residence Admins.
- **Workflow**: Login -> Application Inbox -> Status Toggle -> Export Pack.

## 6. Notifications
- **Purpose**: Real-time user alerts.
- **DB Tables**: `notifications`, `push_subscriptions`.
- **API**: `send-push` edge function.
- **Workflow**: System Event -> Insert DB -> Trigger Push.

## 7. Media & Content
- **Purpose**: Manage landing page and informational content.
- **DB Tables**: `hero_slides`, `campus_news`, `events`, `bursaries`.
- **Workflow**: Staff adds article -> Visible on News Feed.

## 8. Authentication
- **Purpose**: Secure access control.
- **DB Tables**: `profiles`, `user_roles`.
- **Workflow**: Sign-up -> Trigger Role Assignment -> Redirect via Role Route.

## 9. Storage
- **Purpose**: Document vault.
- **Buckets**: `documents`, `application-documents`, `profile-pictures`.
- **Workflow**: Frontend upload -> path-based RLS -> Admin view.
