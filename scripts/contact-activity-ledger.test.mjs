import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const edge=read("supabase/functions/reskonnect-email-dock/index.ts");
const ledger=read("supabase/functions/reskonnect-email-dock/contact-activity.ts");
const dock=read("src/components/communications/PremiumEmailDock.tsx");
const ui=read("src/components/communications/ContactActivityDashboard.tsx");
const manual=read("src/components/communications/ManualWhatsAppPanel.tsx");

test("contact activity is behind existing server-verified staff/landlord authorization",()=>{
 assert.match(edge,/db\.auth\.getUser\(bearer\)/);
 assert.match(edge,/if\(!isAdmin&&!isLandlord\)/);
 assert.match(edge,/if\(action==="contact_activity"\)/);
 assert.ok(edge.indexOf('if(action==="contact_activity")')>edge.indexOf("const s:EmailSession="));
 assert.match(ledger,/canView\(s,row\.residence_id\|\|null\)/);
 assert.match(ledger,/if\(!s\.isAdmin\)continue/);
 assert.match(ledger,/permitted\(s,kind\)/);
 assert.match(ledger,/consent_to_be_contacted!==true/);
});

test("all communication sources distinguish evidence rather than inventing delivery",()=>{
 for(const table of ["reskonnect_outbound_emails","reskonnect_whatsapp_handoffs","reskonnect_bulk_status_audit",
  "application_status_history","adminos_whatsapp_messages","adminos_email_messages","adminos_email_outbox"]){
  assert.ok(ledger.includes(table),"Missing contact tracking source "+table);
 }
 assert.match(ledger,/operator_marked_sent/);
 assert.match(ui,/Gmail accepted · not a delivery receipt/);
 assert.match(ui,/WhatsApp opened · not yet confirmed sent/);
 assert.match(ui,/provider reported/);
 assert.match(ui,/Unlinked WhatsApp contacts are not assumed to be students/);
});

test("live tracker refreshes on changes and foreground polling, including manual handoffs",()=>{
 assert.match(ui,/15_000/);
 assert.match(ui,/postgres_changes/);
 assert.match(ui,/visibilitychange/);
 assert.match(dock,/ContactActivityDashboard mode=\{mode\}/);
 assert.match(manual,/onActivityChange\?\.\(\)/);
 assert.match(dock,/onActivityChange=\{\(\)=>setActivityRevision/);
});

test("activity reader is bounded, never exposes direct contact fields, and offers pagination",()=>{
 assert.match(ledger,/const LIMIT=120/);
 assert.match(ledger,/Math\.min\(40/);
 assert.match(ledger,/has_more,next_page/);
 assert.match(ui,/Load older activity/);
 assert.doesNotMatch(ledger,/recipient_email|phone_last4|body_text|identity_number/);
 assert.match(ledger,/Never return applicant emails, phone numbers/);
});
