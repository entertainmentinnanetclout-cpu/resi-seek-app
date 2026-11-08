/**
 * ResKonnect case-aware email intelligence. Deterministic, reviewable rules:
 * document uploads do NOT constitute an acceptance/rejection decision.
 */
export type Kind = "application"|"reservation"|"housing_lead"|"support_enquiry";
export type TemplateKey = "smart"|"acknowledgement"|"documents_needed"|"documents_received"|"approved"|"rejected"|"conditionally_approved"|"status_update"|"feedback"|"next_steps"|"enquiry_response"|"viewing_invite"|"follow_up"|"reservation_confirmed";
export const KINDS:Kind[]=["application","reservation","housing_lead","support_enquiry"];
export const APPLICATION_STATUSES=["submitted","under_review","documents_required","conditionally_approved","approved","rejected","withdrawn"];
export const RESERVATION_STATUSES=["reserved","contacted","provisional_hold","confirmed","cancelled"];
export const TEMPLATES:Record<Exclude<TemplateKey,"smart">,{name:string;subject:string;body:string}>={
  acknowledgement:{name:"Application / reservation receipt",subject:"ResKonnect | We received your {{kind_label}} | {{reference}}",
    body:"We have received your {{kind_label}} for {{property}}.\nCurrent status: {{status}}.\n{{next_step}}\n{{custom_note}}"},
  documents_needed:{name:"Confirmation + missing documents",subject:"ResKonnect | {{kind_label}} received - documents needed | {{reference}}",
    body:"We confirm receipt of your {{kind_label}} for {{property}}.\nTo continue processing, please upload the following outstanding documents in your secure ResKonnect dashboard:\n{{document_list}}\nYour submission is not yet a final approval. {{next_step}}\n{{custom_note}}"},
  documents_received:{name:"Documents uploaded - under review",subject:"ResKonnect | Documents received for review | {{reference}}",
    body:"Thank you for uploading documents for your {{kind_label}} at {{property}}.\nCurrent recorded status: {{status}}.\nYour documents will be reviewed; uploading them does not in itself mean acceptance.\n{{next_step}}\n{{custom_note}}"},
  approved:{name:"Formal approval confirmation",subject:"ResKonnect | Application approved | {{reference}}",
    body:"Your ResKonnect application for {{property}} is recorded as APPROVED.\n{{next_step}}\n{{document_list}}\n{{custom_note}}"},
  rejected:{name:"Application not approved",subject:"ResKonnect | Application decision | {{reference}}",
    body:"Your application for {{property}} is recorded as NOT APPROVED.\nWe understand you may need clarification or alternative options. Please check your ResKonnect dashboard or contact support for your next steps.\n{{custom_note}}"},
  conditionally_approved:{name:"Conditional approval and requirements",subject:"ResKonnect | Conditional approval | {{reference}}",
    body:"Your application for {{property}} is conditionally approved, subject to outstanding requirements being completed and reviewed.\n{{document_list}}\n{{next_step}}\n{{custom_note}}"},
  status_update:{name:"Recorded status update",subject:"ResKonnect | {{kind_label}} status update | {{reference}}",
    body:"This is an official update regarding your {{kind_label}} for {{property}}.\nRecorded status: {{status}}.\n{{next_step}}\n{{custom_note}}"},
  feedback:{name:"Personalized application feedback",subject:"ResKonnect | Feedback on {{kind_label}} | {{reference}}",
    body:"We are contacting you with feedback regarding your {{kind_label}} for {{property}}.\nRecorded status: {{status}}.\n{{custom_note}}\n{{next_step}}"},
  next_steps:{name:"Next steps / follow-up instructions",subject:"ResKonnect | Next steps | {{reference}}",
    body:"Here is an update on what happens next with your {{kind_label}} for {{property}}.\nRecorded status: {{status}}.\n{{next_step}}\n{{custom_note}}"},
  enquiry_response:{name:"New enquiry resolution",subject:"ResKonnect | Response to your enquiry | {{reference}}",
    body:"Thank you for contacting ResKonnect about {{property}}.\n{{custom_note}}\nIf you need further support, please reply to this email or use the official ResKonnect platform."},
  viewing_invite:{name:"Viewing invitation / arrangements",subject:"ResKonnect | Viewing arrangements | {{reference}}",
    body:"We would like to share viewing or residence visit arrangements for {{property}}.\n{{custom_note}}\nPlease confirm any timing directly through approved ResKonnect communication channels."},
  follow_up:{name:"Follow-up reminder",subject:"ResKonnect | Follow-up on your {{kind_label}} | {{reference}}",
    body:"We are following up on your {{kind_label}} for {{property}}.\nRecorded status: {{status}}.\n{{next_step}}\n{{custom_note}}"},
  reservation_confirmed:{name:"Confirmed reservation letter",subject:"ResKonnect | Reservation confirmed | {{reference}}",
    body:"Your reservation for {{property}} is recorded as CONFIRMED.\nThis communication confirms the recorded reservation status, subject to any accommodation terms shown on your dashboard.\n{{next_step}}\n{{custom_note}}"}
};
export const TEMPLATE_KEYS=Object.keys(TEMPLATES) as Exclude<TemplateKey,"smart">[];
export const KIND_LABELS:Record<Kind,string>={application:"accommodation application",reservation:"accommodation reservation",housing_lead:"accommodation enquiry",support_enquiry:"support enquiry"};
export type DocumentRow={type:string;status?:string|null};
export type DocumentSignal={stage:"missing"|"incomplete"|"received"|"complete"|"not_applicable";missing:string[];uploaded:number;pendingReview:number;summary:string};
export type CaseContext={
  kind:Kind; id:string; userId:string|null; residenceId:string|null;
  studentName:string; property:string; year:string; status:string;
  email:string; documents:DocumentSignal; reference:string;
  fundingType:string|null; contactAllowed:boolean;
};
const normal=(x:unknown)=>String(x||"").toLowerCase().replace(/[^a-z0-9]+/g,"_");
const present=(types:string[],aliases:string[])=>types.some(x=>aliases.includes(x));
export function documentSignal(kind:Kind,docs:DocumentRow[],funding:string|null):DocumentSignal{
  if(kind==="housing_lead"||kind==="support_enquiry")
    return {stage:"not_applicable",missing:[],uploaded:0,pendingReview:0,summary:"Documents are not required for this correspondence"};
  const acceptedDocs=docs.filter(x=>!["rejected","deleted","invalid"].includes(normal(x.status)));
  const types=acceptedDocs.map(x=>normal(x.type));
  const missing:string[]=[];
  if(!present(types,["id","id_document","identity_document","passport","passport_document","id_copy"]))
    missing.push("Identity document (ID or passport)");
  if(!present(types,["proof_of_registration","registration","latest_results","academic_results","student_registration","proof_of_study"]))
    missing.push("Proof of registration or latest academic results");
  if(/nsfas|bursary|funded|scholarship/i.test(funding||"") &&
     !present(types,["funding","funding_document","proof_of_funding","nsfas_approval","bursary_letter","funding_proof"]))
    missing.push("Proof of funding / NSFAS or bursary confirmation");
  const pendingReview=acceptedDocs.filter(x=>!["verified","approved","accepted"].includes(normal(x.status))).length;
  const stage=acceptedDocs.length===0?"missing":missing.length?"incomplete":pendingReview?"received":"complete";
  const summary=stage==="missing"?"No supporting documents recorded":
    stage==="incomplete"?"Some required documents are missing":
    stage==="received"?"Documents uploaded, verification pending":"Documents available and verified";
  return {stage,missing,uploaded:acceptedDocs.length,pendingReview,summary};
}
export function smartTemplate(c:CaseContext):Exclude<TemplateKey,"smart">{
  const status=normal(c.status);
  if(c.kind==="application"){
    if(status==="approved")return "approved";
    if(status==="rejected")return "rejected";
    if(status==="conditionally_approved")return "conditionally_approved";
    if(status==="withdrawn")return "status_update";
    if(status==="documents_required"||c.documents.missing.length)return "documents_needed";
    if(c.documents.uploaded>0)return "documents_received";
    return "acknowledgement";
  }
  if(c.kind==="reservation"){
    if(status==="confirmed")return "reservation_confirmed";
    if(status==="cancelled")return "status_update";
    if(c.documents.missing.length)return "documents_needed";
    if(status==="contacted")return "follow_up";
    return "acknowledgement";
  }
  if(c.kind==="housing_lead")return status==="contacted"?"follow_up":"enquiry_response";
  return "enquiry_response";
}
const clean=(input:unknown,max=5000)=>String(input||"").replace(/\r/g,"").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,"").slice(0,max);
const friendly=(x:string)=>clean(x,100).replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase());
export function nextStep(c:CaseContext):string{
 const key=smartTemplate(c);
 if(key==="documents_needed")return "Upload documents through your ResKonnect account. Do not email ID copies directly.";
 if(key==="documents_received")return "Check your dashboard for verification and decision updates. No final decision has been made by this email.";
 if(key==="conditionally_approved")return "Complete all listed conditions before your placement can be finalized.";
 if(key==="approved")return "Check your dashboard for any placement requirements and verified next steps.";
 if(key==="rejected")return "Contact ResKonnect support if you need clarification.";
 if(key==="reservation_confirmed")return "Review your reservation details, residence rules and any outstanding requirements in your dashboard.";
 return "Sign in to ResKonnect to see current information and any required actions.";
}
export function validateTemplate(value:string,max:number):boolean{
 if(typeof value!=="string"||value.trim().length<5||value.length>max)return false;
 const matches=[...value.matchAll(/\{\{([^}]+)\}\}/g)];
 return matches.every(m=>["student_name","property","reference","status","document_list","next_step","custom_note","kind_label","year","contact_email"].includes(m[1].trim()));
}
export function renderLetter(c:CaseContext,key:TemplateKey,customNote:string="",override?:{subject_template:string;body_template:string}){
 const resolved=key==="smart"?smartTemplate(c):key;
 const def=TEMPLATES[resolved];
 if(!def)throw Error("Unknown correspondence template");
 const status=friendly(c.status);
 const docList=c.documents.missing.length?c.documents.missing.map(x=>"- "+x).join("\n"):
   c.documents.uploaded?"Document submissions recorded: "+c.documents.uploaded+" (verification may still be pending).":"No additional document request in this notice.";
 const variables:Record<string,string>={
   student_name:clean(c.studentName,100),property:clean(c.property,140),reference:clean(c.reference,50),
   status,document_list:docList,next_step:nextStep(c),custom_note:clean(customNote,2500),
   kind_label:KIND_LABELS[c.kind],year:clean(c.year,8),contact_email:"reskonnect@gmail.com"
 };
 const expand=(v:string)=>v.replace(/\{\{([^}]+)\}\}/g,(_,name)=>variables[name.trim()]??"").replace(/\n{3,}/g,"\n\n").trim();
 const subject=expand(override?.subject_template||def.subject).replace(/[\r\n]/g," ").slice(0,180);
 const message=expand(override?.body_template||def.body);
 const body="Hello "+clean(c.studentName,90)+",\n\n"+message+"\n\nKind regards,\nResKonnect Communications\n"+(c.property!=="ResKonnect"?"On behalf of "+clean(c.property,140)+"\n":"")+"\nThis is a service notification about your existing ResKonnect case. Never email identity documents; upload securely on ResKonnect.";
 return {subject,body,resolved_key:resolved,template_name:def.name,next_step:nextStep(c)};
}
export function htmlEmail(c:CaseContext,subject:string,body:string):string{
 const esc=(x:string)=>x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
 const paragraphs=body.split(/\n{2,}/).map(p=>"<p style=\"margin:0 0 15px;line-height:1.65;color:#29364a;font-size:14px\">"+esc(p).replace(/\n/g,"<br>")+"</p>").join("");
 return '<!doctype html><html><body style="background:#f1f5fa;padding:24px 8px;margin:0;font-family:Arial,Helvetica,sans-serif">'+
 '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:640px;width:100%;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden">'+
 '<tr><td style="background:#071326;padding:28px 32px;border-top:6px solid #F5B32F"><div style="color:#ffffff;font-size:29px;font-weight:900;letter-spacing:1px">RES<span style="color:#F5B32F">KONNECT</span></div>'+
 '<div style="color:#b6caea;font-size:11px;letter-spacing:1.5px;margin-top:5px">LIVING &bull; AI &bull; OPPORTUNITY</div></td></tr>'+
 '<tr><td style="padding:32px"><div style="color:#2563EB;font-weight:bold;font-size:11px;letter-spacing:1.5px;text-transform:uppercase">OFFICIAL CASE COMMUNICATION</div>'+
 '<h1 style="margin:14px 0 20px;color:#071326;font-size:23px;line-height:1.3">'+esc(subject)+'</h1>'+
 '<div style="border-left:4px solid #F5B32F;padding:8px 14px;background:#f8fafc;margin-bottom:24px;color:#334155;font-size:12px">Case reference: <strong>'+esc(c.reference)+'</strong> &nbsp; &bull; &nbsp; Recorded status: '+esc(friendly(c.status))+'</div>'+
 paragraphs+
 '<p style="margin-top:24px"><a href="https://www.reskonnect.org/dashboard" style="display:inline-block;background:#2563EB;color:white;padding:12px 20px;text-decoration:none;font-size:13px;font-weight:bold;border-radius:7px">Open ResKonnect Dashboard</a></p></td></tr>'+
 '<tr><td style="background:#071326;color:#dbeafe;padding:24px 32px"><div style="font-size:16px;font-weight:bold;color:#fff">ResKonnect</div>'+
 '<p style="font-size:11px;line-height:1.7;margin:8px 0;color:#bdcbe0">Connecting Residents. Advancing Futures.<br>'+
 'www.reskonnect.org &nbsp; | &nbsp; reskonnect@gmail.com &nbsp; | &nbsp; +27 63 732 3192</p>'+
 '<p style="border-top:1px solid #374151;padding-top:12px;margin:12px 0 0;color:#a8b9d2;font-size:10px">Official service correspondence. Upload requested personal documents only through your secure account. Gmail sending does not change case decisions.</p>'+
 '</td></tr></table></body></html>';
}
