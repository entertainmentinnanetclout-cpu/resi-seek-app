import {smartTemplate,type CaseContext,type TemplateKey} from "./correspondence.ts";

export type CaseBucket =
 "not_contacted"|"missing_documents"|"followup_due"|"student_acted"|
 "awaiting_review"|"decision_changed"|"approved"|"rejected"|"closed"|"awaiting_action";
export type OutboundEmail={
 target_id:string;template_key:string;delivery_status:string;created_at:string;sent_at:string|null;
 context_snapshot:Record<string,unknown>|null;
};
export type CaseJourney={
 bucket:CaseBucket;email_sent:boolean;email_status:string|null;last_email_at:string|null;
 last_email_template:string|null;last_applicant_upload_at:string|null;
 student_uploaded_after_email:boolean;status_changed_since_email:boolean;
 suggested_template:TemplateKey;service_action:string;age_hours:number;
};
/** Evidence-based queue classifier; never infers that Gmail was replied to or read. */
export function deriveCaseJourney(c:CaseContext,last:OutboundEmail|null,lastUpload:string|null,createdAt:string):CaseJourney{
 const now=Date.now();
 const lastAt=last?.sent_at||last?.created_at||null;
 const ageHours=createdAt?Math.max(0,Math.floor((now-new Date(createdAt).getTime())/3600000)):0;
 const sent=last?.delivery_status==="sent";
 const afterEmail=sent&&!!lastAt&&!!lastUpload&&new Date(lastUpload).getTime()>new Date(lastAt).getTime();
 const previous=typeof last?.context_snapshot?.recorded_status==="string"
  ?last.context_snapshot.recorded_status:typeof last?.context_snapshot?.status==="string"
  ?last.context_snapshot.status:null;
 const changed=sent&&!!previous&&previous!==c.status;
 const status=c.status.toLowerCase();
 let bucket:CaseBucket="awaiting_action";
 let serviceAction="Review the current case and next steps";
 if(["rejected"].includes(status)){bucket="rejected";serviceAction=sent&&!changed?"Rejection notice on record":"Review and communicate the recorded rejection";}
 else if(["withdrawn","cancelled"].includes(status)){bucket="closed";serviceAction="Case closed, no automatic outreach";}
 else if(["approved","confirmed"].includes(status)){bucket=changed?"decision_changed":"approved";serviceAction=changed||!sent?"Review the recorded approval or reservation confirmation":"Decision on record; check final placement steps";}
 else if(changed){bucket="decision_changed";serviceAction="Send an updated notice for the new recorded status";}
 else if(afterEmail){bucket="student_acted";serviceAction="New documents uploaded since contact; review validity and outstanding items";}
 else if(c.documents.stage==="received"||c.documents.stage==="complete"){
  bucket="awaiting_review";serviceAction="Uploaded documents are ready for staff verification and decision";
 }
 else if(c.documents.missing.length){
  const hoursSinceEmail=lastAt?Math.floor((now-new Date(lastAt).getTime())/3600000):0;
  if(sent&&hoursSinceEmail>=48){bucket="followup_due";serviceAction="Follow up on missing documents (48-hour operational target)";}
  else {bucket="missing_documents";serviceAction=sent?"Awaiting applicant upload; keep existing request visible":"Send missing-document request";}
 }
 else if(!sent){bucket="not_contacted";serviceAction="Send an initial receipt and next-step guidance";}
 const suggestedTemplate:TemplateKey=bucket==="followup_due"?"follow_up":
  bucket==="student_acted"?"documents_received":
  smartTemplate(c);
 return {
  bucket,email_sent:sent,email_status:last?.delivery_status||null,last_email_at:lastAt,
  last_email_template:last?.template_key||null,last_applicant_upload_at:lastUpload,
  student_uploaded_after_email:afterEmail,status_changed_since_email:changed,
  suggested_template:suggestedTemplate,service_action:serviceAction,age_hours:ageHours
 };
}
