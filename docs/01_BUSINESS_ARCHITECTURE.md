# 01. Business Architecture

## 1. Stakeholder Definitions
| Role | Entity | Description |
|------|--------|-------------|
| **Student** | Customer | Primary user seeking services and housing. |
| **Residence Admin** | Partner | Manager of a specific property or group of properties. |
| **Platform Staff** | Internal | Specialized leads (Operations, Media, etc.). |
| **Super Admin** | Executive | Platform owners with global "God Mode" access. |
| **Landlord** | Provider | Property owners awaiting accreditation/onboarding. |

## 2. Dashboard Hierarchy
A strict hierarchy prevents page duplication and ensures data scoping.

### God Mode (Global Executive)
Full visibility across all domains.
- **Operations Hub**: Residences, Applications, Users, Documents.
- **Media Hub**: News, Events, Slides, Bursaries.
- **System Hub**: Backend Health, Logs, Settings, WIL.
- **Commerce Hub (Paused)**: Stores, Products, Marketplace Orders.

### Specialist Dashboards (Standalone)
Role-specific views for department leads.
- **Media Dashboard**: Content management for growth leads.
- **Commerce Dashboard**: Moderation for commerce leads.

### Residence Portals (Scoped)
Restricted to a specific `residence_id`.
- Dashboard (Stats)
- Inbox (Applications)
- Analytics (Performance)

### Student Portal (Personalized)
Restricted to the `auth.uid()`.
- Dashboard (Tracker)
- Profile
- Applications
- Documents
- Favorites

## 3. Organizational Workflows
- **Application Workflow**: Discovery -> Submit -> Document Verification -> Residence Review -> Move-in.
- **Accreditation Workflow**: Landlord Application -> Vetting -> Inspection -> Activation.
- **Referral Workflow**: Share Link -> Capture Ref -> Signup -> Sale -> Payout.
