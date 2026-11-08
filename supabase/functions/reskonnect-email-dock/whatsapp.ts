import {smartTemplate,type CaseContext,type TemplateKey} from "./correspondence.ts";

/** WhatsApp Business App handoff only: no API sends and no delivery assumption. */
export function normalizeWhatsAppPhone(value:unknown):string|null{
  if(typeof value!=="string" || value.length>35)return null;
  const text=value.trim().replace(/[\s().-]/g,"");
  if(!text || /[^+0-9]/.test(text) || (text.match(/\+/g)||[]).length>1)return null;
  let digits=text;
  if(text.startsWith("+")) digits=text.slice(1);
  else if(text.startsWith("00"))digits=text.slice(2);
  else if(text.startsWith("0")&&text.length===10)digits="27"+text.slice(1);
  if(!/^[1-9]\d{7,14}$/.test(digits))return null;
  return digits;
}
export function whatsappMessage(context:CaseContext,subject:string,body:string,
 templateKey:TemplateKey="smart",note:string="",senderName:string="ResKonnect"):string{
 // Manual WhatsApp draft only. No auto-send, no markdown shouting.
 const key=templateKey==="smart"?smartTemplate(context):templateKey;
 const first=context.studentName.trim().split(/\s+/)[0]||"there";
 const residence=context.property==="ResKonnect"?"your enquiry":context.property;
 const missing=context.documents.missing.slice(0,5).map(x=>"- "+x).join("\n");
 const status=context.status.replace(/_/g," ").toLowerCase();
 let confirmation="",next="";
 switch(key){
  case "documents_needed":
   confirmation="We need documents to continue your submission for "+residence+".";
   next="Please upload these in your secure ResKonnect account:\n"+missing;break;
  case "documents_received":
   confirmation="Your documents for "+residence+" have been received for review.";
   next="Check your ResKonnect account for a decision. This is not an approval.";break;
  case "approved":
   confirmation="Your application for "+residence+" has been approved.";
   next="The residence will confirm the reservation and arrangements.";break;
  case "rejected":
   confirmation="Your application for "+residence+" was not approved.";
   next="View other accommodation options on ResKonnect or contact support.";break;
  case "conditionally_approved":
   confirmation="Your application for "+residence+" is conditionally approved.";
   next="Complete outstanding requirements in your ResKonnect account.";break;
  case "reservation_confirmed":
   confirmation="Your reservation at "+residence+" is confirmed.";
   next="Check your account for viewing, payment or move-in instructions.";break;
  case "viewing_invite":
   confirmation="We are arranging a viewing at "+residence+".";
   next="Please confirm the date and time with the residence.";break;
  case "move_in_arrangements":
   confirmation="Move-in arrangements are available for "+residence+".";
   next="Confirm your check-in date, location and requirements with the residence.";break;
  case "enquiry_response":
   confirmation="Thank you for your enquiry about "+residence+".";
   next="Please review the details below or reply for help.";break;
  case "acknowledgement":
   confirmation="We received your "+context.kind.replace(/_/g," ")+" for "+residence+".";
   next="Your submission is being reviewed; we'll update you on the next step.";break;
  default:
   confirmation="Your "+context.kind.replace(/_/g," ")+" for "+residence+" is "+status+".";
   next="Check your ResKonnect account for the next step.";break;
 }
 const clean=(value:string,max:number)=>value.replace(/[\r\n]+/g," ").replace(/[\*_~\u0060]/g,"").trim().slice(0,max);
 const detail=clean(note,340);
 const lines=["Hi "+clean(first,45)+",",confirmation,
  ...(key==="documents_needed"?[]:detail?["Details: "+detail]:[]),
  "Next step: "+next,"www.reskonnect.org","- "+clean(senderName,70)];
 void subject;void body;
 return lines.join("\n\n").slice(0,950);
}
export function whatsappClickToChat(phone:string,message:string):string{
  const normalized=normalizeWhatsAppPhone(phone);
  if(!normalized)throw Error("Valid WhatsApp phone number not recorded");
  return "https://wa.me/"+normalized+"?text="+encodeURIComponent(message);
}
