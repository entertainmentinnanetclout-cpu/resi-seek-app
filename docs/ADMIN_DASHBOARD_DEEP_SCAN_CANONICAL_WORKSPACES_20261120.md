# ResKonnect Admin OS: deep scan and canonical workspace consolidation

Date: 20 November 2026. Scope: the live `entertainmentinnanetclout-cpu/resi-seek-app` source, the linked ResKonnect Supabase project `mefjzkhobkltlbmhusdh`, and admin navigation/routes. This is a source and database audit, not an unauthenticated claim that every specialist operation has been manually tested.

## Confirmed architectural facts

- `src/App.tsx` maps the God Mode `/admin` entry to `AdminBrain` through `AdminHomeSwitch`, while the historical `AdminDashboard.tsx` remains in the repo and presents a second extensive platform-overview implementation. The source and route are not deleted or silently replaced.
- `src/components/admin/AdminLayout.tsx` previously exposed seven God Mode mission links and multiple departmental links simultaneously. The `/admin/applications`, `/admin/operations` and `/admin/accommodation` pages are alternate pathways into substantially overlapping academic intake tools, while `/admin/cases` remains the audited final-decision engine.
- `src/pages/admin/AdminOperationsHub.tsx` has **nine major tabs plus nested specialist tabs**, including an applications/reservations tab embedding `AdminApplicationsContent` and `AdminReservations2027Content`. A legacy `?tab=2027-reservations` URL opened the generic parent default (Applications) instead of the requested Reservations. The main accommodation route now preserves a `view=reservations` deep link.
- `src/pages/admin/AdminCommunicationsDepartment.tsx` has seven operational sub-tabs. `CommunicationEmailWorkspace` remains the single Gmail/Email Dock; WhatsApp Desk, automation and contacts retain genuinely different capabilities.
- `src/pages/admin/AdminGoldenServiceCycle.tsx` manages customer workflows and exceptions, not email delivery; `src/pages/admin/AdminCaseCommandCenter.tsx` holds audited sensitive case decisions; these must **not** be merged into direct, unaudited database writes or auto-send messages.
- `src/pages/admin/AdminVisualStudio.tsx` houses pages/properties/showcases/media editing with revisions and rollback; `AdminResidencesContent` remains the operational residence record manager. Both are preserved, with only one visible top-level entry per domain.
- `src/pages/admin/AdminIntelligenceAnalytics.tsx` has six analytics domains; `AdminTechnologySystems.tsx` has five system/integration/release tabs; `AdminFinanceAdmin.tsx` has five financial modules. These are preserved under advanced/departmental access, not removed.
- `src/components/admin/AdminOSCommandBar.tsx` remains the global search/navigation command; `AdminStudent360`, document review, partner management, department-specific interfaces, custom role permissions and all protected legacy paths remain operationally distinct.
- The historical `docs/Audits/UI_Dashboard_Audit.md` already noted an overlap of Applications/Documents management between accommodation administration and residence portal tools. The current scan found another overlap in front-end navigation, and a missing joining of audited Gmail/WhatsApp outreach on the academic fill cards.

## Live 2027 baseline and truth rules

Verified read-only aggregation on 20 November 2026:
- 507 accommodation reservations, distributed across 91 residences;
- 362 academic inventory rows; inventory/occupancy and demand must never be combined as occupied beds;
- 0 academic-year 2027 accommodation applications;
- **299 distinct reservation cases** with a provider-confirmed Gmail accepted send, **208** without one, and **309 sent messages**. A repeated email increases message count, not contacted-case count.
- Berlin Private & Student Living: 67 reservations, 60 cases with accepted Gmail messages, 7 without, 68 accepted messages, 1 WhatsApp operator-marked case, no linked reply cases.
- Reply records are currently zero. A zero reply count means *no recorded linked Gmail response*; it does not prove no student replied outside the connected sync.
- Residence inventory `inventory_status` and reservation/application business `status` are separate from Gmail delivery status and WhatsApp handoff status.

