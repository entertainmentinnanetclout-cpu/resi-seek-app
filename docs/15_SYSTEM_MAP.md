# 15. System Map

## 1. User Navigation Flow
```mermaid
graph TD
    Landing[Landing Page] --> Find[Find My Res]
    Landing --> Auth[Authentication]
    Auth --> StudentDash[Student Dashboard]
    Auth --> AdminDash[God Mode Admin]
    Auth --> ResDash[Residence Portal]

    StudentDash --> Apps[Applications]
    StudentDash --> Refs[Referrals]
    StudentDash --> Docs[Documents]
    StudentDash --> Profile[Profile Settings]

    ResDash --> Inbox[Application Inbox]
    ResDash --> ResAnalytics[Residence Analytics]
    ResDash --> Exports[Export Packs]

    AdminDash --> OpsHub[Operations Hub]
    AdminDash --> MediaHub[Media Hub]
    AdminDash --> SystemHub[System Hub]
    AdminDash --> CommHub[Commerce Hub]
```

## 2. Platform Hierarchy
- **Super Admin (ResKonnect HQ)**
  - Oversees all Residences, Users, and Content.
  - Manages platform-wide `platform_settings`.
- **Residence Admin (Partners)**
  - Operates their specific buildings.
  - Reviews student documents and confirms move-ins.
- **Institutions (Universities/TVETs)**
  - Future: Direct access to accreditation stats and handover packs.
- **Students (Customers)**
  - The primary consumers of the housing marketplace and student services.
