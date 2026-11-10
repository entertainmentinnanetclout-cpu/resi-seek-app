import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useSearchParams} from "react-router-dom";
import {AlertTriangle,CheckCircle2,CheckCheck,ChevronRight,Clock3,Download,FileCheck2,FileText,Inbox,Layers,Loader2,Mail,MailCheck,MessageCircle,Paperclip,RefreshCw,Search,Send,Settings2,ShieldCheck,Sparkles,Unplug,Users,WalletCards,LayoutList,SlidersHorizontal,ArrowUpDown} from "lucide-react";
import ManualWhatsAppPanel from "./ManualWhatsAppPanel";
import DocumentReviewPanel,{type DocumentReviewReceipt} from "./DocumentReviewPanel";
import ContactActivityDashboard from "./ContactActivityDashboard";
import LandlordGmailGuide from "./LandlordGmailGuide";
import {supabase} from "@/integrations/supabase/client";
import {toast} from "sonner";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Textarea} from "@/components/ui/textarea";
import {cn} from "@/lib/utils";

type Kind="application"|"reservation"|"housing_lead"|"support_enquiry";
type Template="smart"|"acknowledgement"|"documents_needed"|"documents_received"|"approved"|"rejected"|"conditionally_approved"|"status_update"|"feedback"|"next_steps"|"enquiry_response"|"viewing_invite"|"follow_up"|"reservation_confirmed"|"move_in_arrangements";
type Mode="admin"|"landlord";
type Signal={stage:string;missing:string[];uploaded:number;pendingReview:number;summary:string};
type CaseItem={
 id:string;kind:Kind;label:string;status:string;property:string;reference:string;
 created_at:string;document_stage:string;missing_count:number;pending_review:number;uploaded_count?:number;
 recommended_template:Template;recipient_hint:string|null;can_email:boolean;
 workflow_bucket?:string;service_action?:string;last_email_at?:string|null;last_email_template?:string|null;
 email_sent?:boolean;email_status?:string|null;student_uploaded_after_email?:boolean;
 suggested_template?:Template;academic_year?:string;
};
type CaseInfo={
 id:string;kind:Kind;label:string;status:string;property:string;reference:string;
 document_signal:Signal;recommended_template:Template;recipient_hint:string|null;can_email:boolean;academic_year:string;
 residence_image_url?:string|null;has_whatsapp?:boolean;
};
type EmailPreview={subject:string;body:string;html:string;template_name:string;resolved_key:Template;case:CaseInfo;pdf_attached:boolean;preview_hash:string};
type DocTemplate={name:string;subject:string;body:string};
type Override={target_kind:Kind;template_key:Template;subject_template:string;body_template:string};
type History={id:string;subject:string;target_kind:Kind;template_key:string;delivery_status:string;recipient_email:string;created_at:string;failure_code:string|null;pdf_attached:boolean};
type BulkResult={id:string;ok?:boolean;updated?:boolean;sent?:boolean;label?:string;status?:string;from?:string;to?:string;reason?:string;error?:string;subject?:string;body?:string;resolved_key?:Template;document_signal?:Signal;preview_hash?:string};
const kindLabels:Record<Kind,string>={application:"Applications",reservation:"Reservations",housing_lead:"Housing enquiries",support_enquiry:"Support enquiries"};
const statusOptions:Record<"application"|"reservation",string[]>={
 application:["submitted","under_review","documents_required","conditionally_approved","approved","rejected","withdrawn"],
 reservation:["reserved","contacted","provisional_hold","confirmed","cancelled"]
};
const pretty=(v:string)=>v.replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase());
const signalStyle=(stage:string)=>stage==="missing"||stage==="incomplete"?"text-amber-700 dark:text-amber-400":stage==="received"?"text-blue-700 dark:text-blue-400":"text-emerald-700 dark:text-emerald-400";
async function extractError(error:any):Promise<string>{
 const response=error?.context;
 try {
  const body=await (typeof response?.clone==="function"?response.clone():response)?.json?.();
  if(typeof body?.error==="string")return body.error;
 }catch{/* The failed response may be empty, non-JSON or blocked by CORS. */}
 const code=Number(response?.status||0);
 if(code===401)return "Your session has expired. Sign in again to access the Email Dock.";
 if(code===403)return "Your account does not have permission for this email queue.";
 if(code===503||code===502)return "ResKonnect Email Dock is temporarily unavailable (server "+code+"). Please retry.";
 if(error?.name==="FunctionsFetchError"||/Failed to send a request to the Edge Function/i.test(String(error?.message||"")))return "Cannot connect to the Email Dock service. Check your connection and retry. If it persists, report an Edge Function outage.";
 return error?.message||"Unable to complete email operation";
}

