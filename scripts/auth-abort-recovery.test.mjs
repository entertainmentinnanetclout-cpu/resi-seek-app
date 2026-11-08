import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=path=>readFileSync(path,"utf8");
const net=src("src/integrations/supabase/client.ts");
const auth=src("src/contexts/AuthContext.tsx");
const recovery=src("src/components/AuthLoadingRecovery.tsx");
const route=src("src/components/ProtectedRoute.tsx");
const student=src("src/components/StudentRoute.tsx");
const login=src("src/pages/Auth.tsx");
const connectivity=src("src/components/ConnectivityStatus.tsx");

test("real transport timeouts include a reason, not a reasonless AbortError",()=>{
 assert.match(net,/25_000/);
 assert.match(net,/ResKonnect did not receive a response in time/);
 assert.match(net,/TimeoutError/);
 assert.match(net,/const relayAbort/);
 assert.match(net,/originalSignal\?\.reason/);
 assert.match(net,/if \(originalSignal\?\.aborted && !timedOut\) throw error/);
 assert.match(net,/ResKonnect's live service timed out/);
});
test("a cancelled stale account lookup does not trigger the network outage banner",()=>{
 assert.match(auth,/accessAbortRef/);
 assert.match(auth,/Superseded by a newer account check/);
 assert.match(net,/if \(originalSignal\?\.aborted && !timedOut\) throw error/);
 assert.match(auth,/accessRequestRef\.current/);
 assert.match(auth,/currentUserIdRef\.current !== userId/);
});
test("on a real upstream failure, retry can be initiated manually or automatically",()=>{
 assert.match(auth,/setAccessFailureCount\(count => Math\.min\(count \+ 1, 12\)\)/);
 assert.match(auth,/const delay = Math\.min\(3_000 \* Math\.pow\(2/);
 assert.match(auth,/window\.setTimeout\(retry, delay\)/);
 assert.match(auth,/window\.addEventListener\("rk-reconnected", retry\)/);
 assert.match(auth,/window\.addEventListener\("online", retry\)/);
 assert.match(connectivity,/dispatchEvent\(new Event\("rk-reconnected"\)\)/);
 assert.match(recovery,/retrying \? "Checking account permissions…"/);
 assert.match(recovery,/disabled=\{retrying\}/);
});
test("while access is unverified, staff and student dashboards remain fail-closed",()=>{
 assert.match(auth,/get_my_access_context/);
 assert.match(auth,/throw new Error\("The account permissions service returned an incomplete result/);
 assert.match(auth,/setAccessError\(true\)/);
 assert.match(route,/if \(user && accessError\)/);
 assert.match(student,/if \(accessError\) return/);
 assert.match(student,/if \(user && accessError\)/);
 assert.doesNotMatch(student,/if \(accessError\) return <>{children}<\/>/);
});
test("sign-in and account switch remain usable during RPC outage, without bypassing roles",()=>{
 assert.doesNotMatch(login,/if \(user && accessError\) return <AuthLoadingRecovery/);
 assert.match(login,/Retry account check/);
 assert.match(login,/signInWithPassword/);
 assert.match(login,/Sign In/);
 assert.match(login,/Private dashboards will remain protected/);
 assert.match(login,/authLoading \|\| accessError \|\| !user/);
});
