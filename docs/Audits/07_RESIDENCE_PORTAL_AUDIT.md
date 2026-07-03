# Phase 1: Area 7 - Residence Portal Audit

## 1. Implemented Features
- **Login**: Scoped auth via `residence_portal_accounts`.
- **Dashboard**: Stats on New, Under Review, and Approved applications.
- **Inbox**: Message-style interface for communicating with applicants.
- **Application Detail**: Document verification, status updates, and activity logs.
- **Analytics**: Basic charts for application volume.

## 2. Missing Enterprise Features
- **Occupancy Management**: Tracking which student is in which room.
- **Financial Reporting**: Tracking paid deposits and confirmed funding (NSFAS).
- **Resident Management**: Broadcasting announcements to currently moved-in students.
- **Document Requests**: Customizing which documents are required for their specific residence.

## 3. Testing Steps
- [ ] Verify `is_authorized_residence_user` RPC against malicious UID.
- [ ] Verify application status updates trigger the correct `activity_log` entry.
- [ ] Verify document rejection reason persists and notifies the student.
