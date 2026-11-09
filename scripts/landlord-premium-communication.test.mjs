import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {documentSignal,renderLetter,htmlEmail,smartTemplate} from "../supabase/functions/reskonnect-email-dock/correspondence.ts";
import {whatsappMessage} from "../supabase/functions/reskonnect-email-dock/whatsapp.ts";

const read=(file)=>readFileSync(file,"utf8");
const app=(status="submitted",documents=documentSignal("application",[],"NSFAS"))=>({
 kind:"application",id:"c81249e5-7315-4625-b4b0-d6b990234beb",userId:null,residenceId:null,
 studentName:"Jane Test",property:"Example Residence",year:"2027",status,
 email:"jane@example.org",reference:"C81249E5",fundingType:"NSFAS",contactAllowed:true,documents
});
test("templates provide a clear next step without inferring decisions",()=>{
 const c=app(),letter=renderLetter(c,"smart");
 assert.equal(smartTemplate(c),"documents_needed");
 assert.match(letter.body,/Next step:/);
 assert.match(letter.body,/Proof of funding/);
 assert.doesNotMatch(letter.body,/application has been approved/i);
 assert.match(renderLetter(app("approved"),"smart").body,/has been approved/);
 assert.match(renderLetter(app("rejected"),"smart").body,/was not approved/);
});
test("WhatsApp stays short, plain and action-led for each recorded state",()=>{
 const c=app();
 const message=whatsappMessage(c,"subject","body");
 assert.ok(message.length<=950);
 assert.doesNotMatch(message,/[\*_~]/);
 assert.match(message,/Next step:/);
 assert.match(message,/secure ResKonnect account/);
 assert.doesNotMatch(message,/has been approved/i);
 const decision=whatsappMessage(app("approved"),"subject","body");
 assert.match(decision,/approved/);
 assert.doesNotMatch(decision,/confirmed reservation/i);
});
test("premium email HTML is white, brand consistent, accessible and escaped",()=>{
 const c={...app(),studentName:'<script>alert("bad")</script>',
 residenceImageUrl:"https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/admin-images/residence.jpg"};
 const l=renderLetter(c,"smart");
 const html=htmlEmail(c,l.subject,l.body);
 assert.match(html,/background:#ffffff/);
 assert.match(html,/favicon-transparent\.png/);
 assert.match(html,/max-width:560px;height:auto/);
 assert.match(html,/Next step/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>alert/);
});
test("landlords get four guided OAuth steps and official direct links",()=>{
 const guide=read("src/components/communications/LandlordGmailGuide.tsx");
 assert.match(guide,/Connect your email in 4 simple steps/);
 assert.match(guide,/steps\.map/);
 assert.match(guide,/https:\/\/mail\.google\.com\//);
 assert.match(guide,/https:\/\/myaccount\.google\.com\/connections/);
 assert.match(guide,/Connect Gmail securely/);
 const dock=read("src/components/communications/PremiumEmailDock.tsx");
 assert.match(dock,/mode==="landlord"/);
 assert.match(dock,/LandlordGmailGuide/);
});
test("OAuth sender access remains per-account, with PKCE and least-privilege Gmail send",()=>{
 const connect=read("supabase/functions/gmail-connect/index.ts");
 const callback=read("supabase/functions/gmail-callback/index.ts");
 const send=read("supabase/functions/reskonnect-email-dock/send.ts");
 assert.match(connect,/code_challenge_method","S256"/);
 assert.match(connect,/https:\/\/www\.googleapis\.com\/auth\/gmail\.send/);
 assert.match(callback,/p_user_id:user_id/);
 assert.match(send,/p_user_id:s\.actor/);
 assert.match(send,/\.eq\("user_id",s\.actor\)/);
 assert.match(send,/Move-in arrangements require a confirmed reservation/);
 assert.match(send,/Add practical details such as/);
});
test("PDF is vector text with a white header/footer and photo fit-to-ratio",()=>{
 const pdf=read("supabase/functions/reskonnect-email-dock/pdf.ts");
 assert.match(pdf,/StandardFonts\.Helvetica/);
 assert.match(pdf,/favicon-transparent\.png/);
 assert.match(pdf,/maxW\/photo\.width,maxH\/photo\.height/);
 assert.match(pdf,/height:89,color:rgb\(1,1,1\)/);
});

test("branded sender keeps the OAuth mailbox as From and Reply-To, never a forged address",()=>{
 const pdf=read("supabase/functions/reskonnect-email-dock/pdf.ts");
 const send=read("supabase/functions/reskonnect-email-dock/send.ts");
 const correspondence=read("supabase/functions/reskonnect-email-dock/correspondence.ts");
 assert.match(pdf,/const senderEmail=sender\?\.email\?\.trim\(\)\.toLowerCase\(\)/);
 assert.match(pdf,/From: =\?UTF-8\?B\?/);
 assert.match(pdf,/Reply-To: /);
 assert.match(pdf,/senderEmail/);
 assert.match(pdf,/Connected Gmail sender address is invalid/);
 assert.match(send,/select\("enabled,gmail_address"\)/);
 assert.match(send,/const fromEmail=String\(connected\.gmail_address/);
 assert.match(send,/\{name:senderName,email:sender\.fromEmail\}/);
 assert.match(send,/s\.isAdmin\?"ResKonnect":\(ctx\.property/);
 assert.match(correspondence,/reply directly to the email address that sent this message/);
 assert.match(correspondence,/ResKonnect platform support/);
 assert.doesNotMatch(correspondence,/>reskonnect@gmail\.com · \+27 63 732 3192<br>Official service update/);
});
test("Berlin property title is preserved and Gmail verification is never misrepresented",()=>{
 const ctx={...app(),property:"Berlin Private & Student Living"};
 const letter=renderLetter(ctx,"acknowledgement");
 assert.match(letter.subject,/^Berlin Private & Student Living \|/);
 assert.match(letter.body,/Berlin Private & Student Living/);
 const guide=read("src/components/communications/LandlordGmailGuide.tsx");
 const privacy=read("src/pages/Privacy.tsx");
 assert.match(guide,/unverified app/);
 assert.match(guide,/Google.*OAuth approval/);
 assert.match(guide,/console\.cloud\.google\.com\/auth\/branding/);
 assert.match(guide,/console\.cloud\.google\.com\/auth\/verification/);
 assert.match(guide,/gmail\.send/);
 assert.match(guide,/SPF, DKIM and DMARC/);
 assert.match(privacy,/Gmail send-only/);
 assert.match(privacy,/does not allow ResKonnect to read your Gmail inbox/);
 assert.match(privacy,/myaccount\.google\.com\/connections/);
});
