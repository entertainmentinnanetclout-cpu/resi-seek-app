import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(path,"utf8");
const edge=read("supabase/functions/reskonnect-email-dock/index.ts");
const review=read("supabase/functions/reskonnect-email-dock/document-review.ts");
const dock=read("src/components/communications/PremiumEmailDock.tsx");
const panel=read("src/components/communications/DocumentReviewPanel.tsx");
const whatsapp=read("src/components/communications/ManualWhatsAppPanel.tsx");
const migration=read("supabase/migrations/20261110210000_reskonnect_document_review_audit.sql");

test("private files are selected only through a server-authorized case",()=>{
 assert.match(review,/await readCase\(s,kind,id\)/);
 assert.match(review,/\.eq\("user_id",c\.userId\)/);
 assert.match(review,/\.eq\("application_id",id\)/);
 assert.match(review,/d\.path\.startsWith\(c\.userId\+"\/"\)/);
 assert.match(review,/\.createSignedUrl\(d\.path,90\)/);
 assert.match(review,/d\.source==="global"\?"documents":"application-documents"/);
 assert.doesNotMatch(review,/createSignedUrl\(input\./);
 assert.doesNotMatch(review,/admin_notes:small/);
});

test("review receipt is private, short-lived, actor-bound, and snapshot-bound",()=>{
 assert.match(review,/document_snapshot_sha256/);
 assert.match(review,/\.eq\("actor_user_id",s\.actor\)/);
 assert.match(review,/\.eq\("target_kind",c\.kind\)/);
 assert.match(review,/\.eq\("target_id",c\.id\)/);
 assert.match(review,/20\*60\*1000/);
 assert.match(review,/Student documents or case status changed/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public\.reskonnect_document_review_audit from public,anon,authenticated/);
 assert.match(migration,/grant select,insert on public\.reskonnect_document_review_audit to service_role/);
});

test("readiness reviews are mandatory on both direct and bulk sends and WhatsApp handoffs",()=>{
 assert.match(edge,/if\(action==="document_review_ack"\)/);
 assert.match(edge,/if\(action==="document_preview"\)/);
 assert.match(edge,/await assertReviewed\(s,c,input\.document_review_id\)/);
 assert.match(edge,/await assertReviewed\(s,c,item\.document_review_id\)/);
 assert.ok((edge.match(/await assertReviewed\(s,c,input\.document_review_id\)/g)||[]).length>=2);
 assert.match(whatsapp,/document_review_id:reviewId\|\|null/);
 assert.match(whatsapp,/needsReview&&!reviewId/);
});

test("document decisions are restricted and concurrency-safe",()=>{
 assert.match(review,/source==="global"&&!s\.isAdmin/);
 assert.match(review,/doc\.status!==expected/);
 assert.match(review,/\.eq\("status",expected\)/);
 assert.match(review,/decision==="rejected"&&reason\.trim\(\)\.length<8/);
 assert.match(review,/application_activity_log/);
});

test("premium queue shows document reviews before communication",()=>{
 assert.match(dock,/DocumentReviewPanel/);
 assert.match(dock,/value="documents"/);
 assert.match(dock,/Review documents before contacting/);
 assert.match(dock,/Review selected messages/);
 assert.match(dock,/Review every selected student’s documents/);
 assert.match(dock,/document_review_id:selectedReceipt\?\.id\|\|null/);
 assert.match(dock,/document_review_id:reviewReceiptFor\(id\)\?\.id\|\|null/);
 assert.match(dock,/selectedReceipt/);
 assert.match(panel,/View file/);
 assert.match(panel,/Confirm document review/);
 assert.match(panel,/Request correction/);
 assert.match(panel,/No files uploaded yet/);
 assert.match(panel,/Student documents or case status changed|Document review not recorded/);
});
