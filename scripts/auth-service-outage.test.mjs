import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/lib/authErrors.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { exports: module.exports, module, Number, String, Array, Object });
const { getAuthErrorMessage, isTemporaryAuthServiceError, TEMPORARY_AUTH_SERVICE_MESSAGE } = module.exports;

test("500/504 database outages are not mistaken for a wrong password", () => {
  for (const status of [500,502,503,504]) {
    assert.equal(isTemporaryAuthServiceError({ status, code: "unexpected_failure" }), true);
    assert.equal(getAuthErrorMessage({ status, message: "unable to connect to postgres" }), TEMPORARY_AUTH_SERVICE_MESSAGE);
  }
  assert.equal(isTemporaryAuthServiceError({ code: "request_timeout" }), true);
});
test("wrong password and rate limits remain separate errors", () => {
  assert.equal(isTemporaryAuthServiceError({ status:400, code:"invalid_credentials", message:"Invalid login credentials" }), false);
  assert.equal(getAuthErrorMessage({ status:400, code:"invalid_credentials", message:"Invalid login credentials" }), "Invalid login credentials");
  assert.equal(isTemporaryAuthServiceError({ status:429, code:"over_request_rate_limit" }), false);
  assert.match(getAuthErrorMessage({ status:429 }), /wait before trying again/i);
});
test("fetch failures are reported without encouraging new account creation", () => {
  assert.match(getAuthErrorMessage(new Error("Failed to fetch")), /could not contact/i);
  assert.equal(getAuthErrorMessage(null, "Fallback"), "Fallback");
});
const context = readFileSync("src/contexts/AuthContext.tsx","utf8");
test("transient getSession errors never become a fabricated signed out session", () => {
  assert.match(context,/if \(sessionError\) throw sessionError/);
  assert.doesNotMatch(context,/if \(!authEventReceived\) applySession\(null\)/);
  assert.doesNotMatch(context,/await supabase\.auth\.refreshSession\(current\)/);
  assert.match(context,/if \(!current\) \{/);
});
const generalLogin = readFileSync("src/pages/Auth.tsx","utf8");
const landlordLogin = readFileSync("src/pages/residence/ResidenceLogin.tsx","utf8");
test("login surfaces explain the outage while retaining the sign-in form",()=>{
  assert.match(generalLogin,/serviceUnavailable && <p className="font-bold">Authentication service temporarily unavailable/);
  assert.match(generalLogin,/signInWithPassword/);
  assert.match(landlordLogin,/serviceUnavailable && <div role="alert"/);
  assert.match(landlordLogin,/signInWithPassword/);
});
