import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(path,"utf8");
const media=read("supabase/functions/reskonnect-email-dock/residence-media.ts");
const context=read("supabase/functions/reskonnect-email-dock/context.ts");
const fingerprint=read("supabase/functions/reskonnect-email-dock/case-queue.ts");
const send=read("supabase/functions/reskonnect-email-dock/send.ts");
const html=read("supabase/functions/reskonnect-email-dock/correspondence.ts");
const ui=read("src/components/communications/PremiumEmailDock.tsx");
const repair=read("supabase/migrations/20261120205500_villa_ubuntu_current_email_cover.sql");

test("current published residence cover wins over historical ResMap primary media",()=>{
 const listing=media.indexOf("for(const candidate of fallback)");
 const legacy=media.indexOf('const media=await db.from("resmap_residence_media")');
 assert.ok(listing>=0&&legacy>listing,"current listing media must resolve first");
 assert.match(context,/\[property\.data\?\.cover_image_url,property\.data\?\.image_url,property\.data\?\.images\]/);
 assert.match(media,/approvedResidencePhoto\(candidate\)/);
 assert.match(media,/approvedResidencePhoto\(item\)/);
 assert.match(media,/APPROVED_BUCKETS/);
 assert.match(media,/target\.origin!==PROJECT_ORIGIN/);
 assert.match(media,/if\(target\.search\|\|target\.hash\)return null/);
});

test("a changed residence cover or rebrand invalidates the approved email snapshot",()=>{
 assert.match(fingerprint,/property:c\.property,residenceImageUrl:c\.residenceImageUrl\|\|null/);
 assert.match(send,/residence_image_url:ctx\.residenceImageUrl\|\|null/);
 assert.match(html,/const hero=c\.residenceImageUrl/);
 assert.match(ui,/if\(r\.case\)setCaseInfo\(r\.case as CaseInfo\)/);
 assert.match(ui,/Refresh photo/);
});

test("Villa Ubuntu repairs only the known stale media row, preserving sent email history",()=>{
 assert.match(repair,/Villa Ubuntu Student Accommodation/);
 assert.match(repair,/cd829172-9735-41a1-a628-9cd20898daeb/);
 assert.match(repair,/residence-1767530456159\.JPG/);
 assert.match(repair,/residence-1794394036962\.jpeg/);
 assert.match(repair,/UPDATE public\.resmap_residence_media/);
 assert.match(repair,/AND EXISTS/);
 assert.doesNotMatch(repair,/DELETE\s+FROM|UPDATE\s+public\.reskonnect_outbound_emails/i);
});
