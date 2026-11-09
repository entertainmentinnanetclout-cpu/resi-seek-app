/**
 * ResKonnect case-aware email intelligence. Deterministic, reviewable rules:
 * document uploads do NOT constitute an acceptance/rejection decision.
 */
export type Kind = "application"|"reservation"|"housing_lead"|"support_enquiry";
export type TemplateKey = "smart"|"acknowledgement"|"documents_needed"|"documents_received"|"approved"|"rejected"|"conditionally_approved"|"status_update"|"feedback"|"next_steps"|"enquiry_response"|"viewing_invite"|"follow_up"|"reservation_confirmed"|"move_in_arrangements";
export const KINDS:Kind[]=["application","reservation","housing_lead","support_enquiry"];
export const APPLICATION_STATUSES=["submitted","under_review","documents_required","interview_scheduled","waitlisted","conditionally_approved","approved","rejected","withdrawn"];
export const RESERVATION_STATUSES=["reserved","contacted","provisional_hold","confirmed","cancelled"];
export const TEMPLATES:Record<Exclude<TemplateKey,"smart">,{name:string;subject:string;body:string}>={
 acknowledgement:{name:"Received",subject:"{{property}} | Submission received | {{reference}}",
  body:"We received your {{kind_label}} for {{property}}.\nNext step: {{next_step}}\n{{custom_note}}"},
 documents_needed:{name:"Documents needed",subject:"{{property}} | Documents needed | {{reference}}",
  body:"Your {{kind_label}} for {{property}} needs additional documents:\n{{document_list}}\nNext step: {{next_step}}\n{{custom_note}}"},
 documents_received:{name:"Documents received",subject:"{{property}} | Documents under review | {{reference}}",
  body:"We received your uploaded documents for {{property}}. Uploading documents does not in itself mean acceptance.\nNext step: {{next_step}}\n{{custom_note}}"},
 approved:{name:"Application approved",subject:"{{property}} | Application approved | {{reference}}",
  body:"Your application for {{property}} has been approved.\nNext step: {{next_step}}\n{{custom_note}}"},
 rejected:{name:"Application declined",subject:"{{property}} | Application decision | {{reference}}",
  body:"Your application for {{property}} was not approved.\nNext step: {{next_step}}\n{{custom_note}}"},
 conditionally_approved:{name:"Conditional approval",subject:"{{property}} | Conditional approval | {{reference}}",
  body:"Your application for {{property}} is conditionally approved.\nOutstanding items: {{document_list}}\nNext step: {{next_step}}\n{{custom_note}}"},
 status_update:{name:"Case status update",subject:"{{property}} | {{kind_label}} update | {{reference}}",
  body:"Your {{kind_label}} for {{property}} is currently: {{status}}.\nNext step: {{next_step}}\n{{custom_note}}"},
 feedback:{name:"Case feedback",subject:"{{property}} | Feedback | {{reference}}",
  body:"An update is available for your {{kind_label}} at {{property}} ({{status}}).\n{{custom_note}}\nNext step: {{next_step}}"},
 next_steps:{name:"Next steps",subject:"{{property}} | Next steps | {{reference}}",
  body:"Here are the next steps for {{property}} ({{status}}).\n{{custom_note}}\nNext step: {{next_step}}"},
 enquiry_response:{name:"Enquiry response",subject:"{{property}} | Your enquiry | {{reference}}",
  body:"Thank you for your enquiry about {{property}}.\n{{custom_note}}\nNext step: {{next_step}}"},
 viewing_invite:{name:"Viewing arrangements",subject:"{{property}} | Viewing arrangements | {{reference}}",
  body:"We are arranging a viewing for {{property}}.\n{{custom_note}}\nNext step: Please confirm the viewing date and time with the residence before travelling."},
 follow_up:{name:"Follow-up",subject:"{{property}} | Follow-up | {{reference}}",
  body:"We are following up on your {{kind_label}} for {{property}} ({{status}}).\nNext step: {{next_step}}\n{{custom_note}}"},
 reservation_confirmed:{name:"Reservation confirmed",subject:"{{property}} | Reservation confirmed | {{reference}}",
  body:"Your reservation at {{property}} is confirmed.\nNext step: {{next_step}}\n{{custom_note}}"},
 move_in_arrangements:{name:"Move-in arrangements",subject:"{{property}} | Move-in arrangements | {{reference}}",
  body:"Here are your move-in arrangements for {{property}}.\n{{custom_note}}\nNext step: Check the confirmed date, check-in location and any remaining requirements with your residence."}
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
  residenceImageUrl?:string|null; phoneE164?:string|null;
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
    if(status==="documents_required")return c.documents.missing.length?"documents_needed":c.documents.uploaded>0?"documents_received":"documents_needed";
    if(c.documents.missing.length)return "documents_needed";
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
 if(key==="approved")return "Wait for the residence to confirm reservation, viewing or move-in details.";
 if(key==="rejected")return "Check your dashboard for other available accommodation or contact support.";
 if(key==="reservation_confirmed")return "Review your reservation details, residence rules and any outstanding requirements in your dashboard.";
 return "Sign in to ResKonnect to review your case and required actions.";
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
 const signoff=c.property==="ResKonnect"?"ResKonnect":clean(c.property,140)+" via ResKonnect";
  const body="Hello "+clean(c.studentName,90)+",\n\n"+message+"\n\nKind regards,\n"+signoff;
 return {subject,body,resolved_key:resolved,template_name:def.name,next_step:nextStep(c)};
}
export function htmlEmail(c:CaseContext,subject:string,body:string):string{
 const esc=(x:string)=>x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
 const status=friendly(c.status);
 const step=nextStep(c);
 const cleanedBody=body.replace("Next step: "+step,"").replace(/\n{3,}/g,"\n\n").trim();
 const paragraphs=cleanedBody.split(/\n{2,}/).map(p=>'<p style="margin:0 0 18px;line-height:1.75;color:#344258;font-size:15px;font-weight:400">'+esc(p).replace(/\n/g,"<br>")+"</p>").join("");
 // Published listing photographs stay at their natural aspect ratio, including portrait images.
 const hero=c.residenceImageUrl?'<tr><td style="padding:0 32px 10px"><img src="'+esc(c.residenceImageUrl)+'" alt="Actual residence listing photo: '+esc(c.property)+'" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:10px"><p style="margin:8px 0 0;color:#7e8796;font-size:11px">Actual residence listing photo · '+esc(c.property)+'</p></td></tr>':"";
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>'+
 '<body style="background:#f5f6f8;padding:30px 12px;margin:0;font-family:Arial,Helvetica,sans-serif;color:#12233d">'+
 '<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="max-width:640px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #e7eaf0;border-radius:14px;overflow:hidden">'+
 '<tr><td style="height:5px;background:#D9AB52;font-size:0">&nbsp;</td></tr>'+
 '<tr><td style="padding:29px 32px 20px;background:#ffffff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'+
 '<td style="vertical-align:middle;width:46px"><img src="https://www.reskonnect.org/favicon-transparent.png" width="42" height="42" alt="ResKonnect logo" style="display:block;width:42px;height:42px;object-fit:contain;border:0"></td>'+
 '<td style="vertical-align:middle"><div style="font-size:22px;font-weight:700;letter-spacing:0.4px;color:#071326">RES<span style="color:#B78A3C">KONNECT</span></div><div style="font-size:10px;color:#75839a;letter-spacing:2px;margin-top:3px">STUDENT LIVING &amp; OPPORTUNITY</div></td>'+
 '<td align="right" style="vertical-align:middle;font-size:10px;letter-spacing:1.2px;color:#7f8a9a">CASE UPDATE</td></tr></table></td></tr>'+
 '<tr><td style="padding:0 32px"><div style="height:1px;background:#e6eaf0"></div></td></tr>'+
 '<tr><td style="padding:28px 32px 20px"><p style="font-size:11px;letter-spacing:1.5px;color:#B18A46;text-transform:uppercase;margin:0 0 10px">Personalised correspondence</p>'+
 '<h1 style="font-size:25px;line-height:1.35;letter-spacing:-0.4px;font-weight:600;color:#0a1d37;margin:0 0 18px">'+esc(subject)+'</h1>'+
 '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e9edf2;border-radius:9px;background:#fafbfc;margin-bottom:24px"><tr><td style="padding:13px 16px;color:#6b778a;font-size:12px">Reference<br><span style="font-size:13px;color:#172840">'+esc(c.reference)+'</span></td><td style="padding:13px 16px;color:#6b778a;font-size:12px">Recorded status<br><span style="font-size:13px;color:#172840">'+esc(status)+'</span></td></tr></table>'+
 paragraphs+'</td></tr>'+hero+
 '<tr><td style="padding:12px 32px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #D9AB52;background:#fbf9f4"><tr><td style="padding:18px 20px"><p style="margin:0 0 6px;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#967039">Next step</p><p style="margin:0;color:#18304d;font-size:14px;line-height:1.65">'+esc(step)+'</p></td></tr></table>'+
 '<p style="margin:23px 0 0"><a href="https://www.reskonnect.org/dashboard" style="display:inline-block;background:#071d39;color:#ffffff;text-decoration:none;padding:13px 21px;border-radius:7px;font-size:13px;font-weight:600">View your ResKonnect account</a></p></td></tr>'+
 '<tr><td style="padding:22px 32px 27px;background:#fbfcfd;border-top:1px solid #e7eaf0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:13px;color:#102642;font-weight:600">ResKonnect</td><td align="right" style="font-size:12px;color:#65748a">www.reskonnect.org</td></tr></table>'+
 '<p style="color:#6b778a;font-size:11px;line-height:1.7;margin:13px 0 0">For questions about this case, reply directly to the email address that sent this message.<br>ResKonnect platform support: reskonnect@gmail.com · +27 63 732 3192<br>Official service update. Upload identity and funding documents only through your secure account. This message does not change a case decision.</p></td></tr>'+
 '</table></body></html>';
}