## New canonical workspaces (one visible function owner)

| Visible Admin OS workspace | Canonical destination | Capabilities kept |
|---|---|---|
| Overview | `/admin` | Student 360 search, genuine exception pulse, live workload and quick actions |
| People | `/admin/users` | Users, Student 360 and full personal journeys |
| Accommodation | `/admin/accommodation?tab=applications-reservations&view=reservations` | Academic fill, residence inventory, applications, reservations, documents, commercial, portals, compliance and studios |
| Communications | `/admin/communications?tab=email` | One Email Dock, manual WhatsApp, contacts, conversion, replies, templates and service communications |
| Work Queue | `/admin/golden-cycle` | Golden Service Cycle, human decisions, audited case command and escalations |
| Opportunities | `/admin/opportunities` | WIL, study support, funding, placements and student support |
| Content & Growth | `/admin/corporate-affairs` | Marketing, publishing, social, PR and Visual Studio |
| Technology | `/admin/technology` | Platform health, AI, connections, releases and systems |

Only eight workspaces are shown in the primary God Mode sidebar. Finance, analytics, specialist decisions, evidence reviews and studio controls remain discoverable under collapsed advanced entries; other unique offices remain under collapsed department navigation. Non-God-Mode users still see only their authorized departmental workspaces. The global command search and existing legacy deep links are unchanged.

## Residence Fill Command updates

The fill cards now join academic-year scoped case communication **server-side**, not a screen page of emails or a template counter:
- Unique cases emailed versus unemailed, with exact partition `total = emailed + unemailed`.
- Separate total accepted Gmail messages (including repeat sends).
- WhatsApp operator-marked sent, Gmail-emailed cases still lacking a WhatsApp send mark, and opened-only WhatsApp handoffs.
- Actual linked Gmail replies and any unconfirmed Gmail attempts; no fabricated receipt/read indicators.
- Last accepted Gmail timestamp and current business status breakdown per residence.
- Direct `Open Email Dock` action preserving the same residence and case type.
- Filters for "email action needed", "at least one case emailed", "all cases emailed", "WhatsApp pending", recorded replies and uncertain Gmail attempts.
- A failed reconciliation displays **unavailable**, never a false zero.
- Explicitly separate academic inventory fill rate from reservation demand and message evidence.

## Security, compatibility and staged implementation

- Service-only `public.rk_admin_residence_outreach_summary(text,integer)` has `SECURITY INVOKER`, explicitly revoked anon/authenticated execute, bounded case-kind/year, and uses only real Supabase audit records. The admin Email Dock route verifies the JWT and the actual `user_roles.admin` role before calling it; it validates count partitions before responding.
- No student email is sent as part of generating card counts. No application/reservation status is rewritten by the dashboard. No Gmail reply or WhatsApp delivery is inferred.
- `App.tsx` routes, RLS and role gates remain unchanged. Specialist source code and modules are not removed.
- Both server and client regression checks should be green before merge/deploy. Retest cross-department staff roles and legacy deep links as part of the release gate.
- Follow-on UX opportunities: work toward consistent in-workspace subtabs from this canonical route registry without merging distinct business-authority boundaries. Measure operator clicks, core task completion, error recovery and mobile navigation before any further tool consolidation.

## Known limitations not hidden by the redesign

- Gmail acceptance is *not* inbox receipt/read. WhatsApp operator-marked sent is *not* delivery/read.
- The genuine response ledger has no linked replies at the time of this audit. If students reply externally or inbox connection is disabled, the cards cannot infer those responses.
- Existing direct admin reservation status edits can record internal "contacted" without themselves proving a Gmail send. The new fill cards show both facts separately so this inconsistency is visible rather than silently treated as delivered.
- Legacy administrative pages still exist by design; eliminating independent implementations would require business-specific compatibility tests and explicit approval if business behavior changes.
