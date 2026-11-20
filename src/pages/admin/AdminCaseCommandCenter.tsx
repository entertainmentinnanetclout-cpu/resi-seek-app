import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {ArrowRight,BriefcaseBusiness,Check,CheckCheck,ClipboardList,FileCheck2,Mail,RefreshCw,Search,ShieldCheck,UsersRound,Workflow} from "lucide-react";
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
type CaseRow={id:string;kind:Kind;student_user_id?:string|null;status:string;stage:string;student_name:string|null;student_number:string|null;campus:string|null;course:string|null;residence_name:string|null;funding_type:string|null;created_at:string;document_readiness:Docs;eligibility_decision:string|null;task_id:string|null;task_status:string|null};
type Action="acknowledge_received"|"start_review"|"request_documents"|"delegate_review"|"mark_eligible"|"mark_ineligible"|"approve_handover"|"confirm_reservation"|"approve_application"|"reject_application"|"cancel_reservation"|"internal_note"|"mark_follow_up";
type OperationResult={id:string;ok:boolean;reason?:string;status?:string;stage?:string;document_readiness?:Docs};
type Thread={id:string;message:string;visibility:string;created_at:string;sender_id:string};
const OPTIONS:{id:Action;label:string;hint:string}[]=[
 {id:"acknowledge_received",label:"Mark received",hint:"Bulk receipt: records the case and notifies the student in-app. No document verification or booking decision."},
 {id:"start_review",label:"Start review",hint:"Moves the operations stage to Under Review. An application may also change to under_review; reservations stay unconfirmed."},
 {id:"request_documents",label:"Request evidence",hint:"Flags the case as needing documents. Add a factual note; this does not verify any file."},
 {id:"delegate_review",label:"Assign to landlord",hint:"Creates a private eligibility-review task for the active residence portal. ResKonnect still signs off final handover."},
 {id:"mark_eligible",label:"ResKonnect recommends eligible",hint:"Record an evidence-based preliminary eligibility assessment with a factual note. Final handover and placement are separate steps."},
 {id:"mark_ineligible",label:"Record ineligible assessment",hint:"Document why this student is not eligible. This is an internal assessment, not yet a formal rejection; only ResKonnect finalises decisions."},
 {id:"approve_handover",label:"Approve handover",hint:"Requires eligible assessment, finished landlord task and verified identity, academic and funding evidence."},
 {id:"confirm_reservation",label:"Confirm physical reservation",hint:"Requires approved handover, verified documents and a genuine active physical-room hold."},
 {id:"approve_application",label:"Approve application",hint:"Final application approval only after ResKonnect handover sign-off and verified ID, academic and funding documents."},
 {id:"reject_application",label:"Reject ineligible application",hint:"A documented ineligible eligibility decision and factual reason are compulsory; this action is audited."},
 {id:"cancel_reservation",label:"Cancel reservation",hint:"Closes the selected non-final reservation with a reason and triggers existing room-hold release controls."},
 {id:"mark_follow_up",label:"Create follow-up task",hint:"Creates an internal follow-up task for this case, without messaging anyone externally."},
 {id:"internal_note",label:"Add private notes",hint:"Adds a ResKonnect-only note to every selected case, without altering its status."},
];
const risky=new Set<Action>(["mark_ineligible","delegate_review","approve_handover","confirm_reservation","approve_application","reject_application","cancel_reservation"]);
const readable=(s?:string|null)=>String(s||"Not set").replaceAll("_"," ");
const rpc=async(action:string,params:Record<string,unknown>)=>{
 const {data,error}=await (supabase as any).rpc(action,params);
 if(error)throw new Error(error.message||"Action failed");return data;
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
 useEffect(()=>{setPreview(null);setTyped("");},[selected,action,note,kind]);
 const filtered=useMemo(()=>rows.filter(r=>[r.student_name,r.student_number,r.residence_name,r.campus,r.status,r.stage,r.id].join(" ").toLowerCase().includes(query.toLowerCase())),[rows,query]);
 const chosen=useMemo(()=>[...selected].slice(0,75),[selected]);
 const selectAll=()=>setSelected(prev=>new Set(filtered.slice(0,75).map(r=>r.id)));
 const toggle=(id:string)=>setSelected(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});
 const changeKind=(next:Kind)=>{setKind(next);setOffset(0);setStage("all");setAction("acknowledge_received");setSelected(new Set());setView(null);};
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
      <div className="flex shrink-0 flex-col gap-2">
       <Button size="sm" variant="outline" onClick={()=>void viewCase(r)}>Case</Button>
       {r.student_user_id&&<Button size="sm" variant="outline" asChild><Link to={"/admin/students/"+r.student_user_id}>Student 360</Link></Button>}
      </div>
     </div>)}
     {!loading&&!filtered.length&&!error&&<p className="col-span-full py-9 text-center text-sm text-muted-foreground">No cases in this queue. Change filters or select another page.</p>}
    </div>
    <div className="flex items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={offset===0||loading} onClick={()=>{setOffset(Math.max(0,offset-60));setSelected(new Set());}}>Previous</Button><span className="text-xs text-muted-foreground">{total?offset+1:0}–{Math.min(offset+rows.length,total)} of {total}</span><Button variant="outline" size="sm" disabled={loading||offset+60>=total} onClick={()=>{setOffset(offset+60);setSelected(new Set());}}>Next</Button></div>
   </CardContent></Card>
   <div className="grid gap-4 lg:grid-cols-2">
    <Card className="rk-neo-panel"><CardContent className="space-y-4 p-5">
     <div><h2 className="flex items-center gap-2 text-lg font-black"><Workflow className="h-5 w-5 text-[#2563eb]"/>Bulk operations</h2><p className="mt-1 text-xs text-muted-foreground">Safe preflight and per-case audit. A review stage is not a verified decision.</p></div>
     <div><Label>Operation</Label><Select value={action} onValueChange={v=>setAction(v as Action)}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{OPTIONS.filter(x=>kind!=="wil"||!["delegate_review","mark_eligible","mark_ineligible","approve_handover","confirm_reservation","approve_application","reject_application","cancel_reservation"].includes(x.id)).filter(x=>(kind==="reservation"||!["confirm_reservation","cancel_reservation"].includes(x.id))&&(kind==="application"||!["approve_application","reject_application"].includes(x.id))).map(x=><SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select></div>
     <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-[#174171]">{summary.hint}</p>
     <div><Label htmlFor="rk-bulk-note">Operational reason / internal note</Label><Textarea id="rk-bulk-note" rows={3} maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional for receipt/review; required for eligibility assessments, evidence requests, private notes and follow-ups"/></div>
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
     <div>
      <h2 className="flex items-center gap-2 text-lg font-black"><Mail className="h-5 w-5 text-[#2563eb]"/>One Communications Dock</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Email, branded PDF, fixed God Mode triage receipts, document-reviewed messages, reply intelligence, contact activity, bulk sending, manual WhatsApp and audit history now live in one protected workspace.</p>
     </div>
     {kind==="wil"?<div className="rounded-xl border p-4 text-sm">
      WIL has its own departmental decision workflow. External WIL messages remain in the WIL office.
      <Button asChild variant="outline" className="mt-3 w-full"><Link to="/admin/wil">Open WIL</Link></Button>
     </div>:<>
      <div className="space-y-1">
       <Label>Prepare an official ResKonnect notice</Label>
       <Select value={emailMode} onValueChange={v=>setEmailMode(v as "triage_received"|"triage_under_review")}>
        <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
         <SelectItem value="triage_received">Submission received · factual acknowledgement</SelectItem>
         <SelectItem value="triage_under_review">Under review · factual notification</SelectItem>
        </SelectContent>
       </Select>
      </div>
      <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900">A triage notice is not a placement, application or funding decision. The unified dock verifies God Mode MFA and uses one Gmail delivery audit.</p>
      <Button className="w-full" asChild>
       <Link to={"/admin/communications?tab=email&kind="+kind+"&template="+emailMode+
        (chosen.length?"&cases="+encodeURIComponent(chosen.slice(0,25).join(",")):"")}>
        <Mail className="mr-2 h-4 w-4"/>Open one Email Dock · {Math.min(chosen.length,25)} selected <ArrowRight className="ml-1 h-4 w-4"/>
       </Link>
      </Button>
      {chosen.length>25&&<p className="text-xs text-muted-foreground">The first 25 selected cases can be transferred per review batch. All case records remain available in the unified dock.</p>}
     </>}
    </CardContent></Card>
   </div>
  </div>
  <Dialog open={!!view} onOpenChange={v=>{if(!v)setView(null);}}><DialogContent className="max-h-[92dvh] max-w-2xl overflow-auto"><DialogHeader><DialogTitle>Student eligibility workspace</DialogTitle><DialogDescription>Internal private profile summary and case history. No identity file paths are shared here.</DialogDescription></DialogHeader>{view&&<div className="space-y-4">
   {view.student_user_id&&<Button asChild variant="outline" size="sm"><Link to={"/admin/students/"+view.student_user_id}>Open complete Student 360 journey<ArrowRight className="ml-1.5 h-4 w-4"/></Link></Button>}
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
