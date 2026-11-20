import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const sql=read("supabase/migrations/20261120214500_admin_residence_outreach_summary.sql");
const api=read("supabase/functions/reskonnect-email-dock/index.ts");
const fill=read("src/components/admin/ResidenceFillVisualTabs.tsx");
const nav=read("src/components/admin/AdminLayout.tsx");
const catalog=read("src/lib/adminWorkspaces.ts");
const hub=read("src/pages/admin/AdminOperationsHub.tsx");
const home=read("src/pages/admin/AdminBrain.tsx");
const app=read("src/App.tsx");

test("residence summary counts unique 2027 cases rather than email templates or occupied beds",()=>{
 assert.match(sql,/public\.rk_admin_residence_outreach_summary\(p_kind text,p_year integer\)/);
 assert.match(sql,/WHERE p_kind='reservation' AND academic_year=p_year/);
 assert.match(sql,/WHERE p_kind='application' AND academic_year=p_year/);
 assert.match(sql,/count\(\*\) FILTER\(WHERE accepted_messages>0\)/);
 assert.match(sql,/count\(\*\) FILTER\(WHERE accepted_messages=0\)/);
 assert.match(sql,/count\(\*\) FILTER\(WHERE wa_marked\)/);
 assert.match(sql,/m\.delivery_status='sent' AND m\.provider_message_id IS NOT NULL/);
 assert.match(sql,/public\.reskonnect_email_replies/);
 assert.match(sql,/public\.reskonnect_email_response_cases/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.rk_admin_residence_outreach_summary/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.rk_admin_residence_outreach_summary/);
 assert.doesNotMatch(sql,/SECURITY DEFINER|UPDATE public\.accommodation_reservations/);
});

test("only authorized administrators receive a mathematically checked company-wide summary",()=>{
 assert.match(api,/if\(action==="residence_outreach_summary"\)/);
 assert.match(api,/if\(!s\.isAdmin\)return res/);
 assert.match(api,/rk_admin_residence_outreach_summary/);
 assert.match(api,/total!==sent\+left\|\|messages<sent\|\|wa>total/);
 assert.match(api,/verified:true,generated_at/);
 assert.match(api,/Gmail accepted is not inbox delivery\/read/);
});

test("a single residence card exposes correct Gmail, WhatsApp, status and direct mail-dock action",()=>{
 assert.match(fill,/action:"residence_outreach_summary"/);
 assert.match(fill,/outreach\.map\(x=>\[x\.residence_id,x\]\)/);
 assert.match(fill,/row\.outreach\.emailed_cases/);
 assert.match(fill,/row\.outreach\.unemailed_cases/);
 assert.match(fill,/row\.outreach\.emailed_whatsapp_pending/);
 assert.match(fill,/row\.outreach\.status_counts/);
 assert.match(fill,/row\.outreach\.replied_cases/);
 assert.match(fill,/outreachError&&/);
 assert.match(fill,/No unsent counts are inferred while the audit is unavailable/);
 assert.match(fill,/Open Email Dock/);
 assert.match(fill,/residence=\$\{encodeURIComponent\(row\.id\)\}/);
 assert.match(fill,/onSelectResidence\?\.\(selected \? "all" : row\.id\)/);
 assert.match(fill,/Occupancy uses only the/);
 assert.match(fill,/WhatsApp "operator marked sent" does not prove delivery/);
});

test("one visible workspace per function; no deletion of legacy permissions or specialist routes",()=>{
 const routes=[...catalog.matchAll(/\{id:"[^"]+",label:"[^"]+",path:"([^"]+)"/g)].map(x=>x[1]);
 assert.equal(routes.length,8,"eight canonical God Mode workspaces");
 assert.equal(new Set(routes).size,routes.length,"no duplicated primary workspace destinations");
 assert.match(nav,/ADMIN_PRIMARY_WORKSPACES\.map/);
 assert.match(nav,/ADMIN_ADVANCED_TOOLS\.map/);
 assert.match(nav,/specialistDepartments\.map/);
 assert.match(nav,/isGodMode\|\|departments\.includes\(department\.key\)/);
 for(const route of ['path="/admin"','path="/admin/accommodation"','path="/admin/communications"','path="/admin/cases"','path="/admin/studio"','path="/admin/users"','path="/admin/golden-cycle"']){
  assert.ok(app.includes(route),"Original protected route must remain: "+route);
 }
 assert.match(home,/2027 residence command/);
 assert.match(hub,/value=\{applicationView\} onValueChange=\{setApplicationView\}/);
 assert.match(hub,/requestedTab==="2027-reservations"\?"reservations"/);
});
