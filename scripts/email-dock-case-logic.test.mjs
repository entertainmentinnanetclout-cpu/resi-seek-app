import test from "node:test";
import assert from "node:assert/strict";
import {documentSignal,smartTemplate,renderLetter,htmlEmail} from "../supabase/functions/reskonnect-email-dock/correspondence.ts";

const application=(status,documents)=>({
 kind:"application",id:"7eedec36-29e2-48d1-80dd-69b1273888fa",userId:"7eedec36-29e2-48d1-80dd-69b1273888fa",
 residenceId:null,studentName:"Controlled Test Student",property:"Sample Student Residence",
 year:"2027",status,email:"test@example.org",reference:"7EEDEC36",
 fundingType:"NSFAS",contactAllowed:true,documents
});
test("new application without any files recommends receipt + missing-document request",()=>{
 const docs=documentSignal("application",[],"NSFAS");
 assert.equal(docs.stage,"missing");assert.ok(docs.missing.length>=3);
 assert.equal(smartTemplate(application("submitted",docs)),"documents_needed");
});
test("uploaded documents prompt review and never imply acceptance",()=>{
 const docs=documentSignal("application",[
  {type:"id_document",status:"pending"},
  {type:"proof_of_registration",status:"pending"},
  {type:"nsfas_approval",status:"pending"}
 ],"NSFAS");
 assert.equal(docs.missing.length,0);
 assert.equal(docs.stage,"received");
 const c=application("submitted",docs);
 assert.equal(smartTemplate(c),"documents_received");
 assert.equal(smartTemplate({...c,status:"documents_required"}),"documents_received");
 const letter=renderLetter(c,"smart");
 assert.match(letter.body,/does not in itself mean acceptance/i);
 assert.doesNotMatch(letter.body,/is recorded as APPROVED/);
});
test("formal decisions use recorded status, not document count",()=>{
 const empty=documentSignal("application",[],"NSFAS");
 assert.equal(smartTemplate(application("approved",empty)),"approved");
 assert.equal(smartTemplate(application("rejected",empty)),"rejected");
 assert.equal(smartTemplate(application("conditionally_approved",empty)),"conditionally_approved");
});
test("reservation receipt and confirmation are distinct",()=>{
 const empty=documentSignal("reservation",[],"private");
 const ctx={...application("reserved",empty),kind:"reservation"};
 assert.equal(smartTemplate(ctx),"documents_needed");
 assert.equal(smartTemplate({...ctx,status:"confirmed"}),"reservation_confirmed");
});
test("generated HTML is brand-consistent and escapes malicious applicant strings",()=>{
 const c={...application("submitted",documentSignal("application",[],"NSFAS")),studentName:"<script>alert(1)</script>"};
 const letter=renderLetter(c,"smart");
 const html=htmlEmail(c,letter.subject,letter.body);
 assert.ok(html.includes("RES<span"));
 assert.ok(html.includes("reskonnect@gmail.com"));
 assert.ok(html.includes("&lt;script&gt;"));
 assert.ok(!html.includes("<script>alert(1)</script>"));
});
