import test from "node:test";
import assert from "node:assert/strict";
import {documentSignal,smartTemplate} from "../supabase/functions/reskonnect-email-dock/correspondence.ts";
import {deriveCaseJourney,caseFingerprint} from "../supabase/functions/reskonnect-email-dock/case-queue.ts";

const caseOf=(status="submitted",docs=[])=>({
 kind:"application",id:"3d8fc728-2499-4ed8-b184-760e4aa173b6",userId:null,
 residenceId:"3d8fc728-2499-4ed8-b184-760e4aa173b6",
 studentName:"Test applicant",property:"Test residence",status,
 email:"tester@example.org",year:"2026",reference:"3D8FC728",
 fundingType:"private",contactAllowed:true,documents:documentSignal("application",docs,"private")
});
const hoursAgo=(n)=>new Date(Date.now()-n*3600000).toISOString();
test("new cases are not-contacted or missing-docs; no invented Gmail reply",()=>{
 const c=caseOf();
 const state=deriveCaseJourney(c,null,null,hoursAgo(3));
 assert.equal(state.bucket,"missing_documents");
 assert.equal(state.email_sent,false);
 assert.equal(state.student_uploaded_after_email,false);
});
test("an applicant uploading after a documented email is flagged as acted, not automatically approved",()=>{
 const c=caseOf("under_review",[{type:"id_document",status:"pending"}]);
 const sent={target_id:c.id,template_key:"documents_needed",delivery_status:"sent",
  created_at:hoursAgo(5),sent_at:hoursAgo(5),context_snapshot:{recorded_status:"under_review",document_stage:"missing"}};
 const stage=deriveCaseJourney(c,sent,hoursAgo(1),hoursAgo(7));
 assert.equal(stage.bucket,"student_acted");
 assert.equal(stage.suggested_template,"documents_received");
 assert.equal(stage.email_sent,true);
 assert.equal(stage.status_changed_since_email,false);
 assert.notEqual(smartTemplate(c),"approved");
});
test("recorded decision changed after email signals a new service notice",()=>{
 const c=caseOf("approved");
 const sent={target_id:c.id,template_key:"documents_needed",delivery_status:"sent",
  created_at:hoursAgo(5),sent_at:hoursAgo(5),context_snapshot:{recorded_status:"submitted"}};
 const stage=deriveCaseJourney(c,sent,null,hoursAgo(9));
 assert.equal(stage.bucket,"decision_changed");
 assert.equal(stage.status_changed_since_email,true);
});
test("48h missing-document followup is suggested only after a documented send",()=>{
 const c=caseOf("documents_required");
 const msg={target_id:c.id,template_key:"documents_needed",delivery_status:"sent",
  created_at:hoursAgo(54),sent_at:hoursAgo(54),context_snapshot:{recorded_status:"documents_required"}};
 const stage=deriveCaseJourney(c,msg,null,hoursAgo(60));
 assert.equal(stage.bucket,"followup_due");
 assert.equal(stage.suggested_template,"follow_up");
});
test("case fingerprint changes with status, uploads and contact consent",async()=>{
 const base=caseOf("submitted");
 const initial=await caseFingerprint(base);
 assert.notEqual(initial,await caseFingerprint({...base,status:"approved"}));
 assert.notEqual(initial,await caseFingerprint({...base,contactAllowed:false}));
 assert.notEqual(initial,await caseFingerprint({...base,documents:documentSignal("application",[{type:"id_document",status:"pending"}],"private")}));
});
