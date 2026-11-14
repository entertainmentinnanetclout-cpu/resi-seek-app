import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const docs=[
 "docs/security/REGISTER_P0_20261114.md",
 "docs/security/REGISTER_P1_IDENTITY_BROWSER_20261114.md",
 "docs/security/REGISTER_P1_P2_OPERATIONS_20261114.md",
 "docs/security/REGISTER_LEGAL_LAUNCH_DESIGN_20261114.md"
];
const rows=docs.flatMap(p=>read(p).split("\n").filter(s=>/^\|\s*(SEC|GOV|WEB)-\d+\s*\|/.test(s)).map(s=>({file:p,cols:s.split("|").slice(1,-1).map(v=>v.trim())})));
const ids=rows.map(x=>x.cols[0]);
const pass=(cond,msg)=>{assert.ok(cond,msg);console.log("PASS",msg);};
pass(ids.length===78,"Master backlog includes exactly 78 source-mapped tasks");
pass(new Set(ids).size===ids.length,"No task ID duplicates across any phase");
for(const [prefix,count] of [["SEC",50],["GOV",18],["WEB",10]]){
 const expected=Array.from({length:count},(_,i)=>prefix+"-"+String(i+1).padStart(2,"0"));
 const actual=ids.filter(id=>id.startsWith(prefix+"-")).sort();
 pass(actual.length===count&&expected.every((v,i)=>actual[i]===v),"Full contiguous "+prefix+" control family, no missing tasks");
}
for(const x of rows){
 pass(x.cols.length>=3&&x.cols[1].length>10&&x.cols[2].length>5,"Clearly scoped unique control "+x.cols[0]);
}
const uniqueNames=rows.map(x=>x.cols[1].toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim());
pass(new Set(uniqueNames).size===uniqueNames.length,"Task titles have no exact normalized duplicates");
const index=read("docs/security/README.md");
for(const doc of docs)pass(index.includes(doc.split("/").at(-1)),"Single master index links "+doc);
pass(index.includes("No production payment, login, document upload, database privileges or DNS settings were changed"),
 "Baseline remains read-only and cannot pretend critical production risks were fixed");
const vercel=JSON.parse(read("vercel.json"));
const headers=(vercel.headers||[]).flatMap(item=>item.headers||[]).map(h=>h.key.toLowerCase());
for(const name of ["strict-transport-security","x-content-type-options","x-frame-options","content-security-policy"])
 pass(headers.includes(name),"Existing deployed-header configuration remains represented: "+name);
const config=read("supabase/config.toml");
for(const name of ["create-payment","yoco-checkout","yoco-verify-payment","reskonnect-brain","adminos-agent"]){
 const line="[functions."+name+"]";
 const idx=config.indexOf(line);
 pass(idx>=0&&/^\s*verify_jwt\s*=\s*true\s*$/m.test(config.slice(idx+line.length).split("[functions.")[0]),
  name+" retains its Supabase transport JWT gate");
}
const webhookSection=config.split("[functions.yoco-webhook]")[1]?.split("[functions.")[0]||"";
pass(/^\s*verify_jwt\s*=\s*false\s*$/m.test(webhookSection)
  &&read("supabase/functions/yoco-webhook/index.ts").includes("verifyYocoWebhook")
  &&read("supabase/functions/_shared/yoco-webhook-security.mjs").includes('crypto.subtle.sign'),
 "Yoco webhook is provider-HMAC authenticated without an incompatible Supabase user JWT");
const dep=read(".github/workflows/dependency-security.yml");
pass(dep.includes("pull_request:")&&dep.includes("dependency-security-audit.mjs"),
 "Existing dependency audit remains release-gated");
console.log("78 task identities validated; this is registry integrity, not a penetration test.");
