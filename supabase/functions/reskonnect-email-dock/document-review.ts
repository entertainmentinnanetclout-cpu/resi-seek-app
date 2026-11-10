import {readCase,safe,validUuid,type EmailSession} from "./context.ts";
import type {CaseContext,Kind} from "./correspondence.ts";

type Source="global"|"application";
type DocumentRecord={
 id:string;source:Source;type:string;name:string;status:string;uploaded_at:string|null;
 verified_at:string|null;path:string;owner_id:string;rejection_reason:string|null;
};
const reviewKinds=(kind:Kind)=>kind==="application"||kind==="reservation";
const small=(value:unknown,max=160)=>safe(value,max);
const hash=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest(
 "SHA-256",new TextEncoder().encode(JSON.stringify(value)))))
 .map(b=>b.toString(16).padStart(2,"0")).join("");

export async function loadCaseDocuments(s:EmailSession,kind:Kind,id:string){
 if(!reviewKinds(kind))throw Error("Document reviews are available for applications and reservations");
 if(!validUuid(id))throw Error("Invalid student case");
 // readCase verifies operator role, assigned residence and consent before service-role access.
 const c=await readCase(s,kind,id);
 if(!c.userId)throw Error("This case has no verified student account to retrieve documents from");
 const [global,application]=await Promise.all([
  s.db.from("documents").select("id,user_id,document_type,file_name,file_path,status,uploaded_at,verified_at,admin_notes")
   .eq("user_id",c.userId).order("uploaded_at",{ascending:false}).limit(150),
  kind==="application"?s.db.from("application_documents")
   .select("id,application_id,doc_type,original_filename,file_path,status,rejection_reason,uploaded_at,verified_at")
   .eq("application_id",id).order("uploaded_at",{ascending:false}).limit(150):
   Promise.resolve({data:[],error:null})
 ]);
 if(global.error||application.error)throw Error("Student document records cannot be loaded");
 const docs:DocumentRecord[]=[
  ...(global.data||[]).map((r:any)=>({
   id:r.id,source:"global" as Source,type:small(r.document_type,70),name:small(r.file_name||r.document_type,160),
   status:small(r.status||"pending",32),uploaded_at:r.uploaded_at||null,verified_at:r.verified_at||null,
   path:String(r.file_path||""),owner_id:String(r.user_id),rejection_reason:null
  })),
  ...(application.data||[]).map((r:any)=>({
   id:r.id,source:"application" as Source,type:small(r.doc_type,70),name:small(r.original_filename||r.doc_type,160),
   status:small(r.status||"pending",32),uploaded_at:r.uploaded_at||null,verified_at:r.verified_at||null,
   path:String(r.file_path||""),owner_id:id,rejection_reason:small(r.rejection_reason,240)||null
  }))
 ];
 // A global document path is user-prefixed in the private bucket. Never allow the client to
 // choose a storage object or use an untrusted URL as a path.
 const permittedDocs=docs.filter(d=>d.path.startsWith(c.userId+"/")&&
  !d.path.includes("..")&&!/^https?:/i.test(d.path));
 const signature=await hash({
  case_id:c.id,status:c.status,funding:c.fundingType,
  docs:permittedDocs.map(d=>({source:d.source,id:d.id,type:d.type,status:d.status,
   path:d.path,uploaded_at:d.uploaded_at,verified_at:d.verified_at}))
   .sort((a,b)=>a.id.localeCompare(b.id))
 });
 return {c,docs:permittedDocs,signature};
}
const visible=(s:EmailSession,d:DocumentRecord)=>({
 id:d.id,source:d.source,type:d.type,name:d.name,status:d.status,
 uploaded_at:d.uploaded_at,verified_at:d.verified_at,
 rejection_reason:d.rejection_reason,
 can_verify:s.isAdmin||d.source==="application",
 can_open:!!d.path&&!d.path.includes("..")&&!/^https?:/i.test(d.path)
});
export async function listDocumentReview(s:EmailSession,kind:Kind,id:string){
 const {c,docs,signature}=await loadCaseDocuments(s,kind,id);
 return {items:docs.map(d=>visible(s,d)),document_count:docs.length,document_signal:c.documents,
  case_status:c.status,document_snapshot_sha256:signature,
  message:"Preview uploaded files before marking readiness reviewed. Reviewing does not approve a student or funding."};
}
export async function documentPreview(s:EmailSession,kind:Kind,id:string,source:Source,documentId:string){
 if(!validUuid(documentId)||!["global","application"].includes(source))throw Error("Invalid document");
 const {docs}=await loadCaseDocuments(s,kind,id);
 const d=docs.find(d=>d.id===documentId&&d.source===source);
 if(!d||!d.path||d.path.includes("..")||/^https?:/i.test(d.path))throw Error("Document is unavailable");
 const bucket=d.source==="global"?"documents":"application-documents";
 const {data,error}=await s.db.storage.from(bucket).createSignedUrl(d.path,90);
 if(error||!data?.signedUrl)throw Error("A private document preview could not be generated");
 const ext=d.path.toLowerCase().split(".").pop()||d.name.toLowerCase().split(".").pop();
 const media=ext==="pdf"?"pdf":["png","jpg","jpeg","webp"].includes(ext||"")?"image":"download";
 return {id:d.id,source:d.source,name:d.name,url:data.signedUrl,media,expires_in_seconds:90};
}
export async function acknowledgeDocumentReview(s:EmailSession,kind:Kind,id:string,input:any){
 if(input?.operator_confirmed!==true)throw Error("Confirm that you reviewed the uploaded documents and readiness");
 const {docs,signature}=await loadCaseDocuments(s,kind,id);
 if(input.document_snapshot_sha256!==signature)throw Error("Student documents changed. Reload and review the latest files");
 const {data,error}=await s.db.from("reskonnect_document_review_audit")
  .insert({actor_user_id:s.actor,target_kind:kind,target_id:id,
   document_snapshot_sha256:signature,document_count:docs.length})
  .select("id,created_at").single();
 if(error||!data)throw Error("Could not save the document review acknowledgement");
 return {review_id:data.id,reviewed_at:data.created_at,document_count:docs.length,document_snapshot_sha256:signature};
}
export async function assertReviewed(s:EmailSession,c:CaseContext,reviewId:unknown){
 if(!reviewKinds(c.kind))return;
 if(!validUuid(reviewId))throw Error("Review this student's uploaded documents before sending");
 const {data,error}=await s.db.from("reskonnect_document_review_audit")
  .select("id,created_at,document_snapshot_sha256")
  .eq("id",reviewId).eq("actor_user_id",s.actor)
  .eq("target_kind",c.kind).eq("target_id",c.id).maybeSingle();
 if(error||!data)throw Error("A valid document review is required before contacting this student");
 if(Date.now()-new Date(data.created_at).getTime()>20*60*1000)
  throw Error("Document review expired. Recheck the documents before sending");
 const {signature}=await loadCaseDocuments(s,c.kind,c.id);
 if(data.document_snapshot_sha256!==signature)
  throw Error("Student documents or case status changed. Review the latest files before sending");
}
export async function setDocumentDecision(s:EmailSession,kind:Kind,id:string,input:any){
 const source=input.source as Source,docId=input.document_id,expected=String(input.expected_status||"");
 const decision=String(input.decision||"");
 const reason=small(input.reason,500);
 if(!validUuid(docId)||!["global","application"].includes(source)||!["verified","rejected"].includes(decision))
  throw Error("Invalid document review decision");
 if(decision==="rejected"&&reason.trim().length<8)throw Error("Explain why the document was rejected (at least 8 characters)");
 const {c,docs}=await loadCaseDocuments(s,kind,id);
 const doc=docs.find(d=>d.id===docId&&d.source===source);
 if(!doc||doc.status!==expected)throw Error("This document changed. Refresh its current status");
 if(source==="global"&&!s.isAdmin)throw Error("Only administrators may change student-level document verification");
 const table=source==="global"?"documents":"application_documents";
 const data:Record<string,unknown>={
  status:decision,verified_by:s.actor,verified_at:new Date().toISOString()
 };
 if(source==="global")data.admin_notes=decision==="rejected"?reason:"";
 else data.rejection_reason=decision==="rejected"?reason:null;
 let query=s.db.from(table).update(data).eq("id",doc.id).eq("status",expected);
 if(source==="global")query=query.eq("user_id",c.userId);
 else query=query.eq("application_id",id);
 const {data:changed,error}=await query.select("id").maybeSingle();
 if(error||!changed)throw Error("Document status changed or permission was denied. Refresh and retry");
 if(kind==="application"){
  const {error:auditError}=await s.db.from("application_activity_log").insert({
   application_id:id,residence_id:c.residenceId,actor_user_id:s.actor,
   actor_type:s.isAdmin?"admin":"residence",action_type:"document_reviewed",
   metadata:{source,document_id:doc.id,previous_status:expected,new_status:decision,
    reason:decision==="rejected"?reason:null}
  });
  if(auditError)console.error("Document decision saved but case audit failed",auditError.message);
 }
 return {updated:true,id:doc.id,status:decision};
}
