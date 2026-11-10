import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("supabase/functions/phone-whatsapp-verification/index.ts","utf8");

test("OTP security-event logging awaits PostgREST result instead of using missing .catch()",()=>{
  const fn=source.match(/async function securityEvent\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn,"securityEvent missing");
  assert.match(fn,/try\s*\{/);
  assert.match(fn,/await db\.from\("user_security_events"\)/);
  assert.match(fn,/if\s*\(error\)/);
  assert.match(fn,/catch\s*\{/);
  assert.doesNotMatch(fn,/\.insert\([^;]*\)\.catch\s*\(/);
});
test("OTP security controls are preserved",()=>{
  assert.match(source,/if\(\(a\.count\|\|0\)>=1\)/);
  assert.match(source,/if\(\(b\.count\|\|0\)>=3\)/);
  assert.match(source,/if\(\(c\.count\|\|0\)>=6\)/);
  assert.match(source,/const user=await currentUser\(req\)/);
  assert.match(source,/if\(!user\)return json\(req,\{error:"authentication_required"\},401\)/);
  assert.match(source,/twilio\("https:\/\/verify\.twilio\.com\/v2\/Services/);
  assert.match(source,/verifyService\(\)/);
});
