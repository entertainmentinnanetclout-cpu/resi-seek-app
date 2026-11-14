import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(p,"utf8");
test("booking-slip legacy helper calls canonical Supabase Edge host",()=>{
 const helper=read("src/lib/lovableFunctions.ts");
 const client=read("src/integrations/supabase/client.ts");
 assert.match(client,/EXTERNAL_SUPABASE_PROJECT_ID = 'mefjzkhobkltlbmhusdh'/);
 assert.match(helper,/fetch\(externalFunctionUrl\(name\)/);
 assert.match(helper,/EXTERNAL_SUPABASE_ANON_KEY/);
 assert.doesNotMatch(helper,/vmqqkebojldjsyxcewdb|LOVABLE_FUNCTIONS_URL/);
});
test("ResBot uses only the external production database and managed service key",()=>{
 const fn=read("supabase/functions/resbot-ai/index.ts");
 assert.match(fn,/const supabaseUrl = Deno\.env\.get\("EXTERNAL_SUPABASE_URL"\)/);
 assert.match(fn,/const supabaseKey = Deno\.env\.get\("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"\)/);
 assert.doesNotMatch(fn,/Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
 assert.doesNotMatch(fn,/Deno\.env\.get\("SUPABASE_URL"\)/);
});
test("payment webhook uses mandatory provider HMAC rather than a Supabase user token",()=>{
 const config=read("supabase/config.toml");
 const handler=read("supabase/functions/yoco-webhook/index.ts");
 const verifier=read("supabase/functions/_shared/yoco-webhook-security.mjs");
 assert.match(config,/\[functions\.yoco-webhook\][\s\S]*?verify_jwt = false/);
 assert.match(handler,/verifyYocoWebhook/);
 assert.match(handler,/YOCO_WEBHOOK_SECRET/);
 assert.match(handler,/rk_yoco_apply_verified_event/);
 assert.match(verifier,/crypto\.subtle\.sign/);
 assert.match(verifier,/Math\.abs\(timestamp-nowSeconds\)>180/);
});
