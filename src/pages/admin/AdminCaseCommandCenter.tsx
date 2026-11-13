import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {ArrowRight,BriefcaseBusiness,Check,CheckCheck,ClipboardList,FileCheck2,Mail,MessageCircle,RefreshCw,Search,Send,ShieldCheck,UsersRound,Workflow} from "lucide-react";
import {toast} from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent} from "@/components/ui/card";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {supabase} from "@/integrations/supabase/client";

type Kind="application"|"reservation"|"wil";
type Docs={ready?:boolean;identity_verified?:boolean;academic_verified?:boolean;funding_verified?:boolean;funding_type_known?:boolean;missing?:string[];uploaded?:number;reason?:string};
type CaseRow={id:string;kind:Kind;status:string;stage:string;student_name:string|null;student_number:string|null;campus:string|null;course:string|null;residence_name:string|null;funding_type:string|null;created_at:string;document_readiness:Docs;eligibility_decision:string|null;task_id:string|null;task_status:string|null};
type Action="acknowledge_received"|"start_review"|"request_documents"|"delegate_review"|"mark_eligible"|"approve_handover"|"confirm_reservation"|"approve_application"|"reject_application"|"cancel_reservation"|"internal_note"|"mark_follow_up";
type OperationResult={id:string;ok:boolean;reason?:string;status?:string;stage?:string;document_readiness?:Docs};
type EmailItem={id:string;ok:boolean;label?:string;subject?:string;body?:string;status?:string;document_signal?:{stage:string};preview_hash?:string;error?:string};
type Thread={id:string;message:string;visibility:string;created_at:string;sender_id:string};
type WaDraft={id:string;ok:boolean;message?:string;preview_hash?:string;case?:{status:string;document_signal:{stage:string}};can_open?:boolean;phone_hint?:string;error?:string};
const OPTIONS:{id:Action;label:string;hint:string}[]=[
 {id:"acknowledge_received",label:"Mark received",hint:"Bulk receipt: records the case and notifies the student in-app. No document verification or booking decision."},
 {id:"start_review",label:"Start review",hint:"Moves the operations stage to Under Review. An application may also change to under_review; reservations stay unconfirmed."},
 {id:"request_documents",label:"Request evidence",hint:"Flags the case as needing documents. Add a factual note; this does not verify any file."},
 {id:"delegate_review",label:"Assign to landlord",hint:"Creates a private eligibility-review task for the active residence portal. ResKonnect still signs off final handover."},
 {id:"mark_eligible",label:"ResKonnect recommends eligible",hint:"Preliminary eligibility recommendation, not placement approval. Evidence still must be verified."},
 {id:"approve_handover",label:"Approve handover",hint:"Requires eligible assessment, finished landlord task and verified identity, academic and funding evidence."},
 {id:"confirm_reservation",label:"Confirm physical reservation",hint:"Requires approved handover, verified documents and a genuine active physical-room hold."},
 {id:"approve_application",label:"Approve application",hint:"Final application approval only after ResKonnect handover sign-off and verified ID, academic and funding documents."},
 {id:"reject_application",label:"Reject ineligible application",hint:"A documented ineligible eligibility decision and factual reason are compulsory; this action is audited."},
 {id:"cancel_reservation",label:"Cancel reservation",hint:"Closes the selected non-final reservation with a reason and triggers existing room-hold release controls."},
 {id:"mark_follow_up",label:"Create follow-up task",hint:"Creates an internal follow-up task for this case, without messaging anyone externally."},
 {id:"internal_note",label:"Add private notes",hint:"Adds a ResKonnect-only note to every selected case, without altering its status."},
];
const risky=new Set<Action>(["delegate_review","approve_handover","confirm_reservation","approve_application","reject_application","cancel_reservation"]);
const readable=(s?:string|null)=>String(s||"Not set").replaceAll("_"," ");
const rpc=async(action:string,params:Record<string,unknown>)=>{
 const {data,error}=await (supabase as any).rpc(action,params);
 if(error)throw new Error(error.message||"Action failed");return data;
};
const edge=async(body:Record<string,unknown>)=>{
 const {data,error}=await supabase.functions.invoke("reskonnect-email-dock",{body});
 if(error||data?.error)throw new Error(data?.error||error?.message||"Communication service unavailable");
 return data;
};
export default function AdminCaseCommandCenter(){
 const [kind,setKind]=useState<Kind>("reservation");
 const [stage,setStage]=useState("all");
 const [offset,setOffset]=useState(0);
 const [rows,setRows]=useState<CaseRow[]>([]);
 const [total,setTotal]=useState(0);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [selected,setSelected]=useState<Set<string>>(()=>new Set());
 const [action,setAction]=useState<Action>("acknowledge_received");
 const [note,setNote]=useState("");
 const [preview,setPreview]=useState<OperationResult[]|null>(null);
 const [typed,setTyped]=useState("");
 const [result,setResult]=useState<{applied:number;skipped:number;items:OperationResult[]}|null>(null);
 const [emailMode,setEmailMode]=useState<"triage_received"|"triage_under_review">("triage_received");
 const [emailDrafts,setEmailDrafts]=useState<EmailItem[]>([]);
 const [whatsappDrafts,setWhatsappDrafts]=useState<WaDraft[]>([]);
 const [handoffs,setHandoffs]=useState<Record<string,{id:string;url:string;reported?:boolean}>>({});
 const [view,setView]=useState<CaseRow|null>(null);
 const [packet,setPacket]=useState<any>(null);
 const [thread,setThread]=useState<Thread[]>([]);
 const [comment,setComment]=useState("");
 const [share,setShare]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const data=await rpc("rk_case_queue",{p_kind:kind,p_scope:"admin",p_limit:60,p_offset:offset,p_stage:stage==="all"?null:stage});
   setRows((data?.items||[]) as CaseRow[]);setTotal(Number(data?.total||0));
  }catch(e){setError(e instanceof Error?e.message:"Unable to load secured case queue");setRows([]);}
  finally{setLoading(false);}
 },[kind,stage,offset]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{setPreview(null);setEmailDrafts([]);setWhatsappDrafts([]);setHandoffs({});setTyped("");},[selected,action,note,emailMode,kind]);
 const filtered=useMemo(()=>rows.filter(r=>[r.student_name,r.student_number,r.residence_name,r.campus,r.status,r.stage,r.id].join(" ").toLowerCase().includes(query.toLowerCase())),[rows,query]);
 const chosen=useMemo(()=>[...selected].slice(0,75),[selected]);
 const selectAll=()=>setSelected(prev=>new Set(filtered.slice(0,75).map(r=>r.id)));
 const toggle=(id:string)=>setSelected(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});
 const changeKind=(next:Kind)=>{setKind(next);setOffset(0);setStage("all");setSelected(new Set());setView(null);};
 const previewAction=async()=>{
  if(!chosen.length)return toast.error("Select cases first");
  setBusy(true);setPreview(null);setResult(null);
  try{const response=await rpc("rk_case_bulk_preview",{p_kind:kind,p_ids:chosen,p_action:action,p_note:note});setPreview(response.items||[]);toast.info(response.eligible+" of "+response.requested+" cases eligible");}
  catch(e){toast.error(e instanceof Error?e.message:"Preview failed");}
  finally{setBusy(false);}
 };
 const applyAction=async()=>{
  if(!preview?.length)return;
  const eligible=preview.filter(x=>x.ok);
  if(!eligible.length)return toast.error("No eligible cases");
  if(risky.has(action)&&typed!=="CONFIRM")return toast.error("Type CONFIRM for sensitive operations");
  if(!window.confirm("Apply "+readable(action)+" to "+eligible.length+" cases? External emails and WhatsApps are NOT sent."))return;
  setBusy(true);
  try{
   const ids=eligible.map(x=>x.id), expected:Record<string,{status?:string;stage?:string}>={};
   for(const item of eligible)expected[item.id]={status:item.status,stage:item.stage};
   const response=await rpc("rk_case_bulk_apply",{p_kind:kind,p_ids:ids,p_action:action,p_note:note,p_expected:expected,p_operation_id:crypto.randomUUID()});
   setResult(response);setPreview(null);
   toast.success(response.applied+" operations saved"+(response.skipped?" · "+response.skipped+" skipped":""));
   if(response.applied) {
    // Retain successfully processed records so staff can send factual batch notices
    // without hunting for and reselecting the same student cases.
    setSelected(new Set((response.items||[]).filter((item:OperationResult)=>item.ok).map((item:OperationResult)=>item.id)));
    if(action==="start_review")setEmailMode("triage_under_review");
    if(action==="acknowledge_received")setEmailMode("triage_received");
    await load();
   }
  }catch(e){toast.error(e instanceof Error?e.message:"Bulk operation failed");}
  finally{setBusy(false);}
 };
 const viewCase=async(row:CaseRow)=>{
  setView(row);setPacket(null);setThread([]);
  try{
   const requests:Promise<any>[]=[rpc("rk_case_collaboration_list",{p_kind:row.kind,p_case_id:row.id})];
   if(row.kind!=="wil")requests.push(rpc("rk_case_profile_packet",{p_kind:row.kind,p_case_id:row.id}));
   const result=await Promise.allSettled(requests);
   if(result[0].status==="fulfilled")setThread(result[0].value||[]);
   if(result[1]?.status==="fulfilled")setPacket(result[1].value);
  }catch{/* The case row still provides its safe summary. */}
 };
 const post=async()=>{
  if(!view||comment.trim().length<4)return toast.error("Enter an internal note");
  setBusy(true);
  try{await rpc("rk_case_collaboration_post",{p_kind:view.kind,p_case_id:view.id,p_message:comment,p_shared:share});setComment("");setThread(await rpc("rk_case_collaboration_list",{p_kind:view.kind,p_case_id:view.id}));toast.success("Private case discussion updated");}
  catch(e){toast.error(e instanceof Error?e.message:"Could not save collaboration note");}
  finally{setBusy(false);}
 };
 const emailPreview=async()=>{
  if(kind==="wil")return toast.error("WIL correspondence uses its own department workflow");
  if(!chosen.length)return toast.error("Select cases first");
  setBusy(true);setEmailDrafts([]);
  try{
   const ids=chosen.slice(0,5),result=await edge({action:"bulk_preview",kind,ids,template_key:emailMode,message:""});
   setEmailDrafts(result.items||[]);
   toast.info("Showing "+ids.length+" personalised, fixed-wording draft(s). The Gmail batch limit is five.");
  }catch(e){toast.error(e instanceof Error?e.message:"Could not preview emails");}
  finally{setBusy(false);}
 };
 const sendEmails=async()=>{
  const eligible=emailDrafts.filter(x=>x.ok);
  if(!eligible.length)return toast.error("No approved draft emails");
  if(!window.confirm("Send "+eligible.length+" factual service emails with a branded PDF through your linked Gmail account? This is an EXTERNAL send."))return;
  setBusy(true);
  try{
   const ids=eligible.map(x=>x.id);
   const requests=eligible.map(x=>({id:x.id,request_id:crypto.randomUUID(),expected_status:x.status,expected_document_stage:x.document_signal?.stage,preview_hash:x.preview_hash}));
   const outcome=await edge({action:"bulk_send",kind,ids,requests,batch_id:crypto.randomUUID(),confirmed:true,template_key:emailMode,message:""});
   toast.info((outcome.succeeded||0)+" Gmail messages accepted; "+(outcome.failed||0)+" not sent. Check delivery history for details.");
   setEmailDrafts([]);setSelected(prev=>{const next=new Set(prev);for(const item of outcome.results||[])if(item.sent)next.delete(item.id);return next;});
  }catch(e){toast.error(e instanceof Error?e.message:"Gmail send failed");}
  finally{setBusy(false);}
 };
 const whatsappPreview=async()=>{
  if(kind==="wil")return toast.error("WIL contacts use their own departmental desk");
  if(!chosen.length)return toast.error("Select one or more cases to prepare manual WhatsApp drafts");
  setBusy(true);setWhatsappDrafts([]);setHandoffs({});
  try{
   const ids=chosen.slice(0,5);
   // Batch preparation only. Every external send is explicitly handled by an operator.
   const prepared=await Promise.all(ids.map(async id=>{
    try{
     const d=await edge({action:"whatsapp_preview",kind,target_id:id,template_key:emailMode,message:""});
     return {id,ok:true,...d} as WaDraft;
    }catch(e){return {id,ok:false,error:e instanceof Error?e.message:"Unavailable"} as WaDraft;}
   }));
   setWhatsappDrafts(prepared);
   toast.info(prepared.filter(x=>x.ok&&x.can_open).length+" WhatsApp draft(s) ready. Each requires a separate manual Send.");
  }finally{setBusy(false);}
 };
 const prepareWhatsapp=async(draft:WaDraft)=>{
  if(!draft.ok||!draft.can_open||!draft.case||!draft.preview_hash)return toast.error("No contactable, verified preview for this case");
  if(!window.confirm("Create an audited WhatsApp draft for this student? No message is sent automatically."))return;
  setBusy(true);
  try{
   const d=await edge({action:"whatsapp_handoff",kind,target_id:draft.id,template_key:emailMode,message:"",
    operator_confirmed:true,request_id:crypto.randomUUID(),expected_status:draft.case.status,
    expected_document_stage:draft.case.document_signal.stage,preview_hash:draft.preview_hash});
   setHandoffs(old=>({...old,[draft.id]:{id:d.handoff_id,url:d.url}}));
   toast.info("Handoff recorded. Use Open WhatsApp below and manually press Send.");
  }catch(e){toast.error(e instanceof Error?e.message:"WhatsApp handoff failed");}
  finally{setBusy(false);}
 };
 const markWhatsappSent=async(id:string)=>{
  const prepared=handoffs[id];
  if(!prepared||!window.confirm("Did you actually press Send in WhatsApp Business for this student? This records an operator report, not delivery."))return;
  setBusy(true);
  try{
   await edge({action:"whatsapp_mark_sent",handoff_id:prepared.id,operator_confirmed:true});
   setHandoffs(prev=>({...prev,[id]:{...prepared,reported:true}}));
   toast.success("Operator-reported WhatsApp send recorded. No delivery receipt was implied.");
  }catch(e){toast.error(e instanceof Error?e.message:"Handoff audit failed");}
  finally{setBusy(false);}
 };
 const summary=OPTIONS.find(x=>x.id===action)!;
 return <AdminLayout>
  <SEO noIndex title="God Mode Case Command Center | ResKonnect" description="Private, audited bulk operations, triage communication and supervised residence handovers"/>
  <div className="rk-motion space-y-5">
   <section className="rk-skeuo-frame rounded-3xl bg-[linear-gradient(125deg,#071326,#173c76)] p-5 text-white sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#F5B32F]">ResKonnect · God Mode OS</p>
     <h1 className="mt-2 text-2xl font-black sm:text-4xl">Case Command Center</h1>
     <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">Triage dozens of applications, reservations and WIL submissions. Delegate eligibility work to residence teams, keep an internal conversation and approve the final handover yourself.</p></div>
     <Badge className="border border-[#f5b32f]/40 bg-[#f5b32f]/15 text-[#ffda8b]"><ShieldCheck className="mr-1 h-4 w-4"/>God Mode MFA + audit</Badge></div>
    <div className="mt-5 flex flex-wrap gap-2"><Button asChild variant="outline" className="border-white/35 bg-white/10 text-white"><Link to="/admin/communications?tab=email">Full Communications Dock <ArrowRight className="ml-1 h-4 w-4"/></Link></Button>
     <Button asChild variant="outline" className="border-white/35 bg-white/10 text-white"><Link to="/admin/studio">Visual Studio</Link></Button>
     <Button asChild variant="outline" className="border-white/35 bg-white/10 text-white"><Link to="/admin/wil">WIL Placement Office</Link></Button></div>
   </section>
   <div className="rk-stagger-list grid gap-3 sm:grid-cols-3">
    {([["On this page",rows.length],["Selected",chosen.length],["Matching queue",total]] as const).map(([label,value])=><div key={label} className="rk-neo-stat p-4"><p className="text-[11px] font-black uppercase tracking-widest text-[#536985]">{label}</p><p className="mt-1 text-3xl font-black text-[#071326]">{value.toLocaleString("en-ZA")}</p></div>)}
   </div>
   <Card className="rk-neo-panel"><CardContent className="space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Case type">
     {([["reservation","Reservations",ClipboardList],["application","Applications",UsersRound],["wil","WIL",BriefcaseBusiness]] as const).map(([key,label,Icon])=><Button key={key} size="sm" variant={kind===key?"default":"outline"} aria-pressed={kind===key} onClick={()=>changeKind(key)}><Icon className="mr-1.5 h-4 w-4"/>{label}</Button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_auto]">
     <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Search case rows" placeholder="Search student, residence, campus or status" className="pl-9" value={query} onChange={e=>setQuery(e.target.value)}/></div>
     <Select value={stage} onValueChange={v=>{setStage(v);setOffset(0);setSelected(new Set());}}><SelectTrigger aria-label="Review stage"><SelectValue/></SelectTrigger><SelectContent>{["all","untriaged","received","under_review","documents_required","landlord_review","ready_for_handover","handover_approved","closed"].map(x=><SelectItem key={x} value={x}>{readable(x)}</SelectItem>)}</SelectContent></Select>
     <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
    </div>
    {error?<p role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">{error}. Sign in to a God Mode admin account and complete MFA.</p>:null}
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div className="flex items-center gap-2"><Checkbox id="rk-select-page" checked={filtered.length>0&&filtered.every(r=>selected.has(r.id))} onCheckedChange={checked=>checked?selectAll():setSelected(new Set())}/><Label htmlFor="rk-select-page">Select visible page ({Math.min(filtered.length,75)} max)</Label></div>
     <p className="text-xs text-muted-foreground">Operations are always previewed; never silently applied to filtered-out records.</p>
    </div>
    <div className="rk-stagger-list grid max-h-[520px] gap-2 overflow-auto pr-1 md:grid-cols-2">
     {filtered.map(r=><div key={r.id} className={"rk-neo-panel flex min-w-0 gap-3 rounded-xl p-3 "+(selected.has(r.id)?"ring-2 ring-[#2563eb]":"")}>
      <Checkbox aria-label={"Select "+(r.student_name||r.id)} checked={selected.has(r.id)} onCheckedChange={()=>toggle(r.id)}/>
      <div className="min-w-0 flex-1">
       <p className="truncate text-sm font-black">{r.student_name||"Student profile pending"}</p>
       <p className="truncate text-xs text-muted-foreground">{r.residence_name||r.campus||"WIL intake"} · {readable(r.status)}</p>
       <div className="mt-2 flex flex-wrap gap-1"><Badge variant="outline" className="text-[10px]">{readable(r.stage)}</Badge>
        {r.document_readiness?.ready?<Badge className="bg-emerald-600 text-white text-[10px]">Evidence verified</Badge>:
         <Badge variant="outline" className="border-amber-400/50 text-[10px]">Evidence pending</Badge>}
        {r.task_id&&<Badge variant="secondary" className="text-[10px]">Residence: {readable(r.task_status)}</Badge>}
       </div>
      </div>
      <Button size="sm" variant="outline" onClick={()=>void viewCase(r)}>Profile</Button>
     </div>)}
     {!loading&&!filtered.length&&!error&&<p className="col-span-full py-9 text-center text-sm text-muted-foreground">No cases in this queue. Change filters or select another page.</p>}
    </div>
    <div className="flex items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={offset===0||loading} onClick={()=>{setOffset(Math.max(0,offset-60));setSelected(new Set());}}>Previous</Button><span className="text-xs text-muted-foreground">{total?offset+1:0}–{Math.min(offset+rows.length,total)} of {total}</span><Button variant="outline" size="sm" disabled={loading||offset+60>=total} onClick={()=>{setOffset(offset+60);setSelected(new Set());}}>Next</Button></div>
   </CardContent></Card>
   <div className="grid gap-4 lg:grid-cols-2">
    <Card className="rk-neo-panel"><CardContent className="space-y-4 p-5">
     <div><h2 className="flex items-center gap-2 text-lg font-black"><Workflow className="h-5 w-5 text-[#2563eb]"/>Bulk operations</h2><p className="mt-1 text-xs text-muted-foreground">Safe preflight and per-case audit. A review stage is not a verified decision.</p></div>
     <div><Label>Operation</Label><Select value={action} onValueChange={v=>setAction(v as Action)}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{OPTIONS.filter(x=>kind!=="wil"||!["delegate_review","mark_eligible","approve_handover","confirm_reservation","approve_application","reject_application","cancel_reservation"].includes(x.id)).filter(x=>(kind==="reservation"||!["confirm_reservation","cancel_reservation"].includes(x.id))&&(kind==="application"||!["approve_application","reject_application"].includes(x.id))).map(x=><SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select></div>
     <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-[#174171]">{summary.hint}</p>
     <div><Label htmlFor="rk-bulk-note">Operational reason / internal note</Label><Textarea id="rk-bulk-note" rows={3} maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional for receipt/review; required for evidence requests, private notes and follow-ups"/></div>
     <Button onClick={()=>void previewAction()} disabled={busy||!chosen.length} className="w-full"><FileCheck2 className="mr-2 h-4 w-4"/>Preview {chosen.length} selected</Button>
     {preview&&<div className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3"><strong className="text-sm">Eligible: {preview.filter(x=>x.ok).length}/{preview.length}</strong><Badge variant="outline">No changes yet</Badge></div>
      <div className="max-h-44 space-y-1 overflow-y-auto">{preview.map(x=><p key={x.id} className={"text-xs "+(x.ok?"text-emerald-700":"text-amber-700")}>{x.ok?"✓":"Blocked"} · {x.id.slice(0,8)} · {x.reason||readable(x.stage)+" → "+summary.label}</p>)}</div>
      {risky.has(action)&&<div><Label htmlFor="rk-sensitive-confirm">Type CONFIRM to authorise this sensitive operation</Label><Input id="rk-sensitive-confirm" value={typed} onChange={e=>setTyped(e.target.value)} autoComplete="off"/></div>}
      <Button className="rk-clay-action w-full" disabled={busy||!preview.some(x=>x.ok)||(risky.has(action)&&typed!=="CONFIRM")} onClick={()=>void applyAction()}><CheckCheck className="mr-2 h-4 w-4"/>Apply eligible cases</Button>
     </div>}
     {result&&<div role="status" className="rounded-xl border bg-muted/20 p-3 text-sm"><p className="font-black">{result.applied} applied · {result.skipped} skipped</p>{result.items.filter(x=>!x.ok).map(x=><p key={x.id} className="mt-1 text-xs text-amber-700">{x.id.slice(0,8)}: {x.reason}</p>)}</div>}
    </CardContent></Card>
    <Card className="rk-neo-panel"><CardContent className="space-y-4 p-5">
     <div><h2 className="flex items-center gap-2 text-lg font-black"><Mail className="h-5 w-5 text-[#2563eb]"/>Batch communications</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Factual service receipts can be sent before document verification. Final approval, formal decision and document-specific correspondence still require review.</p></div>
     <div><Label>Approved fixed-wording template</Label><Select value={emailMode} onValueChange={v=>setEmailMode(v as "triage_received"|"triage_under_review")}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="triage_received">We received your submission</SelectItem><SelectItem value="triage_under_review">Your submission is under review</SelectItem></SelectContent></Select></div>
     {kind==="wil"?<div className="rounded-xl border p-4 text-sm"><p>WIL external communications remain in the dedicated WIL department to preserve its approval workflows.</p><Button asChild variant="outline" className="mt-2"><Link to="/admin/wil">Open WIL</Link></Button></div>:<>
      <Button className="w-full" variant="outline" disabled={busy||!chosen.length} onClick={()=>void emailPreview()}><Mail className="mr-2 h-4 w-4"/>Preview up to 5 Gmail + PDF messages</Button>
      {emailDrafts.length>0&&<div className="space-y-3 rounded-xl border p-3">
       <p className="text-xs font-bold">Individual, personalised drafts · {emailDrafts.filter(x=>x.ok).length} ready</p>
       <div className="max-h-56 space-y-3 overflow-auto">{emailDrafts.map(x=><div key={x.id} className="rounded-lg border bg-background p-2.5"><p className="text-xs font-black">{x.label||x.id.slice(0,8)} · {x.ok?"Ready":"Blocked"}</p>{x.ok?<><p className="mt-1 text-xs font-bold">{x.subject}</p><p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">{x.body}</p></>:<p className="text-xs text-amber-700">{x.error}</p>}</div>)}</div>
       <Button className="rk-clay-action w-full" disabled={busy||!emailDrafts.some(x=>x.ok)} onClick={()=>void sendEmails()}><Send className="mr-2 h-4 w-4"/>Send via connected Gmail (max 5)</Button>
      </div>}
      <div className="border-t pt-4">
       <h3 className="flex items-center gap-2 text-sm font-black"><MessageCircle className="h-4 w-4 text-emerald-600"/>Manual WhatsApp batch handoff</h3>
       <p className="mt-1 text-xs text-muted-foreground">Prepare up to five individual WhatsApp service messages in one batch. You must open each draft and press Send separately in WhatsApp Business. No automatic mass-spam dispatch.</p>
       <Button className="mt-3 w-full" variant="outline" disabled={busy||!chosen.length} onClick={()=>void whatsappPreview()}>Preview up to 5 selected WhatsApp messages</Button>
       {whatsappDrafts.length>0&&<div className="mt-2 max-h-[500px] space-y-3 overflow-y-auto">
        {whatsappDrafts.map(draft=><div key={draft.id} className="space-y-2 rounded-xl border p-3">
         <p className="text-xs font-semibold">Case {draft.id.slice(0,8)} · {draft.ok?draft.phone_hint||"Contact not provided":"Cannot prepare"}</p>
         {!draft.ok?<p className="text-xs text-amber-700">{draft.error}</p>:
          <><Textarea readOnly value={draft.message||""} rows={5} className="text-xs"/>
          {!handoffs[draft.id]&&<Button className="w-full" variant="outline" disabled={busy||!draft.can_open} onClick={()=>void prepareWhatsapp(draft)}>Prepare audited WhatsApp link</Button>}
          {handoffs[draft.id]&&<div className="grid gap-2 sm:grid-cols-2">
           <Button asChild variant="outline"><a href={handoffs[draft.id].url} target="_blank" rel="noopener noreferrer">Open WhatsApp to send</a></Button>
           <Button variant={handoffs[draft.id].reported?"secondary":"default"} disabled={busy||handoffs[draft.id].reported===true} onClick={()=>void markWhatsappSent(draft.id)}>{handoffs[draft.id].reported?"Operator marked sent":"I pressed Send · record"}</Button>
          </div>}</>}
        </div>)}
       </div>}
       {chosen.length>5&&<p className="text-xs text-muted-foreground">Five drafts per preparation batch. Complete this batch, then adjust the selection for the remaining students.</p>}
      </div>
      <Button asChild variant="link" className="w-full"><Link to={"/admin/communications?tab=email&kind="+kind}>Open full document-reviewed communications <ArrowRight className="ml-1 h-4 w-4"/></Link></Button>
     </>}
    </CardContent></Card>
   </div>
  </div>
  <Dialog open={!!view} onOpenChange={v=>{if(!v)setView(null);}}><DialogContent className="max-h-[92dvh] max-w-2xl overflow-auto"><DialogHeader><DialogTitle>Student eligibility workspace</DialogTitle><DialogDescription>Internal private profile summary and case history. No identity file paths are shared here.</DialogDescription></DialogHeader>{view&&<div className="space-y-4">
   <div className="grid gap-2 sm:grid-cols-2">{([["Student",view.student_name],["Residence",view.residence_name],["Status",readable(view.status)],["Review",readable(view.stage)],["Campus",view.campus],["Funding",view.funding_type]] as const).map(([key,value])=><div key={key} className="rk-neo-stat p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{key}</p><p className="mt-1 text-sm font-black">{value||"Not recorded"}</p></div>)}</div>
   {packet&&<div className="space-y-2 rounded-xl border p-3"><p className="text-sm font-black">Profile for eligibility</p><p className="text-xs">Student number: {packet.student?.student_number||"Not supplied"} · Course: {packet.student?.course||"Not supplied"}</p><p className="text-xs">Academic year: {packet.student?.academic_year||"Unknown"} · Funding: {packet.student?.funding_type||"Not supplied"}</p><p className="text-xs font-bold">{packet.document_readiness?.ready?"Required evidence verified":"Required document verification pending"}</p>{(packet.document_readiness?.missing||[]).map((msg:string)=><p key={msg} className="text-xs text-amber-700">• {msg}</p>)}</div>}
   <h3 className="text-sm font-black">Private operations discussion</h3>
   <div className="max-h-48 space-y-2 overflow-auto">{thread.length?thread.map(x=><div key={x.id} className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">{new Date(x.created_at).toLocaleString("en-ZA")} · {readable(x.visibility)}</p><p className="mt-1 whitespace-pre-wrap text-xs">{x.message}</p></div>):<p className="text-xs text-muted-foreground">No internal notes in the workflow yet. Acknowledge the case to create its operations workspace.</p>}</div>
   <Textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} maxLength={2000} placeholder="Record an internal case instruction or clarification"/>
   <div className="flex items-center gap-2"><Checkbox checked={share} id="rk-shared-note" onCheckedChange={v=>setShare(v===true)}/><Label htmlFor="rk-shared-note">Share with assigned residence team (never students)</Label></div>
   <Button disabled={busy||comment.trim().length<4} onClick={()=>void post()}>Post secure internal note</Button>
  </div>}</DialogContent></Dialog>
 </AdminLayout>;
}
