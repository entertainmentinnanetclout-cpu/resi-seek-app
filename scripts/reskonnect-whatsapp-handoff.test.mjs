import test from "node:test";
import assert from "node:assert/strict";
import {normalizeWhatsAppPhone,whatsappMessage,whatsappClickToChat} from "../supabase/functions/reskonnect-email-dock/whatsapp.ts";
import {approvedResidencePhoto} from "../supabase/functions/reskonnect-email-dock/residence-media.ts";
import {documentSignal,smartTemplate,renderLetter,htmlEmail} from "../supabase/functions/reskonnect-email-dock/correspondence.ts";

const safePhoto="https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/admin-images/real-residence.jpeg";
const context=(status="submitted",withPhoto=true)=>{
 const documents=documentSignal("application",[],"NSFAS");
 return {kind:"application",id:"2f84f62a-5278-4fe8-adc4-3ca041b6cb7c",
  userId:"2f84f62a-5278-4fe8-adc4-3ca041b6cb7c",
  residenceId:"2f84f62a-5278-4fe8-adc4-3ca041b6cb7c",
  studentName:"Controlled Test Applicant",property:"Example Student Residence",
  year:"2027",status,email:"test@example.org",reference:"2F84F62A",
  fundingType:"NSFAS",contactAllowed:true,documents,
  residenceImageUrl:withPhoto?safePhoto:null,phoneE164:"27821234567"};
};
test("WhatsApp click-to-chat requires a verified-format international phone",()=>{
 assert.equal(normalizeWhatsAppPhone("082 123 4567"),"27821234567");
 assert.equal(normalizeWhatsAppPhone("+27821234567"),"27821234567");
 assert.equal(normalizeWhatsAppPhone("0027821234567"),"27821234567");
 for(const bad of ["", "123","whatsapp:+27821234567","+0ABC", "https://example.org", " +27(82)\\nabc"]){
  assert.equal(normalizeWhatsAppPhone(bad),null);
 }
 const link=whatsappClickToChat("+27821234567","Hello Student,\nMissing documents");
 assert.ok(link.startsWith("https://wa.me/27821234567?text="));
 assert.ok(link.includes("Missing%20documents"));
});
test("Only published project public residence images are eligible",()=>{
 assert.equal(approvedResidencePhoto(safePhoto),safePhoto);
 assert.equal(approvedResidencePhoto("https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/residence-assets/2027/pic.png"),
  "https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/residence-assets/2027/pic.png");
 assert.equal(approvedResidencePhoto("http://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/admin-images/a.jpg"),null);
 assert.equal(approvedResidencePhoto("https://evil.test/../../storage/v1/object/public/admin-images/a.jpg"),null);
 assert.equal(approvedResidencePhoto("https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/sign/application-documents/secret.jpg"),null);
 assert.equal(approvedResidencePhoto("https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/admin-images/photo.jpg?token=private"),null);
});
test("WhatsApp and premium email render the same factual document-aware decision",()=>{
 const ctx=context();
 const key=smartTemplate(ctx);
 assert.equal(key,"documents_needed");
 const letter=renderLetter(ctx,"smart");
 const whatsapp=whatsappMessage(ctx,letter.subject,letter.body);
 const html=htmlEmail(ctx,letter.subject,letter.body);
 assert.ok(whatsapp.includes("Identity document"));
 assert.ok(whatsapp.includes("Proof of funding"));
 assert.ok(whatsapp.includes("www.reskonnect.org"));
 assert.ok(!whatsapp.includes(safePhoto), "Short WhatsApp text should not embed lengthy image URLs; photos remain separately downloadable");
  assert.ok(whatsapp.length<950);
  assert.ok(!whatsapp.includes("*"), "Plain conversational WhatsApp should not use bold markers");
  assert.ok(whatsapp.includes("Next step:"));
 assert.ok(html.includes('src="'+safePhoto+'"'));
 assert.ok(html.includes("Actual residence listing photo"));
 assert.ok(!whatsapp.includes("is recorded as APPROVED"));
});
test("Email retains branded fallback when a property has no photo",()=>{
 const ctx=context("under_review",false);
 const packet=renderLetter(ctx,"smart");
 const html=htmlEmail(ctx,packet.subject,packet.body);
 assert.ok(html.includes("RES<span"));
 assert.ok(!html.includes("<img src="));
 assert.ok(!whatsappMessage(ctx,packet.subject,packet.body).includes("Residence photo:"));
});
