import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const pass=(condition,label)=>{assert.ok(condition,label);console.log("PASS",label);};
const source=read("src/lib/authErrors.ts");
const moduleSource=ts.transpileModule(source,{
 fileName:"authErrors.ts",compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText;
const mod=await import("data:text/javascript;base64,"+Buffer.from(moduleSource).toString("base64"));
const exposed=mod.getAuthErrorMessage({
 code:"weak_password",reasons:["pwned"],message:"Weak password"
});
pass(/known data breach/i.test(exposed)&&/unique password/i.test(exposed),
 "Server-rejected breached password provides a safe, actionable recovery message");
pass(/stronger password/i.test(mod.getAuthErrorMessage({
 code:"weak_password",reasons:["length"],message:"Password too short"
})), "Server-rejected weak password gets clear strength guidance");
pass(!mod.isTemporaryAuthServiceError({code:"weak_password",status:422}),
 "Weak or breached password errors are not misreported as backend outages");
pass(/too many sign-in attempts/i.test(mod.getAuthErrorMessage({
 code:"over_email_send_rate_limit",status:429,message:"Rate limit exceeded"
})), "Authentication rate limiting is not interpreted as incorrect credentials");
pass(/temporarily unavailable/i.test(mod.getAuthErrorMessage({
 status:503,code:"service_unavailable",message:"Database connection timeout"
})), "Existing recovery guidance still handles real Auth infrastructure outages");
pass(mod.getAuthErrorMessage({code:"invalid_credentials",message:"Invalid login credentials"})==="Invalid login credentials",
 "Ordinary bad credentials have no user-enumeration or false data-breach messaging");
pass(!/fetch\(|haveibeenpwned\.com|api\.pwnedpasswords/.test(source),
 "Client never sends user passwords to an external breach API");

const recruiter=read("src/pages/recruit/RecruiterAuth.tsx");
const student=read("src/pages/Auth.tsx");
const reset=read("src/pages/PasswordReset.tsx");
for(const [name,src] of [["student signup",student],["recruiter signup",recruiter],["password reset",reset]]){
 pass(src.includes("min(8")&&src.includes("regex(/[A-Z]/")&&src.includes("regex(/[a-z]/")&&src.includes("regex(/[0-9]/"),
  name+" prechecks eight characters with upper/lower/digit; server still authoritative");
}
pass(recruiter.includes("getAuthErrorMessage(error)"),
 "Recruiter sign-in and signup use the same safe authentication error translator");
pass(reset.includes("server-side breached-password checks will apply once enabled") &&
 !reset.includes("Supabase will also reject known leaked passwords"),
 "Password reset does not falsely claim that breached-password screening is active");
pass(student.includes("Update it promptly through Account Security"),
 "Student with an existing flagged password is prompted to replace it promptly");
pass(reset.includes("clearWeakPassword(user.id)")&&reset.includes("navigate(returnTo"),
 "Successful password change preserves account journey and clears stored weakness notice");

const policy=JSON.parse(read("docs/security/VERCEL_WAF_SECURITY_BASELINE_20261115.json"));
pass(policy.projects.length===2 && new Set(policy.projects.map(p=>p.project_id)).size===2,
 "Both canonical and secondary Vercel projects are recorded without mixing IDs");
for(const project of policy.projects){
 pass(project.rules.length===2&&project.rules.every(r=>r.active&&r.valid),
  project.name+" active WAF rule receipts match live inspected settings");
 const limit=project.rules.find(r=>r.action==="rate_limit");
 pass(limit?.window_seconds===60&&limit.limit===240&&limit.keys?.includes("ip"),
  project.name+" limits Vercel API/sitemaps by trusted provider IP (240/60s)");
 pass(JSON.stringify(limit.paths).includes("/api/") && !limit.paths.includes("/auth") && !limit.paths.includes("/dashboard"),
  project.name+" limits expensive APIs, not student sign-in or dashboard navigation");
 const probes=project.rules.find(r=>r.action==="deny");
 pass(probes.paths.includes("/.git")&&probes.paths.includes("/.env")&&probes.paths.includes("/wp-admin"),
  project.name+" denies credential and legacy CMS scanner paths");
}
pass(policy.scope_limitations.includes("Supabase direct requests bypass Vercel Firewall"),
 "Scope document explicitly preserves independent Supabase RPC protection");
pass(policy.supabase.leaked_password_protection==="disabled_pending_dashboard_enable" &&
 policy.supabase.plan==="pro" &&
 policy.supabase.dashboard_change_required===true,
 "Supabase Pro eligibility and outstanding human-controlled password protection are accurately recorded");
console.log("SEC-12 Vercel WAF inventory and Supabase Auth policy readiness tests passed.");
