import {useCallback,useEffect,useState} from "react";
import {AlertTriangle,CheckCircle2,ExternalLink,Eye,FileCheck2,Loader2,RefreshCw,ShieldCheck,XCircle} from "lucide-react";
import {toast} from "sonner";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";

type Kind="application"|"reservation"|"housing_lead"|"support_enquiry";
type DocumentItem={
 id:string;source:"global"|"application";type:string;name:string;status:string;
 uploaded_at:string|null;verified_at:string|null;rejection_reason:string|null;
 can_verify:boolean;can_open:boolean;
};
type DocumentList={
 items:DocumentItem[];document_count:number;document_snapshot_sha256:string;
 case_status:string;document_signal:{stage:string;missing:string[];pendingReview:number;uploaded:number;summary:string};
};
export type DocumentReviewReceipt={id:string;at:string;signature:string};
type Props={
 kind:Kind;targetId:string;
 invoke:(body:Record<string,unknown>)=>Promise<any>;
 receipt:DocumentReviewReceipt|null;
 onReviewed:(receipt:DocumentReviewReceipt|null)=>void;
 onDocumentsChanged:()=>void;
};
const readable=(s:string)=>String(s||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const stateType=(s:string)=>["verified","approved","accepted"].includes(s.toLowerCase())?"verified":
 ["rejected","invalid"].includes(s.toLowerCase())?"rejected":"pending";
const date=(s:string|null)=>s?new Date(s).toLocaleDateString("en-ZA"):"Unknown date";

export default function DocumentReviewPanel({kind,targetId,invoke,receipt,onReviewed,onDocumentsChanged}:Props){
 const [record,setRecord]=useState<DocumentList|null>(null);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [ack,setAck]=useState(false);
 const [opened,setOpened]=useState<Set<string>>(()=>new Set());
 const [preview,setPreview]=useState<{url:string;name:string;media:string}|null>(null);
 const [rejecting,setRejecting]=useState<string|null>(null);
 const [reason,setReason]=useState("");
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30_000);return()=>window.clearInterval(timer);},[]);
 const available=kind==="application"||kind==="reservation";
 const load=useCallback(async()=>{
  if(!targetId||!available){setRecord(null);return;}
  setBusy("loading");
  try{
   const result=await invoke({action:"document_list",kind,target_id:targetId}) as DocumentList;
   if(!Array.isArray(result.items)||!result.document_snapshot_sha256)throw Error("Document list could not be verified");
   setRecord(result);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Cannot retrieve document review");setRecord(null);}
  finally{setBusy("");}
 },[invoke,kind,targetId,available]);
 useEffect(()=>{
  setRecord(null);setError("");setAck(false);setOpened(new Set());setPreview(null);setRejecting(null);
  void load();
 },[load]);
 if(!available)return null;
 const current=!!record&&!!receipt&&receipt.signature===record.document_snapshot_sha256&&
  now-new Date(receipt.at).getTime()<20*60*1000;
 const view=async(doc:DocumentItem)=>{
  if(!doc.can_open)return toast.error("This file cannot be previewed");
  setBusy(doc.id);
  try{
   const r=await invoke({action:"document_preview",kind,target_id:targetId,source:doc.source,document_id:doc.id});
   if(!r.url)throw Error("Secure preview unavailable");
   setPreview({url:r.url,name:doc.name,media:r.media||"download"});
   setOpened(s=>new Set(s).add(doc.source+":"+doc.id));
  }catch(e){toast.error(e instanceof Error?e.message:"Could not load this file");}
  finally{setBusy("");}
 };
 const decide=async(doc:DocumentItem,decision:"verified"|"rejected")=>{
  if(!window.confirm(decision==="verified"?"Confirm this actual file meets its verification requirements?":"Reject this file and record the correction required?"))return;
  setBusy(doc.id);
  try{
   await invoke({action:"document_decision",kind,target_id:targetId,source:doc.source,document_id:doc.id,
    expected_status:doc.status,decision,reason:decision==="rejected"?reason:""});
   onReviewed(null);setAck(false);setPreview(null);setRejecting(null);setReason("");
   toast.success(decision==="verified"?"Document verified":"Document rejected with reason");
   await load();onDocumentsChanged();
  }catch(e){toast.error(e instanceof Error?e.message:"Document decision failed");}
  finally{setBusy("");}
 };
 const confirmReview=async()=>{
  if(!ack||!record)return;
  setBusy("review");
  try{
   const r=await invoke({action:"document_review_ack",kind,target_id:targetId,
    document_snapshot_sha256:record.document_snapshot_sha256,operator_confirmed:true});
   onReviewed({id:r.review_id,at:r.reviewed_at,signature:r.document_snapshot_sha256});
   setAck(false);
   toast.success("Document readiness reviewed. You can now prepare the student's message.");
  }catch(e){toast.error(e instanceof Error?e.message:"Document review not recorded");await load();}
  finally{setBusy("");}
 };
 const verified=record?.items.filter(d=>stateType(d.status)==="verified").length||0;
 const pending=record?.items.filter(d=>stateType(d.status)==="pending").length||0;
 const rejected=record?.items.filter(d=>stateType(d.status)==="rejected").length||0;
 const unviewedPending=record?.items.filter(d=>stateType(d.status)==="pending"&&d.can_open&&!opened.has(d.source+":"+d.id))||[];
 return <section className="overflow-hidden rounded-2xl border border-blue-200/70 bg-card shadow-sm dark:border-blue-800/50" aria-label="Review student documents">
  <div className="flex flex-wrap items-start justify-between gap-2 border-b bg-gradient-to-r from-blue-50 to-white px-4 py-3 dark:from-blue-950/30 dark:to-background">
   <div><p className="flex items-center gap-2 text-sm font-extrabold"><FileCheck2 className="h-4 w-4 text-blue-600"/>Step 1 · Review documents</p>
    <p className="mt-1 text-xs text-muted-foreground">View uploaded files here, verify their status, then continue to email or WhatsApp.</p></div>
   <div className="flex items-center gap-2">
    {current?<Badge className="bg-emerald-600 text-white"><CheckCircle2 className="mr-1 h-3 w-3"/>Reviewed</Badge>:<Badge variant="outline">Review required</Badge>}
    <Button size="icon" variant="ghost" disabled={!!busy} onClick={()=>void load()} aria-label="Refresh documents"><RefreshCw className="h-4 w-4"/></Button>
   </div>
  </div>
  {error&&<div role="alert" className="m-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
   <AlertTriangle className="mr-1 inline h-4 w-4"/> {error}
   <Button size="sm" variant="outline" className="ml-2" onClick={()=>void load()}>Retry</Button>
  </div>}
  {busy==="loading"&&<p className="p-4 text-xs text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Checking submitted documents…</p>}
  {record&&<div className="space-y-3 p-3 sm:p-4">
   <div className="flex flex-wrap gap-2 text-[11px]">
    <Badge variant="secondary">{record.document_count} submitted</Badge>
    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">{verified} verified</Badge>
    <Badge variant="outline" className="border-amber-400/50 text-amber-700">{pending} awaiting review</Badge>
    {rejected>0&&<Badge variant="destructive">{rejected} rejected</Badge>}
   </div>
   {record.document_signal.missing.length>0&&<div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
    <p className="font-bold">Outstanding requirements ({record.document_signal.missing.length})</p>
    <p className="mt-1">{record.document_signal.missing.join(" · ")}</p>
   </div>}
   {!record.items.length?<div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm">
    <p className="font-semibold">No files uploaded yet</p><p className="mt-1 text-xs text-muted-foreground">You can review this empty checklist and send a missing-document request. No document is marked verified automatically.</p>
   </div>:<div className="space-y-2">
    {record.items.map(doc=><div key={doc.source+":"+doc.id} className="rounded-xl border p-3">
     <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1"><p className="break-words text-xs font-bold">{doc.name}</p>
       <p className="mt-1 text-[11px] text-muted-foreground">{readable(doc.type)} · {date(doc.uploaded_at)} · {doc.source==="global"?"Student document":"Application upload"}</p></div>
      <Badge variant={stateType(doc.status)==="rejected"?"destructive":stateType(doc.status)==="verified"?"default":"outline"}>{readable(doc.status)}</Badge>
     </div>
     {doc.rejection_reason&&stateType(doc.status)==="rejected"&&<p className="mt-2 text-xs text-red-700">{doc.rejection_reason}</p>}
     <div className="mt-2 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={!!busy||!doc.can_open} onClick={()=>void view(doc)}>
       <Eye className="h-3.5 w-3.5"/>View file</Button>
      {doc.can_verify&&stateType(doc.status)==="pending"&&<>
       <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={!!busy||!opened.has(doc.source+":"+doc.id)} onClick={()=>void decide(doc,"verified")}>
        <CheckCircle2 className="h-3.5 w-3.5"/>Verify</Button>
       <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={!!busy||!opened.has(doc.source+":"+doc.id)} onClick={()=>{setRejecting(doc.id);setReason("");}}>
        <XCircle className="h-3.5 w-3.5"/>Request correction</Button>
      </>}
      {!doc.can_verify&&<span className="self-center text-[11px] text-muted-foreground">Verification managed by admin</span>}
     </div>
     {rejecting===doc.id&&<div className="mt-3 space-y-2 rounded-xl border border-amber-300/60 bg-amber-50/30 p-3">
      <label className="text-xs font-semibold" htmlFor={"reason-"+doc.id}>Why does this file need correction?</label>
      <Input id={"reason-"+doc.id} value={reason} onChange={e=>setReason(e.target.value.slice(0,500))} placeholder="Specific correction needed (minimum 8 characters)"/>
      <div className="flex gap-2">
       <Button size="sm" variant="destructive" disabled={reason.trim().length<8||!!busy} onClick={()=>void decide(doc,"rejected")}>Record rejection</Button>
       <Button size="sm" variant="ghost" onClick={()=>setRejecting(null)}>Cancel</Button>
      </div>
     </div>}
    </div>)}
   </div>}
   {current?<div className="flex items-start gap-2 rounded-xl border border-emerald-400/40 bg-emerald-50/60 p-3 text-xs text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100">
    <CheckCircle2 className="h-4 w-4 shrink-0"/>Readiness reviewed. You can preview and send an accurate message for this case. A status or file change will require another review.
   </div>:<div className="space-y-2 rounded-xl border bg-muted/20 p-3">
    {unviewedPending.length>0&&<p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-200">Open {unviewedPending.length} pending uploaded {unviewedPending.length===1?"file":"files"} to inspect their contents before confirming readiness.</p>}
    <label className="flex cursor-pointer items-start gap-2 text-xs">
     <Checkbox checked={ack} onCheckedChange={v=>setAck(v===true)}/>
     <span>I reviewed this student's available uploads, document statuses and outstanding requirements. This acknowledgement does not approve the application or confirm funding.</span>
    </label>
    <Button className="w-full" size="sm" disabled={!ack||!!busy||unviewedPending.length>0} onClick={()=>void confirmReview()}>
     {busy==="review"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<ShieldCheck className="mr-2 h-4 w-4"/>Confirm document review · Continue
    </Button>
   </div>}
   <p className="text-[11px] text-muted-foreground">Private files use expiring 90-second previews. Never share these links or include student documents in outgoing messages.</p>
  </div>}
  <Dialog open={!!preview} onOpenChange={open=>{if(!open)setPreview(null);}}>
   <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
    <DialogHeader><DialogTitle className="break-words text-base">{preview?.name||"Private document"}</DialogTitle>
     <DialogDescription>Secure, temporary preview. Check the content before recording a verification decision.</DialogDescription></DialogHeader>
    {preview?.media==="image"?<img src={preview.url} alt={"Uploaded document "+preview.name} className="max-h-[70vh] w-full rounded-lg object-contain"/>:
     preview?.media==="pdf"?<iframe title={"Document preview: "+preview.name} sandbox="" referrerPolicy="no-referrer" src={preview.url} className="h-[65vh] w-full rounded-lg border bg-white"/>:
     <div className="rounded-lg border p-5 text-sm">This format cannot be shown inline. <a className="inline-flex items-center gap-1 font-semibold text-primary underline" href={preview?.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4"/>Open the secure file</a></div>}
   </DialogContent>
  </Dialog>
 </section>;
}
