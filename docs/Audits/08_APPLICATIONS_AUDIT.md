# Phase 1: Area 8 - Applications Audit

## 1. Student Application Workflows
- **Accommodation**: `ResidenceDetail` -> Submit Application -> `ApplicationStatusCard`.
- **WIL (Work Integrated Learning)**: Specialized form for vocational students (`MyWIL`).
- **Landlord Application**: B2B entry for new residence owners.

## 2. Reusable Components
- `ApplicationStatusCard`: Visual tracker for the student.
- `DocumentUploader`: Centralized file handling with status (pending/verified/rejected).
- `ApplicationTimeline`: logic for tracking state changes.

## 3. Missing Workflows
- **University/TVET Admissions**: Currently, we handle accommodation but not the institution application itself. V2 needs links/trackers for Uni/TVET apply pages.
- **Save & Resume**: Students often lack all documents (e.g., Parent ID) and need to save progress.
- **Automated Reminders**: Notifying students of expiring applications or missing docs via WhatsApp.
