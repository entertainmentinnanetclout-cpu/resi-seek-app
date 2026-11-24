import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=path=>readFileSync(path,"utf8");

test("admin previews use the exact public campaign renderer for unsaved and saved media",()=>{
 const admin=file("src/components/admin/AdminSiteAnnouncementsManager.tsx");
 const live=file("src/components/SiteAnnouncementPopup.tsx");
 assert.match(admin,/SitePromotionPresentation/);
 assert.match(admin,/preview\(draft,true\)/);
 assert.match(admin,/preview\(item\)/);
 assert.match(admin,/promotion-live-preview/);
 assert.match(admin,/setPreviewDevice\("mobile"\)/);
 assert.match(admin,/setPreviewDevice\("desktop"\)/);
 assert.match(live,/export function SitePromotionPresentation/);
 assert.match(live,/relative flex w-full/);
 assert.match(live,/device==="mobile"/);
 assert.match(live,/object-contain/);
 assert.match(live,/preview\?<Button/);
 assert.match(live,/min\(\$\{width\}px,100%\)/);
});

test("web push public key endpoint reads ONLY public key and fails closed",()=>{
 const edge=file("supabase/functions/vapid-public-key/index.ts");
 const migration=file("supabase/migrations/20261124054855_rk_web_push_vault_credentials.sql");
 assert.match(edge,/rpc\("rk_web_push_public_key"\)/);
 assert.match(edge,/configured:false/);
 assert.match(edge,/503/);
 assert.doesNotMatch(edge,/Deno\.env\.get\("VAPID_PRIVATE_KEY"\)/);
 assert.match(migration,/vault\.decrypted_secrets/);
 assert.match(migration,/revoke all on function public\.rk_web_push_server_keys\(\) from public, anon, authenticated, service_role/);
 assert.match(migration,/grant execute on function public\.rk_web_push_server_keys\(\) to service_role/);
 assert.doesNotMatch(migration,/B[A-Za-z0-9_-]{86}/);
});

test("sender uses Vault service-only private material, not checked-in environment values",()=>{
 const sender=file("supabase/functions/send-push/index.ts");
 assert.match(sender,/rpc\("rk_web_push_server_keys"\)/);
 assert.match(sender,/webpush\.setVapidDetails\(VAPID_SUBJECT/);
 assert.match(sender,/Staff authorization required/);
 assert.match(sender,/if \(!webEnabled && !fcmEnabled\)/);
 assert.doesNotMatch(sender,/Deno\.env\.get\("VAPID_PRIVATE_KEY"\)/);
});

test("permission and sound tests distinguish browser permission from connected service",()=>{
 const push=file("src/lib/push.ts");
 const settings=file("src/components/NotificationSettings.tsx");
 assert.match(push,/Notification\.requestPermission\(\)/);
 assert.match(push,/checkPushKeyAvailability/);
 assert.match(push,/decoded\.length===65&&decoded\[0\]===4/);
 assert.match(push,/subscription\.unsubscribe\(\)/);
 assert.match(push,/push-subscription/);
 assert.match(settings,/checkPushKeyAvailability/);
 assert.match(settings,/Test alert \+ audio/);
 assert.match(settings,/testBrowserAlert/);
 assert.match(settings,/showNotification/);
 assert.match(settings,/playNotificationTone/);
});
