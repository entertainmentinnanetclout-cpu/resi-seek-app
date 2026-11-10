import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const ui=read("src/components/communications/PremiumEmailDock.tsx");
const context=read("supabase/functions/reskonnect-email-dock/context.ts");
const edge=read("supabase/functions/reskonnect-email-dock/index.ts");

test("navigation to Applications and Reservations comes before the contact tracker and queue",()=>{
 const nav=ui.indexOf('aria-label="Communications workspace"');
 const apps=ui.indexOf('Object.keys(kindLabels)',nav);
 const activity=ui.indexOf('workspace==="activity"?<ContactActivityDashboard',nav);
 const queue=ui.indexOf('Student queue',nav);
 assert.ok(nav>0&&apps>nav&&activity>apps&&queue>activity,"Cases must be visible without passing through the contact tracker");
 assert.match(ui,/setWorkspace\("cases"\)/);
 assert.match(ui,/setWorkspace\("activity"\)/);
 assert.match(ui,/next\.set\("view","activity"\)/);
 assert.match(ui,/next\.delete\("view"\)/);
 assert.match(ui,/setParams\(next,\{replace:true\}\)/);
});

test("one compact filter bar exposes uploaded, missing, review and contact states immediately",()=>{
 for(const text of ["Docs uploaded","Missing docs","Ready to review","No email yet","Follow-up due",
  "Search student, residence, reference","Academic year","Needs action first","More filters",
  "No documents uploaded","Load all for complete filtering"]){
  assert.ok(ui.includes(text),"Missing primary workflow affordance "+text);
 }
 assert.match(ui,/if\(filter==="uploaded"\)return \(x\.uploaded_count\|\|0\)>0/);
 assert.match(ui,/if\(filter==="missing"\)return x\.missing_count>0/);
 assert.match(ui,/workflow_bucket==="decision_changed"/);
 assert.match(ui,/uploaded_count\?:number/);
});

test("queue shows trustworthy progress badges and actionable next steps",()=>{
 for(const x of ["No uploads","uploaded","missing","to review","Email sent","No email yet","Next:","selected===item.id"]) assert.ok(ui.includes(x));
 assert.match(ui,/item\.service_action/);
 assert.match(ui,/item\.student_uploaded_after_email/);
 assert.match(ui,/totalCases>600/);
 assert.match(ui,/loadedQueueKeyRef\.current!==queueKey/);
 assert.match(ui,/void loadRemaining\(true\)/);
 assert.match(ui,/id="rk-case-detail-panel"/);
 assert.match(ui,/scrollIntoView/);
 assert.match(context,/uploaded_count:submittedDocs\.length/);
 assert.match(context,/const submittedDocs=/);
 assert.match(context,/workflow_bucket:journey\.bucket/);
});

test("backend access control and all communication actions are retained unchanged",()=>{
 assert.match(edge,/db\.auth\.getUser\(bearer\)/);
 assert.match(edge,/if\(!isAdmin&&!isLandlord\)/);
 for(const action of ["whatsapp_handoff","whatsapp_mark_sent","bulk_status_preview","bulk_status_apply","bulk_send","send","history","contact_activity"])
  assert.ok(edge.includes(action),"Missing existing action "+action);
 for(const control of ["ManualWhatsAppPanel","previewOne","sendOne","sendBulk","applyStatuses","loadHistory","LandlordGmailGuide"])
  assert.ok(ui.includes(control),"Dropped communication operation "+control);
});
