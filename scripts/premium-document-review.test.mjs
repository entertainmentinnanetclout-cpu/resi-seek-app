import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const api=read("supabase/functions/reskonnect-email-dock/index.ts");
const docs=read("supabase/functions/reskonnect-email-dock/document-review.ts");
const ui=read("src/components/communications/PremiumEmailDock.tsx");
const panel=read("src/components/communications/DocumentReviewPanel.tsx");
const whatsapp=read("src/components/communications/ManualWhatsAppPanel.tsx");
const migration=read("supabase/migrations/20261110210000_reskonnect_document_review_audit.sql");

test("case permissions and signed storage lookups are server-side",()=>{
 assert.match(api,/db\.auth\.getUser\(bearer\)/);
 assert.match(api,/if\(!isAdmin&&!isLandlord\)/);
 assert.match(docs,/const c=await readCase\(s,kind,id\)/);
 assert.match(docs,/\.eq\("user_id",c\.userId\)/);
 assert.match(docs,/\.eq\("application_id",id\)/);
 assert.match(docs,/createSignedUrl\(d\.path,90\)/);
 assert.match(docs,/const bucket=d\.source==="global"\?"documents":"application-documents"/);
 assert.doesNotMatch(docs,/getPublicUrl\(/);
 assert.match(docs,/d\.path\.startsWith\(c\.userId\+"\/"\)/);
 assert.match(docs,/docs\.find\(d=>d\.id===documentId&&d\.source===source\)/);
});

test("email and WhatsApp sends require a recent audited document review",()=>{
 for(const action of ["document_list","document_preview","document_review_ack","document_decision"])
  assert.ok(api.includes(action),"missing secure document endpoint "+action);
 assert.match(api,/await assertReviewed\(s,c,input\.document_review_id\)/);
 assert.match(api,/await assertReviewed\(s,c,item\.document_review_id\)/);
 assert.match(docs,/reskonnect_document_review_audit/);
 assert.match(docs,/20\*60\*1000/);
 assert.match(docs,/data\.document_snapshot_sha256!==signature/);
 assert.match(docs,/status:c\.status,funding:c\.fundingType/);
 assert.match(ui,/document_review_id:selectedReceipt\?\.id\|\|null/);
 assert.match(ui,/document_review_id:reviewReceiptFor\(id\)\?\.id\|\|null/);
 assert.match(whatsapp,/document_review_id:reviewId\|\|null/);
 assert.match(whatsapp,/needsReview&&!reviewId/);
});

test("premium in-dock review supports actual file viewing and authorized decisions",()=>{
 for(const label of ["Step 1 · Review documents","Preview file","Request correction",
  "Confirm document review · Continue","No files uploaded yet","90-second previews"]){
  assert.ok(panel.includes(label),label);
 }
 const viewer=read("src/components/communications/SecureDocumentPreview.tsx");
 assert.match(panel,/SecureDocumentPreview/);
 assert.match(viewer,/iframe key=\{url\} title=\{"Document preview: "\+name\} src=\{url\}/);
 assert.doesNotMatch(viewer,/sandbox=/);
 assert.match(viewer,/Open file in new tab/);
 assert.match(docs,/if\(source==="global"\)\{/);
 assert.match(docs,/data\.admin_notes=reason/);
 assert.match(docs,/\}else\{\s*data\.rejection_reason=/);
 assert.doesNotMatch(docs,/if\(source==="global"&&decision==="rejected"\)data\.admin_notes=reason;\s*else data\.rejection_reason=/);
 assert.match(panel,/Verify/);
 assert.match(panel,/!opened\.has\(doc\.source\+":"\+doc\.id\)/);
 assert.match(docs,/if\(source==="global"&&!s\.isAdmin\)/);
 assert.match(docs,/decision==="rejected"&&reason\.trim\(\)\.length<8/);
 assert.match(docs,/\.eq\("status",expected\)/);
 assert.match(docs,/verified_by:s\.actor/);
});

test("applications and reservations remain in front with explicit progress and status controls",()=>{
 assert.match(ui,/Applications overview/);
 assert.match(ui,/Reservations overview/);
 for(const text of ["New cases","Docs uploaded","Ready to review","Reserved","Confirmed",
 "Update status","Review files","1 · Documents","2 · Email"])
  assert.ok(ui.includes(text),"missing premium case affordance: "+text);
 assert.ok(ui.indexOf('aria-label="Communications workspace"')<
  ui.indexOf('value="documents"'),"case navigation must precede document detail");
 assert.match(ui,/setPane\(needsReview\?"documents":"compose"\)/);
 assert.match(ui,/selectedReceipt/);
 assert.match(ui,/onDocumentsChanged/);
});

test("review audit table is private and does not broaden student-data access",()=>{
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all .* from public,anon,authenticated/);
 assert.match(migration,/grant select,insert .* to service_role/);
 assert.doesNotMatch(migration,/policy.*using\s*\(true\)/i);
});
