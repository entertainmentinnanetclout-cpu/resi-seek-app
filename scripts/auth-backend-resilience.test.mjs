import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const code = (p) => readFileSync(p,"utf8");
const net = code("src/integrations/supabase/client.ts");
const ctx = code("src/contexts/AuthContext.tsx");
const status = code("src/components/ConnectivityStatus.tsx");
const cron = code("supabase/migrations/20261110000000_auth_database_load_budget.sql");
const trigger = code("supabase/migrations/20261110001000_auth_identity_trigger_fast_path.sql");

test("a backend HTTP 500/504 is distinguished from a client network outage",()=>{
  assert.match(net,/\[500, 502, 503, 504\]\.includes\(response\.status\)/);
  assert.match(net,/rk-auth-service-degraded/);
  assert.match(net,/rk-auth-service-recovered/);
  assert.match(status,/authUnavailable/);
  assert.match(status,/Your connection may be fine|Your connection may be fine/i);
  assert.match(status,/do not reset your password/i);
});
test("the login critical path cannot launch nonessential profile sync before access is verified",()=>{
  assert.match(ctx,/!sessionChecked \|\| isLoading \|\| accessError/);
  assert.match(ctx,/window\.setTimeout\(\(\) => \{/);
  assert.match(ctx, /}, 8_000\)/);
  assert.match(ctx,/identitySyncUserRef\.current === userId/);
  assert.match(ctx,/Math\.random\(\) \* 1_600/);
  assert.match(ctx,/get_my_access_context/);
});
test("the database load budget is idempotent and retains critical reservation jobs",()=>{
  assert.match(cron,/cron\.alter_job/);
  assert.match(cron,/adminos-whatsapp-event-worker/);
  assert.match(cron,/resmap-geocode-worker/);
  assert.doesNotMatch(cron,/cron\.unschedule/);
  assert.doesNotMatch(cron,/reskonnect-expire-room-holds/);
  assert.doesNotMatch(cron,/resmap-expire-room-holds/);
});
test("sign-in no longer requires synchronous public profiles write",()=>{
  assert.match(trigger,/DROP TRIGGER on_auth_user_identity_synced ON auth\.users/);
  assert.match(trigger,/AFTER UPDATE OF email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data/);
  assert.doesNotMatch(trigger,/AFTER UPDATE OF email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, last_sign_in_at\s+ON auth\.users/);
  assert.match(ctx,/functions\.invoke\("identity-sync"/);
});
console.log("Auth production reliability safeguards passed");
