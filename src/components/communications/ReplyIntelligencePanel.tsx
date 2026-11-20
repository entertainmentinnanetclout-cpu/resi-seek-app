import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {AlertTriangle,CheckCircle2,Clock3,FileCheck2,Inbox,Loader2,MailCheck,RefreshCw,ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";

type Reply={
 id:string;received_at:string;classification:string;suggested_stage:string;review_status:string;
 reviewed_category?:string|null;snippet:string;case_stage?:string;case_status?:string;
};
type MailRow={
 id:string;target_kind:string;target_id:string;student_name:string;recipient_hint:string;
 subject:string;template_key:string;delivery_status:string;sent_at:string;pdf_attached:boolean;sender_scope?:string;sender_name?:string;
 reply_status:"replied"|"awaiting_reply"|"not_checked";reply_count:number;last_checked_at:string|null;latest_reply:Reply|null;
};
type Overview={
 day:string;items:MailRow[];total:number;reply_sync_enabled:boolean;
 counts:{sent:number;replied:number;awaiting:number;unchecked:number;pending_review:number;final_confirmation:number};
};
const categories=[
 ["confirmation_intent","Acceptance / confirmation intent"],
 ["documents_provided","Documents reportedly submitted"],
 ["documents_question","Document requirements question"],
 ["viewing_request","Viewing request"],
 ["more_time","Requests more time"],
 ["declined","Declined / withdrawn interest"],
 ["payment_question","Payment / funding question"],
 ["general_question","General question"],
 ["acknowledgement","Acknowledgement"],
 ["other","Other / needs interpretation"]
] as const;
const initialDay=()=>new Date(Date.now()+2*3600000).toISOString().slice(0,10);
const title=(v:string)=>v.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const when=(v:string)=>new Date(v).toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg",dateStyle:"medium",timeStyle:"short"});
export default function ReplyIntelligencePanel({
 invoke,connection,onEnableReplySync,mode,revision
}:{
 invoke:(body:Record<string,unknown>)=>Promise<any>;
 connection:{connected:boolean;email:string|null;reply_sync_enabled?:boolean}|null;
 onEnableReplySync:()=>void;mode:"admin"|"landlord";revision:number;
}){
 const [day,setDay]=useState(initialDay);
 const [data,setData]=useState<Overview|null>(null);
 const [loading,setLoading]=useState(false);
 const [syncing,setSyncing]=useState(false);
 const [filter,setFilter]=useState("all");
 const [sort,setSort]=useState("newest");
 const [search,setSearch]=useState("");
 const [reviewId,setReviewId]=useState<string|null>(null);
 const [category,setCategory]=useState("other");
 const [note,setNote]=useState("");
 const [saving,setSaving]=useState(false);
 const [loadError,setLoadError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setLoadError("");
  try{setData(await invoke({action:"reply_overview",day}));}
  catch(e){setLoadError(e instanceof Error?e.message:"Correspondence could not be loaded");}
  finally{setLoading(false);}
 },[invoke,day]);
 useEffect(()=>{void load();},[load,revision]);
 const rows=useMemo(()=>{
  const entries=[...(data?.items||[])].filter(x=>{
   if(filter==="replied"&&x.reply_status!=="replied")return false;
   if(filter==="awaiting_reply"&&x.reply_status!=="awaiting_reply")return false;
   if(filter==="not_checked"&&x.reply_status!=="not_checked")return false;
   if(filter==="review"&&x.latest_reply?.review_status!=="pending")return false;
   if(filter==="confirmation"&&x.latest_reply?.classification!=="confirmation_intent")return false;
   return (x.student_name+" "+x.subject+" "+x.recipient_hint+" "+x.target_kind).toLowerCase().includes(search.toLowerCase());
  });
  entries.sort((a,b)=>{
   if(sort==="oldest")return a.sent_at.localeCompare(b.sent_at);
   if(sort==="replies_first")return Number(b.reply_status==="replied")-Number(a.reply_status==="replied")||b.sent_at.localeCompare(a.sent_at);
   if(sort==="needs_review")return Number(b.latest_reply?.review_status==="pending")-Number(a.latest_reply?.review_status==="pending")||b.sent_at.localeCompare(a.sent_at);
   return b.sent_at.localeCompare(a.sent_at);
  });
  return entries;
 },[data,filter,sort,search]);
 const sync=async()=>{
  if(!connection?.connected||!data?.reply_sync_enabled)return toast.error("Enable the read-only Gmail reply permission first");
  setSyncing(true);
  let offset:number|null=0,checked=0,newReplies=0,failures=0;const reasons:string[]=[];
  try{
   for(let page=0;page<10&&offset!==null;page++){
    const response=await invoke({action:"reply_sync",day,offset});
    checked+=Number(response.scanned||0);newReplies+=Number(response.found||0);failures+=Number(response.failed||0);
    for(const reason of response.errors||[])if(reasons.length<2)reasons.push(String(reason));
    offset=typeof response.next_offset==="number"?response.next_offset:null;
   }
   await load();
   if(failures)toast.warning(checked+" Gmail conversations checked · "+newReplies+" new replies · "+failures+" not checked. "+(reasons[0]||"Retry sync later."));
   else toast.success(checked+" Gmail conversations checked · "+newReplies+" new replies recorded");
  }catch(e){toast.error(e instanceof Error?e.message:"Gmail reply sync was interrupted");await load();}
  finally{setSyncing(false);}
 };
 const review=async(row:MailRow,decision:"reviewed"|"final_confirmation_pending"|"verified_final")=>{
  if(!row.latest_reply||note.trim().length<8)return toast.error("Provide a factual review note (minimum 8 characters)");
  if(!window.confirm(decision==="verified_final"
   ?"Verify final placement only if the linked reservation is already officially confirmed and ResKonnect handover was approved?"
   :"Save your review of this student's actual email reply?"))return;
  setSaving(true);
  try{
   const result=await invoke({action:"reply_review",reply_id:row.latest_reply.id,category,decision,note});
   toast.success(result.student_lifecycle_updated?"Verified final confirmation recorded in the student housing journey":"Student response case updated for the next action");
   setReviewId(null);setNote("");await load();
  }catch(e){toast.error(e instanceof Error?e.message:"The reply could not be reviewed");}
  finally{setSaving(false);}
 };
 const stat=(label:string,num:number,choice:string)=><button key={choice} type="button" className={"rounded-xl border p-3 text-left transition hover:border-blue-400 "+(filter===choice?"border-blue-500 bg-blue-50 dark:bg-blue-950/30":"bg-card")} onClick={()=>setFilter(choice)}>
  <span className="block text-2xl font-black tabular-nums">{num}</span><span className="text-xs text-muted-foreground">{label}</span>
 </button>;
 return <div className="space-y-4" aria-label="Sent mail and response intelligence">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div><h3 className="flex items-center gap-2 text-base font-bold"><MailCheck className="h-5 w-5 text-primary"/>Sent emails and student responses</h3>
    <p className="mt-1 text-xs text-muted-foreground">South African date · audited Gmail sends, linked student replies and evidence-based case stages</p></div>
   <Button size="sm" variant="outline" onClick={()=>void load()} disabled={loading||syncing}><RefreshCw className="mr-1 h-4 w-4"/>Refresh records</Button>
  </div>
  <div className="flex flex-wrap items-end gap-2">
   <label className="space-y-1 text-xs font-semibold">Date in South Africa
    <Input aria-label="Correspondence date" type="date" className="w-[160px]" value={day} onChange={e=>setDay(e.target.value)}/></label>
   <Button size="sm" variant="outline" onClick={()=>setDay(initialDay())}>Today</Button>
   {data?.reply_sync_enabled?<Button size="sm" disabled={syncing||loading} onClick={()=>void sync()}>
    {syncing?<Loader2 className="mr-1 h-4 w-4 animate-spin"/>:<Inbox className="mr-1 h-4 w-4"/>}
    {syncing?"Checking Gmail replies…":"Check Gmail replies"}</Button>:
    <Button size="sm" variant="outline" disabled={!connection?.connected} onClick={onEnableReplySync}>Enable Gmail reply sync</Button>}
  </div>
  {!data?.reply_sync_enabled&&<div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950" role="status">
   <p className="font-bold">Reply status has not been verified by Gmail.</p>
   <p>The existing Gmail connection has send-only permission. Enable optional read-only Gmail access through Google to match responses to actual sent-message threads. Google may require app verification. Until then, unanswered and unverified are not the same thing.</p>
  </div>}
  {loadError&&<p role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-700">{loadError}</p>}
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
   {stat("Sent on selected date",data?.counts.sent||0,"all")}
   {stat("Received replies",data?.counts.replied||0,"replied")}
   {stat("Checked, no reply",data?.counts.awaiting||0,"awaiting_reply")}
   {stat("Not yet checked",data?.counts.unchecked||0,"not_checked")}
   {stat("Replies needing review",data?.counts.pending_review||0,"review")}
   {stat("Potential confirmations",data?.counts.final_confirmation||0,"confirmation")}
  </div>
  <div className="flex flex-wrap gap-2">
   <Input aria-label="Search sent emails" className="min-w-[180px] flex-1" placeholder="Student, email hint, subject or type" value={search} onChange={e=>setSearch(e.target.value)}/>
   <Select value={sort} onValueChange={setSort}><SelectTrigger aria-label="Sort correspondence" className="w-[200px]"><SelectValue/></SelectTrigger><SelectContent>
    <SelectItem value="newest">Newest sent first</SelectItem><SelectItem value="oldest">Oldest sent first</SelectItem>
    <SelectItem value="replies_first">Replied first</SelectItem><SelectItem value="needs_review">Unreviewed replies first</SelectItem>
   </SelectContent></Select>
  </div>
  {loading?<p className="py-8 text-center text-sm text-muted-foreground">Loading verified correspondence…</p>:
   rows.length===0?<p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No emails match this date or filter.</p>:
   <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1" role="list" aria-label="Sent email status">
   {rows.map(row=><div key={row.id} className="rounded-xl border bg-card p-3" role="listitem">
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div className="min-w-0"><p className="text-sm font-bold">{row.student_name}</p>
      <p className="break-words text-xs font-semibold">{row.subject}</p>
      <p className="mt-1 text-xs text-muted-foreground">{row.recipient_hint} · {when(row.sent_at)} · {title(row.target_kind)}</p>
      <p className="mt-1 text-xs font-semibold">Sender: {row.sender_scope==="reskonnect"?"ResKonnect · official company notice":row.sender_scope==="residence"?"Residence correspondence":"Historical sender category not recorded"}</p></div>
     <Badge variant={row.reply_status==="replied"?"default":"outline"}>{row.reply_status==="replied"?"Reply received":row.reply_status==="awaiting_reply"?"No reply as of last check":"Reply not checked"}</Badge>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
     <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3"/>Gmail accepted</Badge>
     {row.pdf_attached&&<Badge variant="outline">PDF attached</Badge>}
     <Link className="font-semibold text-primary underline" to={(mode==="admin"?"/admin/communications":"/residence/communications")+"?tab=email&kind="+encodeURIComponent(row.target_kind)+"&target="+encodeURIComponent(row.target_id)}>Open linked case</Link>
    </div>
    {row.latest_reply&&<div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <strong>{title(row.latest_reply.classification)} · {when(row.latest_reply.received_at)}</strong>
      <Badge variant={row.latest_reply.review_status==="pending"?"secondary":"outline"}>{title(row.latest_reply.review_status)}</Badge>
     </div>
     <p className="mt-1 text-muted-foreground">Suggested next step: {title(row.latest_reply.suggested_stage)} · Recorded response-case stage: {title(row.latest_reply.case_stage||"response_review")}. This is not a formal placement decision.</p>
     {row.latest_reply.snippet&&<p className="mt-2 whitespace-pre-wrap break-words">{row.latest_reply.snippet}</p>}
     {reviewId===row.latest_reply.id?<div className="mt-3 space-y-2">
      <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue/></SelectTrigger>
       <SelectContent>{categories.map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
      </Select>
      <Textarea rows={2} value={note} maxLength={1000} onChange={e=>setNote(e.target.value)} placeholder="Factual evidence and why this response means the selected next step"/>
      <div className="flex flex-wrap gap-2">
       <Button size="sm" disabled={saving} onClick={()=>void review(row,"reviewed")}>Save reviewed response</Button>
       {category==="confirmation_intent"&&<Button size="sm" variant="outline" disabled={saving} onClick={()=>void review(row,"final_confirmation_pending")}>Flag final confirmation review</Button>}
       {mode==="admin"&&category==="confirmation_intent"&&<Button size="sm" variant="outline" disabled={saving} onClick={()=>void review(row,"verified_final")}>Verify finalized placement</Button>}
       <Button size="sm" variant="ghost" onClick={()=>setReviewId(null)}>Cancel</Button>
      </div>
     </div>:<Button size="sm" variant="outline" className="mt-2" onClick={()=>{setReviewId(row.latest_reply!.id);setCategory(row.latest_reply!.reviewed_category||row.latest_reply!.classification);setNote("");}}><FileCheck2 className="mr-1 h-3.5 w-3.5"/>Review and update case</Button>}
    </div>}
    {row.reply_status==="awaiting_reply"&&<p className="mt-2 text-xs text-muted-foreground"><Clock3 className="mr-1 inline h-3.5 w-3.5"/>No matching incoming reply found when checked {when(row.last_checked_at!)}.</p>}
   </div>)}</div>}
  <p className="flex gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0"/>
   Automatic response categories are suggestions. Final housing verification requires a confirmed reservation, authorized handover signoff and MFA-verified admin review; a student reply alone never grants approval.</p>
 </div>;
}
