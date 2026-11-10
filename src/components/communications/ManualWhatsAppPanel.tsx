import {useEffect,useState} from "react";
import {CheckCircle2,Copy,Download,ExternalLink,FileText,Image as ImageIcon,Loader2,MessageCircle,RefreshCw,ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {Textarea} from "@/components/ui/textarea";

type Kind="application"|"reservation"|"housing_lead"|"support_enquiry";
type ManualPreview={
 subject:string;message:string;template_name:string;recommended_template:string;preview_hash:string;
 case:{status:string;document_signal:{stage:string};label:string;reference:string};
 phone_hint:string|null;can_open:boolean;photo_url:string|null;handoff_note:string;
};
type LogItem={id:string;target_id:string;status:string;phone_last4:string;created_at:string;marked_sent_at:string|null};
type Props={
 kind:Kind;targetId:string;templateKey:string;note:string;
 invoke:(body:Record<string,unknown>)=>Promise<any>;
 onActivityChange?:()=>void;
 reviewId?:string|null;
 needsReview?:boolean;
};
const blobDownload=(base64:string,mime:string,filename:string)=>{
 const raw=atob(base64),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 const objectUrl=URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer],{type:mime}));
 const link=document.createElement("a");link.href=objectUrl;link.download=filename;link.click();
 window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30_000);
};
export default function ManualWhatsAppPanel({kind,targetId,templateKey,note,invoke,onActivityChange,reviewId,needsReview=false}:Props){
 const [preview,setPreview]=useState<ManualPreview|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const [working,setWorking]=useState<string|null>(null);
 const [handoffId,setHandoffId]=useState<string|null>(null);
 const [history,setHistory]=useState<LogItem[]>([]);
 const [copied,setCopied]=useState(false);
 useEffect(()=>{setPreview(null);setHandoffId(null);setConfirmed(false);setCopied(false);},[kind,targetId,templateKey,note]);
 const loadHistory=async()=>{
  try{const result=await invoke({action:"whatsapp_history"});setHistory(result.items||[]);}
  catch(e){console.warn("WhatsApp handoff history unavailable",e);}
 };
 useEffect(()=>{void loadHistory();},[targetId,kind]);
 const showErr=(e:unknown)=>toast.error(e instanceof Error?e.message:"Could not prepare WhatsApp");
 const generate=async()=>{
  if(!targetId)return toast.error("Choose an applicant or reservation first");
  setWorking("preview");setConfirmed(false);setHandoffId(null);
  try{const result=await invoke({action:"whatsapp_preview",kind,target_id:targetId,template_key:templateKey,message:note});
   setPreview(result);setCopied(false);}
  catch(e){showErr(e);}finally{setWorking(null);}
 };
 const copy=async()=>{
  if(!preview)return;
  try{await navigator.clipboard.writeText(preview.message);setCopied(true);toast.success("Personalized WhatsApp template copied");}
  catch{toast.info("Select the message text below and copy it manually");}
 };
 const openWhatsApp=async()=>{
  if(!preview?.can_open||!confirmed)return;
  if(needsReview&&!reviewId)return toast.error("Review the uploaded documents before opening WhatsApp");
  const popup=window.open("about:blank","_blank");
  if(popup)popup.opener=null;
  setWorking("open");
  try{
   const result=await invoke({action:"whatsapp_handoff",kind,target_id:targetId,template_key:templateKey,
    message:note,expected_status:preview.case.status,expected_document_stage:preview.case.document_signal.stage,
    preview_hash:preview.preview_hash,request_id:crypto.randomUUID(),operator_confirmed:true,document_review_id:reviewId||null});
   setHandoffId(result.handoff_id);onActivityChange?.();
   if(popup)popup.location.replace(result.url);else window.location.assign(result.url);
   void loadHistory();
   toast.info("WhatsApp opened with a draft. Press Send in WhatsApp Business; attach files manually.");
  }catch(e){if(popup)popup.close();showErr(e);}
  finally{setWorking(null);}
 };
 const markSent=async()=>{
  if(!handoffId||!window.confirm("Have you actually pressed Send in WhatsApp Business? This is an operator-reported status, not a delivery receipt."))return;
  setWorking("mark");
  try{await invoke({action:"whatsapp_mark_sent",handoff_id:handoffId,operator_confirmed:true});
   toast.success("Manual WhatsApp handoff marked sent by operator");setHandoffId(null);void loadHistory();onActivityChange?.();}
  catch(e){showErr(e);}finally{setWorking(null);}
 };
 const download=async(format:"pdf"|"image")=>{
  if(!targetId)return;
  setWorking(format);
  try{
   const data=await invoke(format==="pdf"
    ?{action:"pdf_preview",kind,target_id:targetId,template_key:templateKey,message:note}
    :{action:"residence_photo_download",kind,target_id:targetId});
   blobDownload(data.base64,format==="pdf"?"application/pdf":data.content_type,data.filename);
   toast.success(format==="pdf"?"Official case PDF downloaded":"Real residence photo downloaded");
  }catch(e){showErr(e);}finally{setWorking(null);}
 };
 const caseHistory=history.filter(h=>h.target_id===targetId).slice(0,6);
 return <div className="space-y-4">
  <div className="rounded-xl border bg-card p-4">
   <div className="flex items-center gap-2">
    <MessageCircle className="h-5 w-5 text-emerald-600"/>
    <p className="font-bold">WhatsApp Business · Manual smart handoff</p>
   </div>
   <p className="mt-1 text-xs text-muted-foreground">Same recorded decisions, document requirements and personalized template as the email/PDF. No WhatsApp API, bot or automatic sending required.</p>
   <div className="mt-3 flex flex-wrap gap-2">
    <Badge variant="outline">Business App / Web</Badge>
    <Badge variant="outline">Manual Send</Badge>
    <Badge variant="outline">Case-verified</Badge>
   </div>
   <Button className="mt-4 w-full" variant="secondary" disabled={!targetId||!!working} onClick={()=>void generate()}>
    {working==="preview"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<RefreshCw className="mr-2 h-4 w-4"/>}
    Generate WhatsApp confirmation
   </Button>
  </div>
  {preview?<div className="space-y-3">
   <div className="rounded-xl border bg-card p-4">
    <p className="text-xs font-bold text-muted-foreground">APPLICANT · {preview.case.label} · REF {preview.case.reference}</p>
    <p className="mt-1 text-xs text-muted-foreground">WhatsApp contact: {preview.phone_hint||"No valid phone number recorded"}</p>
    <p className="mt-2 text-sm font-semibold">{preview.subject}</p>
    <div className="mt-3 flex items-center justify-between">
     <Badge variant="secondary">{preview.template_name}</Badge>
     <Button size="sm" variant="outline" onClick={()=>void copy()}><Copy className="mr-1.5 h-3.5 w-3.5"/>{copied?"Copied":"Copy"}</Button>
    </div>
    <Textarea readOnly aria-label="Prefilled WhatsApp message" value={preview.message} rows={13} className="mt-3 whitespace-pre-wrap font-sans text-xs leading-6"/>
    <p className="mt-2 text-xs text-muted-foreground">Edit the additional note in the Case Intelligence pane, then regenerate this preview to keep both channels consistent.</p>
   </div>
   {preview.photo_url?<div className="overflow-hidden rounded-xl border bg-card">
     <img src={preview.photo_url} alt="Actual published residence listing" className="max-h-48 w-full object-cover"/>
     <p className="px-3 py-2 text-xs text-muted-foreground">Real residence photo from the ResKonnect listing; manually attach it in WhatsApp Business.</p>
    </div>:<p className="rounded-lg border p-3 text-xs text-muted-foreground">This residence has no approved public listing photo yet; the confirmation still uses the branded ResKonnect text and PDF.</p>}
   <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    <Button variant="outline" disabled={!!working} onClick={()=>void download("pdf")}><FileText className="mr-2 h-4 w-4"/>Download case PDF</Button>
    <Button variant="outline" disabled={!!working||!preview.photo_url} onClick={()=>void download("image")}><ImageIcon className="mr-2 h-4 w-4"/>Download residence photo</Button>
   </div>
   <label className="flex cursor-pointer items-start gap-2 rounded-xl border bg-card p-3 text-xs">
    <Checkbox checked={confirmed} onCheckedChange={value=>setConfirmed(value===true)}/>
    <span>I reviewed the applicant, recorded case status, outstanding documents and message. I will manually send this as an official service communication using WhatsApp Business.</span>
   </label>
   <Button className="w-full bg-emerald-700 text-white hover:bg-emerald-800" disabled={!preview.can_open||!confirmed||!!working||(needsReview&&!reviewId)} onClick={()=>void openWhatsApp()}>
    {working==="open"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<ExternalLink className="mr-2 h-4 w-4"/>}
    Open prefilled WhatsApp Business chat
   </Button>
   {!preview.can_open&&<p className="text-xs text-amber-700">Cannot open WhatsApp without a valid applicant phone and permission to contact them.</p>}
   {handoffId&&<div className="space-y-2 rounded-xl border border-emerald-700/20 bg-emerald-600/5 p-3">
    <p className="text-sm font-semibold">WhatsApp chat opened — did you press Send?</p>
    <p className="text-xs text-muted-foreground">The draft is not sent by ResKonnect. Attach the downloaded photo/PDF if needed, press Send in WhatsApp, then optionally record your manual action here.</p>
    <Button variant="outline" disabled={!!working} onClick={()=>void markSent()}><CheckCircle2 className="mr-2 h-4 w-4"/>Mark sent by me</Button>
   </div>}
  </div>:<div className="rounded-xl border border-dashed p-6 text-center">
   <MessageCircle className="mx-auto h-9 w-9 text-muted-foreground"/>
   <p className="mt-2 text-sm font-semibold">One applicant, one smart WhatsApp draft</p>
   <p className="mt-1 text-xs text-muted-foreground">Choose an applicant from the dock inbox and generate a verified confirmation. No copy-pasting details by hand.</p>
  </div>}
  <div className="rounded-xl border bg-card p-3">
   <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="h-4 w-4"/>Manual handoff tracking</div>
   {caseHistory.length?caseHistory.map(h=><div key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-xs">
    <span>{new Date(h.created_at).toLocaleString("en-ZA")} · ••••{h.phone_last4}</span>
    <Badge variant={h.status==="operator_marked_sent"?"secondary":"outline"}>{h.status==="operator_marked_sent"?"Operator marked sent":"Chat opened only"}</Badge>
   </div>):<p className="text-xs text-muted-foreground">No manually opened WhatsApp conversations for this case.</p>}
   <p className="mt-2 text-xs text-muted-foreground">These are operator actions, not WhatsApp delivery or read receipts.</p>
  </div>
 </div>;
}
