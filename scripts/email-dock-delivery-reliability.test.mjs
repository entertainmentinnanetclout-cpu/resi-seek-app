import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=(path)=>readFileSync(path,"utf8");
const api=file("supabase/functions/reskonnect-email-dock/index.ts");
const send=file("supabase/functions/reskonnect-email-dock/send.ts");
const pdf=file("supabase/functions/reskonnect-email-dock/pdf.ts");
const media=file("supabase/functions/reskonnect-email-dock/residence-media.ts");
const dock=file("src/components/communications/PremiumEmailDock.tsx");

test("the send status is scoped to the authenticated sender and stable request ID",()=>{
 assert.match(api,/action==="send_status"/);
 assert.match(api,/\.eq\("actor_user_id",actor\)\.eq\("idempotency_key",input\.request_id\)/);
 assert.match(api,/delivery_status:status/);
 assert.match(send,/existing\.delivery_status==="sent"/);
 assert.match(send,/\.eq\("actor_user_id",s\.actor\)\.eq\("idempotency_key",requestId\)/);
});
test("Gmail success remains success if the audit or last-used update fails",()=>{
 assert.match(send,/if\(!sent\.ok\)/);
 assert.match(send,/Gmail accepted message but audit update failed/);
 assert.match(send,/Gmail accepted message but audit persistence threw/);
 assert.match(send,/return \{sent:true,record_id:ctx\.id/);
});
test("PDF generation avoids CPU-expensive embedded residence PNGs and oversized images",()=>{
 assert.match(media,/maxBytes=6_000_000/);
 assert.match(pdf,/readPublishedPhotoBytes\(details\.residenceImageUrl,350_000\)/);
 assert.match(pdf,/realPhoto\?\.mime==="image\/jpeg"/);
 assert.doesNotMatch(pdf,/pdf\.embedPng\(realPhoto\.bytes\)/);
});
test("bulk Gmail sends use one PDF per Edge Function request",()=>{
 assert.match(dock,/for\(const id of ids\)/);
 assert.match(dock,/ids:\[id\],requests:\[request\]/);
 assert.match(api,/if\(ids\.length>1\)return res/);
});
test("the UI can reconcile a lost response and blocks a second ambiguous send",()=>{
 assert.match(dock,/reconcileSend\(requestId\)/);
 assert.match(dock,/checkPendingSend/);
 assert.match(dock,/status\?\.uncertain/);
 assert.match(dock,/pendingSend\?\.targetId===selected/);
});