export default function PremiumEmailDock({mode}:{mode:Mode}){
 const [params,setParams]=useSearchParams();
 const initialKind=(Object.keys(kindLabels) as Kind[]).find(k=>params.get("kind")===k) || "application";
 const [kind,setKind]=useState<Kind>(mode==="landlord"&&initialKind==="support_enquiry"?"application":initialKind);
 const [items,setItems]=useState<CaseItem[]>([]);
 const [academicYear,setAcademicYear]=useState(initialKind==="reservation"?"2027":params.get("year")==="2027"?"2027":"2026");
 const [totalCases,setTotalCases]=useState(0);
 const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [loadingMore,setLoadingMore]=useState(false);
 const [selected,setSelected]=useState(params.get("target")||"");
 const [checked,setChecked]=useState<Set<string>>(new Set());
 const [search,setSearch]=useState("");
 const [workspace,setWorkspace]=useState<"cases"|"activity">(params.get("view")==="activity"?"activity":"cases");
 const [advancedFilters,setAdvancedFilters]=useState(false);
 const [sortBy,setSortBy]=useState<"newest"|"oldest"|"needs_action">("needs_action");
 const [filter,setFilter]=useState<"all"|"missing"|"received"|"decision"|"not_contacted"|"followup_due"|"student_acted"|"awaiting_review"|"decision_changed"|"approved"|"rejected"|"uploaded"|"no_uploads"|"submitted"|"under_review"|"reserved"|"confirmed">("all");
 const [caseInfo,setCaseInfo]=useState<CaseInfo|null>(null);
 const [template,setTemplate]=useState<Template>("smart");
 const [note,setNote]=useState("");
 const [preview,setPreview]=useState<EmailPreview|null>(null);
 const [approved,setApproved]=useState(false);
 const [connection,setConnection]=useState<{connected:boolean;email:string|null}|null>(null);
 const [connectedError,setConnectedError]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [loading,setLoading]=useState(false);
 const [queueError,setQueueError]=useState("");
 const loadedQueueKeyRef=useRef("");
 const [history,setHistory]=useState<History[]>([]);
 const [activityRevision,setActivityRevision]=useState(0);
 const [reviewReceipts,setReviewReceipts]=useState<Map<string,DocumentReviewReceipt>>(()=>new Map());
 const [defaults,setDefaults]=useState<Record<string,DocTemplate>>({});
 const [overrides,setOverrides]=useState<Override[]>([]);
 const [placeholders,setPlaceholders]=useState<string[]>([]);
 const [studioKey,setStudioKey]=useState<Template>("documents_needed");
 const [studioSubject,setStudioSubject]=useState("");
 const [studioBody,setStudioBody]=useState("");
 const [pane,setPane]=useState<"documents"|"compose"|"whatsapp"|"bulk"|"templates"|"history">(params.get("channel")==="whatsapp"?"whatsapp":(initialKind==="application"||initialKind==="reservation")?"documents":"compose");
 const [bulkPreview,setBulkPreview]=useState<BulkResult[]>([]);
 const [bulkApproval,setBulkApproval]=useState(false);
 const [newStatus,setNewStatus]=useState("");
 const [statusNote,setStatusNote]=useState("");
 const [statusPreview,setStatusPreview]=useState<BulkResult[]>([]);
 const [statusApproved,setStatusApproved]=useState(false);
 const [batchSummary,setBatchSummary]=useState<{ok:number;failed:number}|null>(null);
 const lastPreviewRef=useRef("");
 const deepLinkedIdRef=useRef(params.get("target"));
 const invoke=useCallback(async(fn:string,body:Record<string,unknown>)=>{
  const {data,error}=await supabase.functions.invoke(fn,{body});
  if(error)throw new Error(await extractError(error));
  if(data?.error)throw new Error(data.error);
  return data;
 },[]);
 const premium=useCallback((body:Record<string,unknown>)=>invoke("reskonnect-email-dock",body),[invoke]);
 const loadConnection=useCallback(async()=>{
  try{
   const c=await invoke("gmail-connect",{action:"status"});
   setConnection({connected:!!c.connected,email:c.email||null});setConnectedError("");
  }catch(e){setConnectedError(e instanceof Error?e.message:"Gmail status unavailable");}
 },[invoke]);
 const loadHistory=useCallback(async()=>{
  try{const r=await premium({action:"history"});setHistory(r.items||[]);}catch(e){console.warn("History unavailable",e);}
 },[premium]);
 const loadTemplates=useCallback(async()=>{
  try{const r=await premium({action:"templates"});setDefaults(r.defaults||{});setOverrides(r.overrides||[]);setPlaceholders(r.placeholders||[]);}
  catch(e){console.warn("Template catalogue unavailable",e);}
 },[premium]);
 const loadItems=useCallback(async({preserveLoaded=false}:{preserveLoaded?:boolean}={})=>{
  if(!preserveLoaded)setLoading(true);
  try{
   const r=await premium({action:"list",kind,academic_year:Number(academicYear),offset:0,highlight_id:deepLinkedIdRef.current});
   const next=(r.items||[]) as CaseItem[];
   setItems(previous=>{
    if(!preserveLoaded||previous.length<=next.length)return next;
    const seen=new Set(next.map(item=>item.id));
    return [...next,...previous.filter(item=>!seen.has(item.id))];
   });
   setTotalCases(Number(r.total||0));
   setQueueError("");
   loadedQueueKeyRef.current=kind+":"+academicYear;
   setNextOffset(current=>preserveLoaded?current:(r.has_more?Number(r.next_offset):null));
   setSelected(old=>old||next[0]?.id||"");
  }catch(e){
   const message=e instanceof Error?e.message:"Email cases could not load";
   setQueueError(message);
   if(!preserveLoaded){
    if(loadedQueueKeyRef.current!==kind+":"+academicYear){
     setItems([]);setTotalCases(0);setNextOffset(null);setCaseInfo(null);
    }
    toast.error("Email Dock unavailable — use Retry to reload the queue");
   }
  }
  finally{if(!preserveLoaded)setLoading(false);}
 },[premium,kind,academicYear]);
 const loadRemaining=async(all=false)=>{
  if(nextOffset===null||loadingMore)return;
  const queueKey=kind+":"+academicYear;
  if(loadedQueueKeyRef.current!==queueKey)return;
  setLoadingMore(true);
  try{
   let offset=nextOffset,pages=0;
   const appended:CaseItem[]=[];
   while(offset!==null){
    const result=await premium({action:"list",kind,academic_year:Number(academicYear),offset});
    appended.push(...((result.items||[]) as CaseItem[]));
    setTotalCases(Number(result.total||0));
    offset=result.has_more?Number(result.next_offset):null;
    pages++;
    if(!all||pages>=75)break;
   }
   if(loadedQueueKeyRef.current!==queueKey)return;
   setItems(current=>{
    const seen=new Set(current.map(i=>i.id));
    return [...current,...appended.filter(i=>{if(seen.has(i.id))return false;seen.add(i.id);return true;})];
   });
   setNextOffset(offset);
   if(all&&offset!==null)toast.info("Loaded another 7,500 records. Continue loading to see the remaining cases.");
  }catch(e){showError(e);}
  finally{setLoadingMore(false);}
 };
 const loadCase=useCallback(async()=>{
  if(!selected){setCaseInfo(null);return;}
  try{
   const r=await premium({action:"case",kind,target_id:selected});
   setCaseInfo(r.case||null);
  }catch(e){setCaseInfo(null);console.warn("Case unavailable",e);}
 },[premium,kind,selected]);
 useEffect(()=>{void loadConnection();void loadHistory();void loadTemplates();},[loadConnection,loadHistory,loadTemplates]);
 useEffect(()=>{void loadItems();setChecked(new Set());},[loadItems]);
 useEffect(()=>{const interval=window.setInterval(()=>{if(document.visibilityState==="visible")void loadItems({preserveLoaded:true});},45000);return ()=>window.clearInterval(interval);},[loadItems]);
 useEffect(()=>{
  // Typical residence queues fit into a few pages. Load them automatically so
  // searching or filtering doesn't silently hide students outside page one.
  if(workspace!=="cases"||totalCases===0||totalCases>600||nextOffset===null||
     loading||loadingMore||queueError||loadedQueueKeyRef.current!==kind+":"+academicYear)return;
  void loadRemaining(true);
 // loadRemaining is intentionally invoked only for the current case/year snapshot.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[workspace,kind,academicYear,totalCases,nextOffset,loading,loadingMore,queueError]);

 useEffect(()=>{void loadCase();setPreview(null);setApproved(false);},[loadCase]);
 useEffect(()=>{
  if(params.get("gmail")==="connected"){
   toast.success("Google account connected to ResKonnect");
   const next=new URLSearchParams(params);next.delete("gmail");setParams(next,{replace:true});
   void loadConnection();
  }
 },[params,setParams,loadConnection]);
 const active=items.find(x=>x.id===selected)||null;
 const needsReview=kind==="application"||kind==="reservation";
 const selectedReceipt=reviewReceipts.get(kind+":"+selected)||null;
 const reviewedNow=!needsReview||!!selectedReceipt&&Date.now()-new Date(selectedReceipt.at).getTime()<20*60*1000;
 const reviewReceiptFor=(id:string)=>reviewReceipts.get(kind+":"+id)||null;
 const visible=useMemo(()=>items.filter(x=>{
  const match=(x.label+" "+x.status+" "+x.property+" "+x.reference).toLowerCase().includes(search.toLowerCase().trim());
  if(!match)return false;
  if(filter==="missing")return x.missing_count>0;
  if(["submitted","under_review","reserved","confirmed"].includes(filter))return x.status===filter;
  if(filter==="uploaded")return (x.uploaded_count||0)>0;
  if(filter==="no_uploads")return (x.uploaded_count||0)===0;
  if(filter==="received")return x.pending_review>0||x.document_stage==="received";
  if(filter==="decision")return ["approved","conditionally_approved","rejected","confirmed","cancelled"].includes(x.status);
  if(filter==="not_contacted")return !x.email_sent;
  if(filter!=="all")return x.workflow_bucket===filter;
  return true;
 }).sort((a,b)=>{
  if(sortBy==="oldest")return a.created_at.localeCompare(b.created_at);
  if(sortBy==="newest")return b.created_at.localeCompare(a.created_at);
  const priority=(item:CaseItem)=>{
   if(item.workflow_bucket==="decision_changed"||item.workflow_bucket==="student_acted")return 0;
   if(item.pending_review>0||item.workflow_bucket==="awaiting_review")return 1;
   if(item.workflow_bucket==="followup_due")return 2;
   if(item.missing_count>0&&!item.email_sent)return 3;
   if(!item.email_sent)return 4;
   if(["approved","confirmed"].includes(item.status))return 7;
   return 5;
  };
  return priority(a)-priority(b)||b.created_at.localeCompare(a.created_at);
 }),[items,filter,search,sortBy]);
 const queueStats=useMemo(()=>({
  uploaded:items.filter(x=>(x.uploaded_count||0)>0).length,
  missing:items.filter(x=>x.missing_count>0).length,
  review:items.filter(x=>x.pending_review>0||x.document_stage==="received").length,
  unemailed:items.filter(x=>!x.email_sent).length,
  followup:items.filter(x=>x.workflow_bucket==="followup_due").length,
  submitted:items.filter(x=>x.status==="submitted").length,
  underReview:items.filter(x=>x.status==="under_review").length,
  reserved:items.filter(x=>x.status==="reserved").length,
  confirmed:items.filter(x=>x.status==="confirmed").length
 }),[items]);
 const templatesForKind=useMemo(()=>{
  const base:(Template)[]=["smart","acknowledgement","documents_needed","documents_received","status_update","feedback","next_steps","follow_up"];
  if(kind==="application")base.push("approved","rejected","conditionally_approved");
  if(kind==="reservation")base.push("reservation_confirmed","viewing_invite","move_in_arrangements");
  if(kind==="housing_lead")base.push("viewing_invite","enquiry_response");
  if(kind==="support_enquiry")base.push("enquiry_response");
  return [...new Set(base)];
 },[kind]);
 const availableStudio:Template[]=templatesForKind.filter(x=>x!=="smart");
 const selectedCount=checked.size;
 const resetPreview=()=>{setPreview(null);setApproved(false);setBulkPreview([]);setBulkApproval(false);setStatusPreview([]);setStatusApproved(false);setBatchSummary(null);};
 const selectKind=(k:Kind)=>{
  setKind(k);setWorkspace("cases");setAcademicYear(k==="reservation"?"2027":"2026");setSearch("");setFilter("all");setSelected("");setTemplate("smart");setChecked(new Set());setNote("");setPane(k==="application"||k==="reservation"?"documents":"compose");resetPreview();
  const next=new URLSearchParams(params);next.set("kind",k);next.delete("target");next.delete("view");setParams(next,{replace:true});
 };
 const selectRecord=(id:string)=>{
  setSelected(id);setTemplate(items.find(x=>x.id===id)?.suggested_template||"smart");setNote("");resetPreview();
  setPane(needsReview?"documents":"compose");
  const next=new URLSearchParams(params);next.set("kind",kind);next.set("target",id);next.delete("view");setParams(next,{replace:true});
  if(window.innerWidth<1024)window.requestAnimationFrame(()=>document.getElementById("rk-case-detail-panel")?.scrollIntoView({behavior:"smooth",block:"start"}));
 };
 const toggleSelected=(id:string,checkedNow:boolean)=>{
  setChecked(old=>{const next=new Set(old);if(checkedNow)next.add(id);else next.delete(id);return next;});
  setBulkPreview([]);setStatusPreview([]);setBulkApproval(false);setStatusApproved(false);
 };
 const showError=(e:unknown)=>toast.error(e instanceof Error?e.message:"Email operation failed");
 const connectionAction=async(action:"connect"|"disconnect")=>{
  if(action==="disconnect"&&!window.confirm("Disconnect the selected Gmail account? The audit history remains available."))return;
  setBusy(action);
  try{
   const r=await invoke("gmail-connect",{action});
   if(action==="connect"){
    if(!String(r.authorization_url||"").startsWith("https://accounts.google.com/"))throw Error("Google authorization URL unavailable");
    window.location.assign(r.authorization_url);
   }else{
    toast.success("Gmail disconnected");
    setConnection({connected:false,email:null});resetPreview();
   }
  }catch(e){showError(e);}finally{setBusy(null);}
 };
 const previewOne=async()=>{
  if(!selected)return toast.error("Select a case first");
  setBusy("preview");setPreview(null);setApproved(false);
  try{
   const r=await premium({action:"preview",kind,target_id:selected,template_key:template,message:note});
   setPreview(r as EmailPreview);lastPreviewRef.current=selected+":"+template+":"+note;
   setPane("compose");
  }catch(e){showError(e);}finally{setBusy(null);}
 };
 const downloadPdf=async()=>{
  if(!selected)return;
  setBusy("pdf");
  try{
   const doc=await premium({action:"pdf_preview",kind,target_id:selected,template_key:template,message:note});
   const binary=atob(doc.base64);
   const out=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
   const url=URL.createObjectURL(new Blob([out.buffer as ArrayBuffer],{type:"application/pdf"}));
   const element=document.createElement("a");element.href=url;element.download=doc.filename||"ResKonnect-Letter.pdf";
   element.click();window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
  }catch(e){showError(e);}finally{setBusy(null);}
 };
 const sendOne=async()=>{
  if(!preview||!selected||!approved||!connection?.connected)return;
  if(needsReview&&!reviewedNow)return toast.error("Review this student’s documents before sending");
  if(lastPreviewRef.current!==selected+":"+template+":"+note)return toast.error("Refresh your preview before sending");
  if(!window.confirm("Send this official ResKonnect email and branded PDF using your connected Gmail?"))return;
  setBusy("send");
  try{
   const result=await premium({action:"send",kind,target_id:selected,template_key:template,
    message:note,confirmed:true,request_id:crypto.randomUUID(),expected_status:preview.case.status,expected_document_stage:preview.case.document_signal.stage,preview_hash:preview.preview_hash,document_review_id:selectedReceipt?.id||null});
   if(!result.sent)throw Error(result.error||"Gmail did not accept the message");
   toast.success("Gmail accepted your email and branded PDF attachment");
   resetPreview();setNote("");
   await Promise.all([loadHistory(),loadItems(),loadConnection()]);setActivityRevision(v=>v+1);
  }catch(e){showError(e);}finally{setBusy(null);}
 };
 const previewBulk=async()=>{
  const ids=[...checked];
  if(!ids.length)return toast.error("Select cases from the inbox");
  setBusy("bulk-preview");setBulkPreview([]);setBulkApproval(false);setBatchSummary(null);
  try{
   const response=await premium({action:"bulk_preview",kind,ids,template_key:"smart",message:note});
   setBulkPreview(response.items||[]);
   toast.info((response.eligible||0)+" of "+ids.length+" cases eligible");
  }catch(e){showError(e);}finally{setBusy(null);}
 };
 const sendBulk=async()=>{
  if(!connection?.connected||!bulkApproval||!bulkPreview.length)return;
  if(needsReview&&bulkPreview.filter(x=>x.ok).some(x=>!reviewReceiptFor(x.id)))return toast.error("Review every selected student’s documents before a bulk send");
  const ids=bulkPreview.filter(x=>x.ok).map(x=>x.id);
  if(!ids.length)return toast.error("No eligible case emails");
  if(!window.confirm("Send "+ids.length+" individualized Gmail messages, each with its own ResKonnect PDF?"))return;
  setBusy("bulk-send");let ok=0,failed=0;
  const batchId=crypto.randomUUID();
  try{
   for(let i=0;i<ids.length;i+=5){
    const slice=ids.slice(i,i+5);
    const requests=slice.map(id=>{const info=bulkPreview.find(p=>p.id===id);return {id,request_id:crypto.randomUUID(),expected_status:info?.status,expected_document_stage:info?.document_signal?.stage,preview_hash:info?.preview_hash,document_review_id:reviewReceiptFor(id)?.id||null};});
    const response=await premium({action:"bulk_send",kind,ids:slice,requests,confirmed:true,
     batch_id:batchId,template_key:"smart",message:note});
    ok+=response.succeeded||0;failed+=response.failed||0;
    setBatchSummary({ok,failed});
   }
   toast.success(ok+" messages accepted by Gmail"+(failed?", "+failed+" not sent":""));
   setBulkPreview([]);setBulkApproval(false);setChecked(new Set());
   await Promise.all([loadHistory(),loadItems()]);setActivityRevision(v=>v+1);
  }catch(e){showError(e);setBatchSummary({ok,failed});}
  finally{setBusy(null);}
 };
 const previewStatuses=async()=>{
  const ids=[...checked];
  if(!ids.length)return toast.error("Select application or reservation records");
  if(!newStatus)return toast.error("Choose the requested new status");
  setBusy("status-preview");setStatusPreview([]);setStatusApproved(false);
  try{
   const response=await premium({action:"bulk_status_preview",kind,ids,new_status:newStatus,status_note:statusNote});
   setStatusPreview(response.items||[]);
  }catch(e){showError(e);}finally{setBusy(null);}
 };
 const applyStatuses=async()=>{
  if(!statusApproved||!statusPreview.length)return;
  const eligible=statusPreview.filter(x=>x.ok);
  if(!eligible.length)return;
  if(!window.confirm("Update "+eligible.length+" recorded case statuses? This will notify students in ResKonnect, but it will not send emails."))return;
  setBusy("status-apply");
  try{
   const ids=eligible.map(x=>x.id);
   const expected=Object.fromEntries(eligible.map(x=>[x.id,x.from]));
   const response=await premium({action:"bulk_status_apply",kind,ids,new_status:newStatus,status_note:statusNote,
    expected_statuses:expected,operation_id:crypto.randomUUID(),confirmed:true});
   toast.success((response.updated||0)+" statuses updated"+(response.failed?" · "+response.failed+" skipped":""));
   const updatedIds=(response.results||[]).filter((r:{updated:boolean})=>r.updated).map((r:{id:string})=>r.id);
   setStatusPreview([]);setStatusApproved(false);setChecked(new Set(updatedIds));
   setTemplate("smart");setNote("");setBulkPreview([]);setBulkApproval(false);
   await Promise.all([loadItems(),loadCase(),loadHistory()]);setActivityRevision(v=>v+1);
   if(updatedIds.length)toast.info("Updated records remain selected. Review smart emails before sending their decisions.");
  }catch(e){showError(e);}finally{setBusy(null);}
 };
 const stored=overrides.find(x=>x.target_kind===kind&&x.template_key===studioKey);
 const selectStudio=(key:Template)=>{
  setStudioKey(key);
  const item=overrides.find(x=>x.target_kind===kind&&x.template_key===key);
  setStudioSubject(item?.subject_template||defaults[key]?.subject||"");
  setStudioBody(item?.body_template||defaults[key]?.body||"");
 };
 useEffect(()=>{
  const key=availableStudio.includes(studioKey)?studioKey:availableStudio[0];
  const override=overrides.find(x=>x.target_kind===kind&&x.template_key===key);
  setStudioKey(key);
  setStudioSubject(override?.subject_template||defaults[key]?.subject||"");
  setStudioBody(override?.body_template||defaults[key]?.body||"");
 // Update editor when the category or saved catalogue changes, not on keystrokes.
 },[kind,defaults,overrides]);
 const saveStudio=async(reset:boolean)=>{
  setBusy("template");
  try{
   const request=reset?{action:"reset_template",kind,template_key:studioKey}:
    {action:"save_template",kind,template_key:studioKey,subject_template:studioSubject,body_template:studioBody};
   await premium(request);await loadTemplates();toast.success(reset?"Template reset to ResKonnect default":"Template saved for your sending account");resetPreview();
  }catch(e){showError(e);}finally{setBusy(null);}
 };
 const formattedSignal=(x:string)=>x==="not_applicable"?"No document check":pretty(x);
 const messageCard=(message:BulkResult)=> <div key={message.id} className="flex items-start justify-between gap-2 rounded-xl border p-3">
   <div className="min-w-0"><p className="text-sm font-semibold">{message.label||message.id.slice(0,8)}</p>
     <p className="text-xs text-muted-foreground">{message.subject||((message.from||"")+" → "+(message.to||""))}</p>{message.body&&<details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-primary">Read personalized email</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2 font-sans text-xs">{message.body}</pre></details>}
     {message.document_signal?.missing?.length>0&&<p className="mt-2 text-xs text-muted-foreground">Missing: {message.document_signal.missing.join(", ")}</p>}
     {!message.ok&&<p className="mt-1 text-xs text-amber-700">{message.reason||message.error||"Not eligible"}</p>}</div>
   <Badge variant={message.ok?"secondary":"outline"}>{message.ok?"Ready":"Review"}</Badge>
  </div>;
 return <div className="space-y-4">
  <div className="overflow-visible rounded-2xl border bg-card shadow-sm">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-950 px-5 py-4 text-white">
    <div className="flex items-center gap-3">
     <div className="rounded-xl bg-blue-600 p-2.5"><MailCheck className="h-6 w-6"/></div>
     <div><p className="text-xs font-bold uppercase tracking-[.19em] text-amber-300">ResKonnect Communications OS</p>
       <h2 className="text-xl font-black">Student communications</h2>
       <p className="text-xs text-slate-300">Manage applications, reservations and next steps</p></div>
    </div>
    <div className="flex items-center gap-2">
     <Badge className="border-white/20 bg-white/10 text-white">{connection?.connected?"Gmail connected":"Gmail not connected"}</Badge>
     <Button size="sm" variant="secondary" onClick={()=>void loadConnection()}><RefreshCw className="h-4 w-4"/></Button>
     {connection?.connected?<Button size="sm" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={()=>void connectionAction("disconnect")} disabled={!!busy}><Unplug className="mr-1.5 h-4 w-4"/>Disconnect</Button>
      :<Button size="sm" onClick={()=>void connectionAction("connect")} disabled={!!busy}>Connect Gmail</Button>}
    </div>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 px-5 py-2 text-xs text-muted-foreground">
    <p>{connection?.connected?"Authorized sender: "+connection.email:(connectedError||"Connect your own residence email above to send from that mailbox")}</p>
    <p className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5"/>Server-verified recipients · PDF attached per email</p>
   </div>
   {mode==="landlord"&&<details className="border-b bg-muted/25 px-5 py-2"><summary className="cursor-pointer text-xs font-semibold text-primary">Gmail setup guide</summary><div className="pt-3">
     <LandlordGmailGuide connected={!!connection?.connected} email={connection?.email||null} busy={!!busy}
       onConnect={()=>void connectionAction("connect")} onRefresh={()=>void loadConnection()}/>
    </div></details>}
    <nav className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur sm:px-5" aria-label="Communications workspace">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1.5">
       {(Object.keys(kindLabels) as Kind[]).filter(k=>mode==="admin"||k!=="support_enquiry").map(k=>
        <Button key={k} type="button" size="sm" className="h-9 rounded-lg px-3 text-xs"
         variant={workspace==="cases"&&kind===k?"default":"ghost"}
         aria-current={workspace==="cases"&&kind===k?"page":undefined}
         onClick={()=>{if(kind!==k||workspace!=="cases")selectKind(k);}}>{kindLabels[k]}</Button>)}
      </div>
      <Button type="button" size="sm" className="h-9 gap-1.5 rounded-lg" variant={workspace==="activity"?"default":"outline"}
       onClick={()=>{setWorkspace("activity");const next=new URLSearchParams(params);next.set("view","activity");setParams(next,{replace:true});}}>
       <Users className="h-4 w-4"/>Contact activity
      </Button>
     </div>
     {workspace==="cases"&&<>
      <div className="mt-3 flex flex-wrap items-center gap-2">
       <div className="relative min-w-[190px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/>
        <Input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Find student or reservation"
         placeholder="Search student, residence, reference…" className="h-9 rounded-lg pl-9"/>
       </div>
       {(kind==="application"||kind==="reservation")&&
        <Select value={academicYear} onValueChange={v=>{setAcademicYear(v);setSelected("");setChecked(new Set());resetPreview();}}>
         <SelectTrigger className="h-9 w-[122px] rounded-lg" aria-label="Academic year"><SelectValue/></SelectTrigger>
         <SelectContent><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent>
        </Select>}
       <Select value={sortBy} onValueChange={v=>setSortBy(v as typeof sortBy)}>
        <SelectTrigger className="h-9 w-[154px] rounded-lg" aria-label="Sort student cases"><ArrowUpDown className="mr-1 h-3.5 w-3.5"/><SelectValue/></SelectTrigger>
        <SelectContent><SelectItem value="needs_action">Needs action first</SelectItem><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem></SelectContent>
       </Select>
       <Button type="button" size="sm" variant={advancedFilters?"secondary":"outline"} className="h-9 gap-1.5" onClick={()=>setAdvancedFilters(v=>!v)}>
        <SlidersHorizontal className="h-3.5 w-3.5"/>More filters
       </Button>
      </div>
      {(kind==="application"||kind==="reservation")&&<div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label={kind==="application"?"Applications overview":"Reservations overview"}>
        {(kind==="application"?([
         ["submitted","Submitted",queueStats.submitted,"New cases"],
         ["uploaded","Docs uploaded",queueStats.uploaded,"Files received"],
         ["received","Ready to review",queueStats.review,"Verify submissions"],
         ["decision","Decisions",items.filter(x=>["approved","rejected","conditionally_approved"].includes(x.status)).length,"Recorded outcomes"]
        ] as const):([
         ["reserved","Reserved",queueStats.reserved,"Awaiting next steps"],
         ["uploaded","Docs uploaded",queueStats.uploaded,"Files received"],
         ["received","Ready to review",queueStats.review,"Verify submissions"],
         ["confirmed","Confirmed",queueStats.confirmed,"Placement status"]
        ] as const)).map(([key,label,count,description])=>
         <button key={key} type="button" onClick={()=>setFilter(key)} aria-pressed={filter===key}
          className={cn("rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
           filter===key?"border-primary bg-primary/[0.06] shadow-sm":"border-border bg-card")}>
          <span className="flex items-center justify-between gap-2"><span className="text-xs font-bold">{label}</span><span className="text-lg font-black tabular-nums">{count}</span></span>
          <span className="text-[11px] text-muted-foreground">{description}</span>
         </button>)}
       </div>}
       <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by student progress">
       {([
        ["all","All cases",totalCases],["uploaded","Docs uploaded",queueStats.uploaded],
        ["missing","Missing docs",queueStats.missing],["received","Ready to review",queueStats.review],
        ["not_contacted","No email yet",queueStats.unemailed],["followup_due","Follow-up due",queueStats.followup]
       ] as const).map(([key,label,count])=><Button key={key} type="button" size="sm" variant={filter===key?"default":"outline"}
         className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs" onClick={()=>setFilter(key)}>
         {label}<span className="text-[11px] opacity-70">{count}</span></Button>)}
      </div>
      {advancedFilters&&<div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3">
       <span className="text-xs font-semibold text-muted-foreground">More ways to filter</span>
       <Select value={filter} onValueChange={v=>setFilter(v as typeof filter)}>
        <SelectTrigger className="h-9 w-full max-w-[280px] bg-background" aria-label="Detailed workflow filter"><SelectValue/></SelectTrigger>
        <SelectContent>
         <SelectItem value="all">All cases</SelectItem><SelectItem value="uploaded">Any documents uploaded</SelectItem>
         <SelectItem value="no_uploads">No documents uploaded</SelectItem><SelectItem value="missing">Missing required documents</SelectItem>
         <SelectItem value="received">Documents awaiting review</SelectItem><SelectItem value="decision">Decisions and confirmations</SelectItem>
         <SelectItem value="not_contacted">No email sent yet</SelectItem><SelectItem value="followup_due">Follow-up due</SelectItem>
         <SelectItem value="student_acted">Student uploaded after email</SelectItem><SelectItem value="awaiting_review">Awaiting verification</SelectItem>
         <SelectItem value="decision_changed">Status changed since email</SelectItem><SelectItem value="approved">Approved / confirmed</SelectItem>
         <SelectItem value="rejected">Rejected</SelectItem>
         {kind==="application"&&<><SelectItem value="submitted">Submitted applications</SelectItem><SelectItem value="under_review">Applications under review</SelectItem></>}
         {kind==="reservation"&&<><SelectItem value="reserved">Reserved rooms</SelectItem><SelectItem value="confirmed">Confirmed reservations</SelectItem></>}
        </SelectContent>
       </Select>
       <Button variant="ghost" size="sm" onClick={()=>{setFilter("all");setSearch("");}}>Clear filters</Button>
      </div>}
      <p className="mt-1 text-[11px] text-muted-foreground">
       {items.length} of {totalCases} cases loaded · filters and counts use loaded records
       {nextOffset!==null&&<span> · <button type="button" className="font-semibold text-primary underline underline-offset-2" disabled={loadingMore}
        onClick={()=>void loadRemaining(true)}>Load all for complete filtering</button></span>}
      </p>
     </>}
    </nav>
    {workspace==="activity"?<ContactActivityDashboard mode={mode} invoke={premium} refreshKey={activityRevision}
     onOpenCase={(targetKind,id)=>{
      deepLinkedIdRef.current=id;setWorkspace("cases");setKind(targetKind);setSelected(id);setPane(targetKind==="application"||targetKind==="reservation"?"documents":"compose");resetPreview();setChecked(new Set());
      const next=new URLSearchParams(params);next.delete("view");next.set("kind",targetKind);next.set("target",id);setParams(next,{replace:true});
     }}/>:
    <>
    <div className="grid min-w-0 grid-cols-1 divide-y lg:grid-cols-[minmax(285px,0.82fr)_minmax(0,1.9fr)] lg:divide-x lg:divide-y-0">
    {/* Inbox / queue */}
    <aside className="flex min-w-0 flex-col">
     <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-4 py-3">
      <div>
       <p className="flex items-center gap-2 text-sm font-bold"><LayoutList className="h-4 w-4 text-primary"/>{kind==="application"?"Application pipeline":kind==="reservation"?"Reservation pipeline":kind==="housing_lead"?"Housing enquiries":"Support enquiries"}
        <Badge variant="secondary">{visible.length} shown</Badge></p>
       <p className="mt-0.5 text-[11px] text-muted-foreground">{kind==="application"?"Review student documents → Decide → Notify":kind==="reservation"?"Check documents → Confirm details → Contact":"Choose a student to see progress and the next step"}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label="Refresh student queue" disabled={loading} onClick={()=>void loadItems()}>
       <RefreshCw className={cn("h-4 w-4",loading&&"animate-spin")}/>
      </Button>
     </div>
     <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
      <p className="text-[11px] text-muted-foreground">{selectedCount} selected</p>
      <div className="flex gap-1">
       <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={()=>setChecked(new Set(visible.filter(x=>x.can_email).slice(0,25).map(x=>x.id)))}>Select 25</Button>
       <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={()=>setChecked(new Set())}>Clear</Button>
       {selectedCount>0&&<Button size="sm" className="h-8 text-[11px]" onClick={()=>setPane("bulk")}>Bulk actions</Button>}
      </div>
     </div>
     {queueError&&<div role="alert" className="mx-3 mb-3 rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/25 dark:text-amber-100">
      <p className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4 shrink-0"/>Email queue connection failed</p>
      <p className="mt-1 text-xs leading-5">{queueError}</p>
      {items.length>0&&<p className="mt-1 text-xs">Previously loaded records are shown until the connection recovers.</p>}
      <Button type="button" size="sm" variant="outline" className="mt-2" disabled={loading} onClick={()=>void loadItems()}><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>Retry loading</Button>
     </div>}
     <p className="px-4 py-2 text-[11px] text-muted-foreground">{queueError&&items.length===0?"Case counts unavailable until the connection recovers.":`${visible.length} matching · ${items.length}/${totalCases} loaded`}</p>
     {nextOffset!==null&&<div className="flex gap-2 px-4 pb-2"><Button variant="outline" size="sm" disabled={loadingMore} onClick={()=>void loadRemaining(false)}>Load next 100</Button><Button variant="secondary" size="sm" disabled={loadingMore} onClick={()=>void loadRemaining(true)}>{loadingMore?"Loading…":"Load all remaining"}</Button></div>}
     <ScrollArea className="h-[min(68vh,710px)] min-h-[320px]">
      {loading?<p className="p-6 text-center text-sm text-muted-foreground">Loading case intelligence…</p>:
       visible.length===0?<p className="p-6 text-center text-sm text-muted-foreground">{queueError?"The case queue could not be loaded. Use Retry above.":kind==="application"&&academicYear==="2027"?"2027 applications are not open yet. Existing reservations are managed under Reservations.":"No matching cases in this view."}</p>:
       visible.map(item=><div key={item.id} className={cn("flex items-start gap-2 border-b px-3 py-3 transition-colors",selected===item.id?"border-l-2 border-l-primary bg-primary/[0.06]":"hover:bg-muted/40")}>
        <Checkbox className="mt-2" checked={checked.has(item.id)} onCheckedChange={v=>toggleSelected(item.id,v===true)} aria-label={"Select "+item.label}/>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={()=>selectRecord(item.id)}>
         <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-bold">{item.label}</p>
          <Badge variant="outline" className="max-w-[116px] shrink-0 truncate rounded-full px-2 py-0 text-[10px]">{pretty(item.status)}</Badge>
         </div>
         <p className="mt-1 truncate text-xs text-muted-foreground">{item.property} · {item.reference}</p>
         <div className="mt-2 flex flex-wrap gap-1">
          {(item.uploaded_count||0)>0
           ?<Badge variant="secondary" className="text-[10px]">{item.uploaded_count} uploaded</Badge>
           :<Badge variant="outline" className="text-[10px] text-muted-foreground">No uploads</Badge>}
          {item.missing_count>0&&<Badge variant="outline" className="border-amber-400/50 bg-amber-50 text-[10px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{item.missing_count} missing</Badge>}
          {item.pending_review>0&&<Badge variant="outline" className="border-blue-400/50 bg-blue-50 text-[10px] text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">{item.pending_review} to review</Badge>}
          {item.email_sent
           ?<Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-300">Email sent</Badge>
           :<Badge variant="outline" className="text-[10px]">No email yet</Badge>}
         </div>
         <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Next:</span> {item.service_action||pretty(item.workflow_bucket||"awaiting_action")}
         </p>
         {item.student_uploaded_after_email&&<p className="mt-1 text-[11px] font-semibold text-blue-600">New upload since last email</p>}
         </button>
         {needsReview&&<Button size="sm" variant="outline" className="mt-1 h-8 shrink-0 rounded-lg px-2 text-[10px]"
          onClick={()=>{selectRecord(item.id);setPane("documents");}}
          aria-label={"Review student documents for "+item.label}>
          <FileCheck2 className="mr-1 h-3.5 w-3.5"/>Files
         </Button>}
       </div>)}
     </ScrollArea>
    </aside>
    {/* Selected student details and communication actions */}
    <div className="grid min-w-0 grid-cols-1 divide-y 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] 2xl:divide-x 2xl:divide-y-0">
    <section id="rk-case-detail-panel" className="min-w-0 scroll-mt-32 space-y-4 p-4">
     <div className="flex items-center justify-between"><p className="font-bold">Case intelligence</p><Badge variant="outline">{active?pretty(active.status):"No case"}</Badge></div>
     {!caseInfo?<div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Select a case to view its document readiness and recommended correspondence.</div>:
      <div className="space-y-3">
       <div className="rounded-xl border p-4">
        <p className="text-lg font-black">{caseInfo.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{caseInfo.property} · Ref {caseInfo.reference}</p>
        {needsReview&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/20 bg-blue-50/50 p-2.5 dark:bg-blue-950/20">
         <span className="text-xs font-semibold">{reviewedNow?"Documents reviewed · Ready to communicate":"Review documents before contacting"}</span>
         <Button size="sm" variant={reviewedNow?"outline":"default"} className="h-8 text-xs" onClick={()=>setPane("documents")}>
          <FileCheck2 className="mr-1.5 h-3.5 w-3.5"/>{reviewedNow?"Open files":"Review files"}
         </Button>
        </div>}
        {caseInfo.residence_image_url&&<img src={caseInfo.residence_image_url} alt={"Real listing photo: "+caseInfo.property} className="mt-3 max-h-32 w-full rounded-lg object-cover"/>}
        <div className="mt-3 grid grid-cols-2 gap-2">
         <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[10px] uppercase text-muted-foreground">Recorded status</p><p className="mt-1 text-xs font-bold">{pretty(caseInfo.status)}</p></div>
         <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-[10px] uppercase text-muted-foreground">Recipient</p><p className="mt-1 text-xs font-bold">{caseInfo.recipient_hint||"No valid email"}</p></div>
        </div>
        {needsReview&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
         <span className="text-[11px] text-muted-foreground">Record the next application or reservation decision when ready.</span>
         <Button size="sm" variant="outline" className="h-8 text-xs" onClick={()=>{setChecked(new Set([selected]));setPane("bulk");}}><CheckCheck className="mr-1.5 h-3.5 w-3.5"/>Update status</Button>
        </div>}
       </div>
       <div className="rounded-xl border border-blue-500/20 bg-blue-500/[.035] p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-blue-600"/>Documents & next step</p>
        <p className={cn("mt-2 text-sm font-semibold",signalStyle(caseInfo.document_signal.stage))}>{caseInfo.document_signal.summary}</p>
        {caseInfo.document_signal.missing.length>0&&<details className="mt-2"><summary className="cursor-pointer text-xs font-bold">{caseInfo.document_signal.missing.length} outstanding requirements · View list</summary>
          <ul className="mt-1 list-inside list-disc space-y-1 text-xs">{caseInfo.document_signal.missing.map(d=><li key={d}>{d}</li>)}</ul></details>}
        {caseInfo.document_signal.uploaded>0&&<p className="mt-2 text-xs text-muted-foreground">{caseInfo.document_signal.uploaded} uploaded · {caseInfo.document_signal.pendingReview} awaiting verification</p>}
        <p className="mt-3 text-xs font-medium">Recommended: {pretty(active?.suggested_template||caseInfo.recommended_template)}</p>
        {active?.service_action&&<p className="mt-2 rounded-lg bg-background p-2 text-xs font-semibold">{active.service_action}</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">Applicant progress is based on recorded uploads and status changes. Gmail replies and reads cannot be detected with send-only permission.</p>
       </div>
       <div className="space-y-2"><Label htmlFor="premium-email-type">Choose context-aware email</Label>
        <Select value={template} onValueChange={v=>{setTemplate(v as Template);resetPreview();}}>
         <SelectTrigger id="premium-email-type"><SelectValue/></SelectTrigger><SelectContent>
          {templatesForKind.map(t=><SelectItem key={t} value={t}>{t==="smart"?"✨ Smart recommended for this case":defaults[t]?.name||pretty(t)}</SelectItem>)}
         </SelectContent></Select></div>
       <div><Label htmlFor="premium-email-note">Personalized message / decision details</Label>
        <Textarea id="premium-email-note" rows={3} value={note} maxLength={2500}
          placeholder="Optional practical details: viewing date and time, move-in instructions, what to submit, or the next step. Avoid repeating the case status."
          onChange={e=>{setNote(e.target.value);resetPreview();}}/>
        <p className="mt-1 text-[11px] text-muted-foreground">{note.length}/2500 · Only recorded decisions appear as formal approvals or rejections.</p></div>
       <Button className="w-full" variant="secondary" disabled={!caseInfo.can_email||!!busy} onClick={()=>{if(needsReview&&!reviewedNow){setPane("documents");toast.info("First review the uploaded documents and confirm readiness");return;}void previewOne();}}>
        {busy==="preview"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Sparkles className="mr-2 h-4 w-4"/>}Generate smart email preview
       </Button>
       <Button className="w-full" variant="outline" onClick={()=>{if(needsReview&&!reviewedNow){setPane("documents");toast.info("Review documents before opening WhatsApp");}else setPane("whatsapp");}} disabled={!selected}>
        <MessageCircle className="mr-2 h-4 w-4 text-emerald-700"/>Open manual WhatsApp handoff {caseInfo.has_whatsapp?"":"(check phone)"}
       </Button>
      </div>}
    </section>
    {/* Main communications dock */}
    <section className="min-w-0 border-t bg-muted/10 xl:border-l xl:border-t-0">
     <Tabs value={pane} onValueChange={v=>setPane(v as typeof pane)} className="min-w-0">
      <TabsList className="m-3 flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
       {needsReview&&<TabsTrigger value="documents"><FileCheck2 className="mr-1 h-3.5 w-3.5"/>1 · Documents</TabsTrigger>}
       <TabsTrigger value="compose"><Mail className="mr-1 h-3.5 w-3.5"/>2 · Email</TabsTrigger>
       <TabsTrigger value="whatsapp"><MessageCircle className="mr-1 h-3.5 w-3.5"/>WhatsApp</TabsTrigger>
       <TabsTrigger value="bulk"><Layers className="mr-1 h-3.5 w-3.5"/>Bulk</TabsTrigger>
       <TabsTrigger value="templates"><Settings2 className="mr-1 h-3.5 w-3.5"/>Templates</TabsTrigger>
       <TabsTrigger value="history"><Clock3 className="mr-1 h-3.5 w-3.5"/>History</TabsTrigger>
      </TabsList>
      {needsReview&&<TabsContent value="documents" className="m-0 space-y-4 px-4 pb-5">
       {selected?<DocumentReviewPanel key={kind+":"+selected} kind={kind} targetId={selected} invoke={premium}
        receipt={selectedReceipt}
        onReviewed={value=>{
         setReviewReceipts(old=>{const next=new Map(old);const key=kind+":"+selected;if(value)next.set(key,value);else next.delete(key);return next;});
         if(value)setPane("compose");
        }}
        onDocumentsChanged={()=>{resetPreview();void Promise.all([loadCase(),loadItems()]);}}/>:
       <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Select a student to review their private uploads.</div>}
      </TabsContent>}
      <TabsContent value="compose" className="m-0 space-y-4 px-4 pb-5">
       <div><p className="text-base font-bold">Premium correspondence</p>
        <p className="text-xs text-muted-foreground">White and gold branded emails, accurate case details and an individual PDF letter.</p></div>
       {preview?<div className="space-y-3">
        <div className="rounded-xl border bg-card p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">To: {preview.case.recipient_hint}</p>
         <p className="mt-2 text-sm font-bold">{preview.subject}</p>
         <div className="mt-2 flex flex-wrap gap-2"><Badge variant="secondary">{pretty(preview.resolved_key)}</Badge><Badge variant="outline"><Paperclip className="mr-1 h-3 w-3"/>PDF attachment</Badge></div>
        </div>
        <iframe title="Branded email preview" className="h-[360px] w-full rounded-xl border bg-white" sandbox="" srcDoc={preview.html}/>
        <Button variant="outline" className="w-full" onClick={()=>void downloadPdf()} disabled={!!busy}><Download className="mr-2 h-4 w-4"/>Download official PDF preview</Button>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs">
         <Checkbox checked={approved} onCheckedChange={v=>setApproved(v===true)}/>
         <span>I reviewed the recipient, current status, decision wording and PDF attachment. I authorize this service email.</span>
        </label>
        <Button className="w-full" disabled={!approved||!connection?.connected||!!busy||!reviewedNow} onClick={()=>void sendOne()}>
         {busy==="send"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Send className="mr-2 h-4 w-4"/>}Send official email + PDF
        </Button>
       </div>:<div className="rounded-xl border border-dashed bg-card p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-blue-600"/><p className="mt-3 font-semibold">Email + PDF preview</p>
        <p className="mt-1 text-xs text-muted-foreground">Select a case and click Generate smart email preview to see a fully branded message here.</p>
       </div>}
      </TabsContent>
      <TabsContent value="whatsapp" className="m-0 space-y-4 px-4 pb-5">
       {needsReview&&!reviewedNow&&<div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
        Review this student's uploaded documents before opening a WhatsApp handoff. <Button size="sm" variant="outline" className="ml-2" onClick={()=>setPane("documents")}>Review now</Button>
       </div>}
       <ManualWhatsAppPanel key={kind+":"+selected+":"+template+":"+note} kind={kind} targetId={selected} templateKey={template} note={note} invoke={premium} reviewId={selectedReceipt?.id||null} needsReview={needsReview} onActivityChange={()=>setActivityRevision(v=>v+1)}/>
      </TabsContent>
      <TabsContent value="bulk" className="m-0 space-y-4 px-4 pb-5">
       <div className="rounded-xl border bg-card p-4"><p className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary"/>Bulk communication</p>
        <p className="mt-1 text-xs text-muted-foreground">{selectedCount} selected · individualized case context and PDF per recipient · five sends per batch</p>
        <p className="mt-1 text-xs font-semibold text-primary">Bulk emails always use each student’s own Smart template, not the single-case template selection.</p>
        <Button className="mt-3 w-full" variant="secondary" onClick={()=>void previewBulk()} disabled={!selectedCount||!!busy}><FileCheck2 className="mr-2 h-4 w-4"/>Review selected messages</Button>
        {bulkPreview.length>0&&<div className="mt-3 space-y-2">{bulkPreview.map(messageCard)}
         {needsReview&&bulkPreview.some(x=>x.ok&&!reviewReceiptFor(x.id))&&<div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-bold">Document review needed before bulk sending</p>
          <p className="mt-1">Review each recipient's files individually. Your reviewed cases will stay recorded while you move between students.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{bulkPreview.filter(x=>x.ok&&!reviewReceiptFor(x.id)).map(x=>
           <Button key={x.id} size="sm" variant="outline" onClick={()=>{setSelected(x.id);setPane("documents");}}>{x.label||x.id.slice(0,8)} · Review</Button>)}</div>
         </div>}
         <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs">
          <Checkbox checked={bulkApproval} onCheckedChange={v=>setBulkApproval(v===true)}/>
          <span>I reviewed these recipients and understand each will get an individualized Gmail email and PDF.</span>
         </label>
         <Button className="w-full" disabled={!bulkApproval||!connection?.connected||!!busy||!bulkPreview.some(x=>x.ok)||(needsReview&&bulkPreview.filter(x=>x.ok).some(x=>!reviewReceiptFor(x.id)))} onClick={()=>void sendBulk()}>
          <Send className="mr-2 h-4 w-4"/>{busy==="bulk-send"?"Sending approved batches…":"Send reviewed emails"}
         </Button>
        </div>}
        {batchSummary&&<p className="mt-2 text-sm font-semibold">{batchSummary.ok} accepted · {batchSummary.failed} not sent</p>}
       </div>
       {(kind==="application"||kind==="reservation")&&<div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="flex items-center gap-2 font-semibold"><WalletCards className="h-4 w-4 text-primary"/>Bulk status manager</p>
        <p className="text-xs text-muted-foreground">Updates the database and in-app notifications; no Gmail messages are sent automatically.</p>
        <Select value={newStatus} onValueChange={v=>{setNewStatus(v);setStatusPreview([]);setStatusApproved(false);}}>
         <SelectTrigger><SelectValue placeholder="Select new status"/></SelectTrigger>
         <SelectContent>{statusOptions[kind].map(status=><SelectItem key={status} value={status}>{pretty(status)}</SelectItem>)}</SelectContent>
        </Select>
        <Textarea value={statusNote} onChange={e=>{setStatusNote(e.target.value);setStatusApproved(false);}} placeholder="Factual decision / update note (required for acceptance, rejection or cancellation)" maxLength={500} rows={3}/>
        <Button variant="secondary" className="w-full" onClick={()=>void previewStatuses()} disabled={!selectedCount||!newStatus||!!busy}>
         <CheckCheck className="mr-2 h-4 w-4"/>Validate selected status changes
        </Button>
        {statusPreview.length>0&&<div className="space-y-2">
         {statusPreview.map(messageCard)}
         <p className="text-xs font-semibold">{statusPreview.filter(x=>x.ok).length} eligible of {statusPreview.length}; missing documents block premature approvals.</p>
         <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs"><Checkbox checked={statusApproved} onCheckedChange={v=>setStatusApproved(v===true)}/>
          <span>I verified the student decisions and authorize these recorded status changes.</span>
         </label>
         <Button className="w-full" disabled={!statusApproved||!!busy||!statusPreview.some(x=>x.ok)} onClick={()=>void applyStatuses()}>
          <CheckCircle2 className="mr-2 h-4 w-4"/>Apply approved status updates
         </Button>
        </div>}
       </div>}
      </TabsContent>
      <TabsContent value="templates" className="m-0 space-y-3 px-4 pb-5">
       <p className="font-bold">Template Studio</p><p className="text-xs text-muted-foreground">Change copy once, reuse smart placeholders and keep the ResKonnect brand and PDF layout consistent.</p>
       <Select value={studioKey} onValueChange={v=>selectStudio(v as Template)}>
        <SelectTrigger><SelectValue/></SelectTrigger>
        <SelectContent>{availableStudio.map(t=><SelectItem key={t} value={t}>{defaults[t]?.name||pretty(t)}</SelectItem>)}</SelectContent>
       </Select>
       <Label htmlFor="template-subject">Subject template</Label>
       <Input id="template-subject" value={studioSubject} maxLength={180} onChange={e=>setStudioSubject(e.target.value)}/>
       <Label htmlFor="template-body">Letter / email template body</Label>
       <Textarea id="template-body" value={studioBody} rows={10} maxLength={4000} onChange={e=>setStudioBody(e.target.value)}/>
       <div className="flex flex-wrap gap-1">{placeholders.map(t=><Button type="button" key={t} variant="outline" className="h-7 px-2 text-[10px]" onClick={()=>setStudioBody(v=>v+" {{"+t+"}}")}>{"{{"+t+"}}"}</Button>)}</div>
       <div className="flex gap-2">
        <Button className="flex-1" onClick={()=>void saveStudio(false)} disabled={!!busy}>Save template</Button>
        <Button variant="outline" onClick={()=>void saveStudio(true)} disabled={!!busy}>Reset</Button>
       </div>
       <p className="text-xs text-muted-foreground">{stored?"Custom version saved":"ResKonnect standard template"} · The logo, footer and case-status checks remain controlled by ResKonnect.</p>
      </TabsContent>
      <TabsContent value="history" className="m-0 space-y-3 px-4 pb-5">
       <div className="flex items-center justify-between"><p className="font-bold">Correspondence history</p><Button variant="ghost" size="sm" onClick={()=>void loadHistory()}><RefreshCw className="h-4 w-4"/></Button></div>
       <ScrollArea className="h-[550px]">
        {history.length===0?<p className="p-8 text-center text-sm text-muted-foreground">No outgoing emails recorded yet.</p>:
         history.map(x=><div key={x.id} className="mb-2 rounded-xl border bg-card p-3">
          <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{x.subject}</p>
           <Badge variant={x.delivery_status==="sent"?"default":x.delivery_status==="failed"?"destructive":"outline"}>{pretty(x.delivery_status)}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">{x.recipient_email} · {new Date(x.created_at).toLocaleString("en-ZA")}</p>
          <div className="mt-2 flex items-center gap-2 text-xs">{x.pdf_attached&&<Badge variant="outline"><Paperclip className="mr-1 h-3 w-3"/>PDF included</Badge>}<span>{pretty(x.template_key)}</span></div>
          {x.failure_code&&<p className="mt-1 text-xs text-amber-700">{x.failure_code}</p>}
         </div>)}
       </ScrollArea>
      </TabsContent>
     </Tabs>
    </section>
    </div>
   </div>
   </>}
  </div>
  <div className="flex items-start gap-2 text-xs text-muted-foreground">
   <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>
   Case readiness is a recommendation, not a decision. Formal acceptance and rejection letters use the recorded status; student documents are uploaded securely in ResKonnect, never by email. Bulk changes require explicit confirmation.
  </div>
 </div>;
}
