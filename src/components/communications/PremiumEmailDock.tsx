import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BadgeCheck, CheckCircle2, ChevronLeft, CircleAlert, Clock3, FileDown, FileText, Inbox, Layers3, Mail, RefreshCw, Search, Send, ShieldCheck, Unplug, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Mode="admin"|"landlord";
type Kind="application"|"reservation"|"housing_lead"|"support_enquiry";
type Template="status_update"|"feedback"|"documents_needed"|"next_steps"|"enquiry_response"|"viewing_invite"|"follow_up"|"reservation_confirmation"|"application_acknowledgement"|"resolution_summary"|"reminder";
type Panel="inbox"|"compose"|"activity";
type View="email"|"status";
interface Target{id:string;kind:Kind;label:string;status:string;email_hint:string|null;residence_name:string|null;created_at:string;can_email:boolean}
interface Preview{subject:string;body:string;html:string;pdf_filename:string;recipient_hint:string;status:string}
interface History{id:string;target_kind:Kind;target_id:string;recipient_email:string;template_key:string;delivery_status:string;subject:string;created_at:string;failure_code:string|null;pdf_attached:boolean;batch_id:string|null}
interface StatusPreview{kind:Kind;new_status:string;requested:number;eligible:number;blocked:number;high_impact:boolean;records:{id:string;eligible:boolean;reason:string|null;current_status:string|null}[];warnings:string[]}
interface BatchResult{id:string;success:boolean;reason?:string}

const kinds:Record<Kind,string>={application:"Applications",reservation:"Reservations",housing_lead:"Accommodation enquiries",support_enquiry:"Service enquiries"};
const templates:Record<Kind,{key:Template;label:string}[]>={
 application:[{key:"status_update",label:"Status update"},{key:"feedback",label:"Application feedback"},{key:"documents_needed",label:"Documents required"},{key:"next_steps",label:"Next steps"},{key:"follow_up",label:"Follow-up"},{key:"application_acknowledgement",label:"Application acknowledgement"},{key:"reminder",label:"Reminder"}],
 reservation:[{key:"status_update",label:"Reservation update"},{key:"feedback",label:"Reservation feedback"},{key:"next_steps",label:"Next steps"},{key:"viewing_invite",label:"Viewing arrangements"},{key:"follow_up",label:"Follow-up"},{key:"reservation_confirmation",label:"Confirmed reservation"},{key:"reminder",label:"Reminder"}],
 housing_lead:[{key:"enquiry_response",label:"Enquiry response"},{key:"viewing_invite",label:"Viewing invitation"},{key:"feedback",label:"Feedback"},{key:"follow_up",label:"Follow-up"},{key:"reminder",label:"Reminder"}],
 support_enquiry:[{key:"enquiry_response",label:"Enquiry response"},{key:"feedback",label:"Service feedback"},{key:"next_steps",label:"Next steps"},{key:"follow_up",label:"Follow-up"},{key:"resolution_summary",label:"Resolution summary"}]
};
const statusOptions:Record<"application"|"reservation",{key:string;label:string}[]>={
 application:[{key:"under_review",label:"Under review"},{key:"documents_required",label:"Documents required"},{key:"conditionally_approved",label:"Conditionally approved"},{key:"approved",label:"Approved"},{key:"rejected",label:"Rejected"}],
 reservation:[{key:"contacted",label:"Contacted"},{key:"provisional_hold",label:"Provisional hold"},{key:"confirmed",label:"Confirmed"},{key:"cancelled",label:"Cancelled"}]
};
const preset:Partial<Record<Template,string>>={
 feedback:"Thank you for your patience. Here is the feedback on your record:\n",
 documents_needed:"Please review the list of outstanding documents in your dashboard and upload them securely:\n",
 follow_up:"We are following up on your previous correspondence. The next action is:\n",
 viewing_invite:"Viewing date and time:\nLocation:\nContact or check-in instructions:\n",
 enquiry_response:"Thank you for contacting us. Our response to your enquiry is:\n",
 resolution_summary:"Summary of the issue and how it was resolved:\n",
 reminder:"This is a reminder to complete the following next step:\n"
};
const pretty=(s:string)=>s.replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase());
const isKind=(s:string|null):s is Kind=>!!s&&Object.prototype.hasOwnProperty.call(kinds,s);
const wrapError=async(error:any)=>{let message=error?.message||"Request failed";try{const json=await error.context?.json?.();if(typeof json?.error==="string")message=json.error;}catch{/* No JSON response. */}return message;};

export default function PremiumEmailDock({mode}:{mode:Mode}){
 const [params,setParams]=useSearchParams();
 const initialKind=isKind(params.get("kind"))?params.get("kind") as Kind:"application";
 const firstKind=mode==="landlord"&&initialKind==="support_enquiry"?"application":initialKind;
 const [kind,setKind]=useState<Kind>(firstKind);
 const [selectedId,setSelectedId]=useState(params.get("target")||"");
 const [panel,setPanel]=useState<Panel>("inbox");
 const [view,setView]=useState<View>("email");
 const [targets,setTargets]=useState<Target[]>([]);
 const [history,setHistory]=useState<History[]>([]);
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [search,setSearch]=useState("");
 const [template,setTemplate]=useState<Template>(templates[firstKind][0].key);
 const [message,setMessage]=useState("");
 const [attachPdf,setAttachPdf]=useState(true);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const [confirmPhrase,setConfirmPhrase]=useState("");
 const [connection,setConnection]=useState<{connected:boolean;email:string|null}|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState<null|"connect"|"disconnect"|"preview"|"pdf"|"send"|"status_preview"|"status_apply">(null);
 const [loading,setLoading]=useState(false);
 const [progress,setProgress]=useState<{done:number;total:number}|null>(null);
 const [batchResults,setBatchResults]=useState<BatchResult[]>([]);
 const [nextStatus,setNextStatus]=useState("");
 const [statusReason,setStatusReason]=useState("");
 const [statusPreview,setStatusPreview]=useState<StatusPreview|null>(null);
 const [highImpactApproved,setHighImpactApproved]=useState(false);
 const stopRef=useRef(false);

 const invoke=useCallback(async(fn:string,body:Record<string,unknown>)=>{
   const {data,error}=await supabase.functions.invoke(fn,{body});
   if(error)throw new Error(await wrapError(error));
   if(data?.error)throw new Error(String(data.error));
   return data;
 },[]);
 const loadAccount=useCallback(async()=>{try{const data=await invoke("gmail-connect",{action:"status"});setConnection({connected:!!data.connected,email:data.email||null});setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load Gmail account");}},[invoke]);
 const loadHistory=useCallback(async()=>{try{const data=await invoke("reskonnect-email",{action:"history"});setHistory(data.items||[]);}catch(e){console.warn("Email history unavailable",e);}},[invoke]);
 const loadRecords=useCallback(async()=>{
   setLoading(true);
   try{const data=await invoke("reskonnect-email",{action:"list",kind});setTargets(data.items||[]);}
   catch(e){setTargets([]);toast.error(e instanceof Error?e.message:"Could not load records");}
   finally{setLoading(false);}
 },[invoke,kind]);
 useEffect(()=>{void loadAccount();void loadHistory();},[loadAccount,loadHistory]);
 useEffect(()=>{void loadRecords();},[loadRecords]);

 const selected=targets.find(row=>row.id===selectedId);
 const visible=useMemo(()=>targets.filter(row=>(row.label+" "+row.status+" "+(row.residence_name||"")).toLowerCase().includes(search.trim().toLowerCase())),[targets,search]);
 const activeIds=selectedIds.length?selectedIds:selectedId?[selectedId]:[];
 const selectedRows=targets.filter(row=>activeIds.includes(row.id));
 const emailTargets=selectedRows.filter(row=>row.can_email);
 const focusHistory=history.filter(row=>!selectedId||(row.target_id===selectedId&&row.target_kind===kind));
 const resetPreview=()=>{setPreview(null);setConfirmed(false);setConfirmPhrase("");setBatchResults([]);setStatusPreview(null);setHighImpactApproved(false);};
 const chooseKind=(next:Kind)=>{
   setKind(next);setSelectedId("");setSearch("");setSelectedIds([]);setTemplate(templates[next][0].key);setMessage("");setNextStatus("");resetPreview();
   const nextParams=new URLSearchParams(params);nextParams.set("kind",next);nextParams.delete("target");setParams(nextParams,{replace:true});
 };
 const chooseTarget=(id:string)=>{
   setSelectedId(id);setSelectedIds([]);resetPreview();setPanel("compose");
   const nextParams=new URLSearchParams(params);nextParams.set("kind",kind);nextParams.set("target",id);setParams(nextParams,{replace:true});
 };
 const toggleBatch=(id:string,checked:boolean)=>{
   setSelectedIds(current=>checked?[...new Set([...current,id])].slice(0,25):current.filter(x=>x!==id));resetPreview();
 };
 const selectVisible=()=>{
   setSelectedIds(visible.filter(row=>row.can_email||kind==="application"||kind==="reservation").slice(0,25).map(row=>row.id));resetPreview();
 };
 const connect=async()=>{setBusy("connect");try{const data=await invoke("gmail-connect",{action:"connect"});if(!String(data.authorization_url||"").startsWith("https://accounts.google.com/"))throw Error("Google authorization URL not returned");window.location.assign(data.authorization_url);}catch(e){toast.error(e instanceof Error?e.message:"Could not connect Gmail");setBusy(null);}};
 const disconnect=async()=>{if(!window.confirm("Disconnect your Gmail from ResKonnect? Email history will remain."))return;setBusy("disconnect");try{await invoke("gmail-connect",{action:"disconnect"});setConnection({connected:false,email:null});toast.success("Gmail disconnected");}catch(e){toast.error(e instanceof Error?e.message:"Could not disconnect");}finally{setBusy(null);}};
 const previewEmail=async()=>{
   const row=emailTargets[0];if(!row){toast.error("Select at least one record with a valid recipient");return;}
   setBusy("preview");resetPreview();
   try{const data=await invoke("reskonnect-email",{action:"preview",kind,target_id:row.id,template_key:template,message});setPreview(data);setPanel("compose");}
   catch(e){toast.error(e instanceof Error?e.message:"Preview failed");}
   finally{setBusy(null);}
 };
 const downloadPdf=async()=>{
   const row=emailTargets[0];if(!row)return;
   setBusy("pdf");
   try{
     const data=await invoke("reskonnect-email",{action:"pdf_preview",kind,target_id:row.id,template_key:template,message});
     const decoded=atob(data.base64);const bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
     const object=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
     const anchor=document.createElement("a");anchor.href=object;anchor.download=data.filename||"ResKonnect.pdf";
     document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(object),5000);
   }catch(e){toast.error(e instanceof Error?e.message:"PDF preview unavailable");}
   finally{setBusy(null);}
 };
 const send=async()=>{
   const rows=emailTargets.slice(0,20);
   if(!preview||!confirmed||!connection?.connected||rows.length===0)return;
   if(rows.length>1&&confirmPhrase!=="SEND "+rows.length){toast.error("Enter SEND "+rows.length+" to authorize this batch");return;}
   setBusy("send");stopRef.current=false;setProgress({done:0,total:rows.length});const results:BatchResult[]=[];
   const batchId=rows.length>1?crypto.randomUUID():undefined;
   for(const row of rows){
     if(stopRef.current)break;
     try{
       const data=await invoke("reskonnect-email",{
         action:"send",kind,target_id:row.id,template_key:template,message,
         attach_pdf:attachPdf,batch_id:batchId,idempotency_key:crypto.randomUUID()
       });
       results.push({id:row.id,success:!!data.sent,reason:data.sent?undefined:"Gmail did not acknowledge message"});
     }catch(e){results.push({id:row.id,success:false,reason:e instanceof Error?e.message:"Failed"});}
     setProgress({done:results.length,total:rows.length});
   }
   setBatchResults(results);setBusy(null);setConfirmed(false);setConfirmPhrase("");setPreview(null);
   setPanel("activity");
   const sent=results.filter(r=>r.success).length;
   if(sent)toast.success(sent+" email"+(sent===1?"":"s")+" accepted by Gmail");
   if(sent!==results.length||stopRef.current)toast.warning((results.length-sent)+" failed or uncertain; review delivery logs before retrying");
   void loadHistory();void loadAccount();
 };
 const reviewStatus=async()=>{
   if(kind!=="application"&&kind!=="reservation"){toast.error("Bulk status changes apply to applications or reservations");return;}
   if(!activeIds.length||activeIds.length>25||!nextStatus){toast.error("Select up to 25 records and a status");return;}
   setBusy("status_preview");resetPreview();
   try{const data=await invoke("reskonnect-bulk-status",{action:"preview",kind,target_ids:activeIds,new_status:nextStatus});setStatusPreview(data);setPanel("compose");}
   catch(e){toast.error(e instanceof Error?e.message:"Status preview failed");}
   finally{setBusy(null);}
 };
 const applyStatus=async()=>{
   if(!statusPreview||!activeIds.length||confirmPhrase!=="APPLY "+activeIds.length||!confirmed)return;
   if(statusPreview.high_impact&&!highImpactApproved){toast.error("Approve the high-impact change warning first");return;}
   setBusy("status_apply");
   try{
     const expected=Object.fromEntries(statusPreview.records.filter(r=>r.current_status).map(r=>[r.id,r.current_status]));
     const out=await invoke("reskonnect-bulk-status",{
       action:"apply",kind,target_ids:activeIds,new_status:nextStatus,expected_statuses:expected,
       batch_id:crypto.randomUUID(),reason:statusReason,confirmed:true,confirm_phrase:"APPLY "+activeIds.length
     });
     setBatchResults((out.results||[]).map((row:{id:string;updated:boolean;reason?:string})=>({id:row.id,success:row.updated,reason:row.reason})));
     toast.success(out.updated+" status update"+(out.updated===1?"":"s")+" applied");
     if(out.skipped)toast.warning(out.skipped+" records skipped or blocked by existing rules");
     setSelectedIds([]);setStatusPreview(null);setConfirmed(false);setConfirmPhrase("");
     await loadRecords();setPanel("activity");
   }catch(e){toast.error(e instanceof Error?e.message:"Bulk update failed");}
   finally{setBusy(null);}
 };
 const kindOptions=(Object.keys(kinds) as Kind[]).filter(x=>mode==="admin"||x!=="support_enquiry");
 const isBatch=activeIds.length>1;
 const allowStatus=kind==="application"||kind==="reservation";
 const statusChoices=allowStatus?statusOptions[kind]:[];
 return <div className="space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-800 bg-[#071326] p-4 text-white shadow-xl sm:p-5">
     <div className="flex items-center gap-3">
       <img src="/icon-192.png" alt="ResKonnect" className="h-12 w-12 rounded-xl bg-white object-contain p-1"/>
       <div><div className="flex flex-wrap gap-2"><Badge className="bg-amber-400 text-slate-950 hover:bg-amber-400"><Mail className="mr-1 h-3 w-3"/>ResKonnect Mail</Badge><Badge variant="outline" className="border-slate-600 text-slate-200">Premium communications dock</Badge></div>
       <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Emails, documents & decisions</h2>
       <p className="text-xs text-slate-300">Built-in service correspondence · branded PDFs · audited bulk workflows</p></div>
     </div>
     <div className="flex flex-wrap items-center gap-2">
       <div className="mr-2 flex items-center gap-2 text-xs">{connection?.connected?<BadgeCheck className="h-4 w-4 text-emerald-400"/>:<CircleAlert className="h-4 w-4 text-amber-400"/>}
         <span>{connection?.connected?(connection.email||"Gmail connected"):error||"Gmail not connected"}</span></div>
       <Button size="sm" variant="outline" className="border-slate-500 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={()=>void loadAccount()}><RefreshCw className="h-4 w-4"/></Button>
       {connection?.connected?<Button size="sm" variant="outline" className="border-slate-500 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={()=>void disconnect()} disabled={!!busy}><Unplug className="mr-1 h-4 w-4"/>Disconnect</Button>
         :<Button size="sm" className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={()=>void connect()} disabled={!!busy}>Connect Gmail</Button>}
     </div>
   </div>
   <div className="flex gap-2 md:hidden">{(["inbox","compose","activity"] as Panel[]).map(tab=><Button key={tab} variant={panel===tab?"default":"outline"} size="sm" onClick={()=>setPanel(tab)}>{pretty(tab)}</Button>)}</div>
   <div className="grid h-[min(80dvh,850px)] min-h-[650px] overflow-hidden rounded-[28px] border bg-background shadow-[0_28px_80px_-48px_rgba(7,19,38,.35)] md:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_315px]">
     <aside className={cn("min-h-0 min-w-0 flex-col border-r bg-muted/20",panel==="inbox"?"flex":"hidden md:flex")}>
       <div className="shrink-0 space-y-3 border-b bg-background/90 p-4">
         <div className="flex items-center justify-between"><div><p className="font-black">Record inbox</p><p className="text-xs text-muted-foreground">{targets.length} records · {selectedIds.length} selected</p></div><Inbox className="h-5 w-5 text-primary"/></div>
         <Select value={kind} onValueChange={v=>chooseKind(v as Kind)}><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger><SelectContent>{kindOptions.map(k=><SelectItem key={k} value={k}>{kinds[k]}</SelectItem>)}</SelectContent></Select>
         <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="rounded-xl bg-muted/50 pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student, status, residence"/></div>
         <div className="flex gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={selectVisible} disabled={!!busy}>Select up to 25</Button><Button size="sm" variant="ghost" onClick={()=>{setSelectedIds([]);resetPreview();}}><X className="h-4 w-4"/> Clear</Button></div>
         <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Multi-select for bulk actions</span><button className="underline" onClick={()=>void loadRecords()}>Refresh</button></div>
       </div>
       <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
         {loading?<p className="p-5 text-center text-xs text-muted-foreground">Loading records…</p>:visible.length===0?<p className="p-5 text-center text-xs text-muted-foreground">No records match your search.</p>:
         visible.map(row=><div key={row.id} className={cn("flex items-center gap-2 rounded-xl border p-2 transition hover:border-primary/30",selectedId===row.id?"border-primary bg-primary/5":"border-transparent bg-background/70")}>
           <Checkbox aria-label={"Select "+row.label} checked={selectedIds.includes(row.id)} onCheckedChange={checked=>toggleBatch(row.id,checked===true)}/>
           <button type="button" onClick={()=>chooseTarget(row.id)} className="min-w-0 flex-1 text-left">
             <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold">{row.label}</p><span className="whitespace-nowrap text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString("en-ZA",{day:"2-digit",month:"short"})}</span></div>
             <p className="truncate text-[11px] text-muted-foreground">{row.residence_name||kinds[row.kind]}</p>
             <div className="mt-1 flex items-center gap-1"><Badge variant="outline" className="max-w-full truncate text-[10px]">{pretty(row.status)}</Badge>{row.can_email?<CheckCircle2 className="h-3 w-3 text-emerald-600"/>:<CircleAlert className="h-3 w-3 text-amber-600"/>}</div>
           </button>
         </div>)}
       </div>
       <div className="border-t bg-background p-3 text-[11px] text-muted-foreground"><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-600"/>Landlords cannot view private applicant email addresses.</div>
     </aside>
     <main className={cn("min-h-0 min-w-0 flex-col",panel==="compose"?"flex":"hidden md:flex")}>
       <header className="shrink-0 border-b bg-background/95 p-4">
         <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">ResKonnect Composer</p><h3 className="text-lg font-black">{isBatch?activeIds.length+" records selected":selected?.label||"Choose a record"}</h3><p className="text-xs text-muted-foreground">{selected?.residence_name||kinds[kind]} · {selected?.email_hint||"Recipient controlled by ResKonnect"}</p></div>
           <div className="flex gap-2"><Button size="sm" variant={view==="email"?"default":"outline"} onClick={()=>{setView("email");resetPreview();}}><Send className="mr-1 h-3.5 w-3.5"/>Email</Button><Button size="sm" variant={view==="status"?"default":"outline"} onClick={()=>{setView("status");resetPreview();}} disabled={!allowStatus}><Layers3 className="mr-1 h-3.5 w-3.5"/>Bulk status</Button></div>
         </div>
       </header>
       <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
         {view==="email"?<>
           <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email context</p><p className="text-sm">{isBatch?"Personalized per applicant or reservation":"Selected record communication"}</p></div><Badge variant="outline" className="gap-1"><UsersRound className="h-3 w-3"/>{emailTargets.length} eligible recipient{emailTargets.length===1?"":"s"}</Badge></div>
           <div className="space-y-2"><Label>Email template</Label><Select value={template} onValueChange={v=>{setTemplate(v as Template);setMessage(preset[v as Template]||"");resetPreview();}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{templates[kind].map(t=><SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent></Select></div>
           <div className="space-y-2"><Label htmlFor="rk-email-context">Context / instructions</Label>
             <Textarea id="rk-email-context" className="min-h-28 resize-y" maxLength={2500} value={message} onChange={e=>{setMessage(e.target.value);resetPreview();}} placeholder="Provide clear feedback, next steps, reservation details or an enquiry response…"/>
             <p className="text-[11px] text-muted-foreground">{message.length}/2,500 · Context is personalized with each record's current status.</p>
           </div>
           <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/30 p-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary"/><div><p className="text-xs font-bold">Branded ResKonnect PDF</p><p className="text-[11px] text-muted-foreground">A4 status summary attached to every selected email</p></div></div><Checkbox aria-label="Attach branded PDF" checked={attachPdf} onCheckedChange={v=>{setAttachPdf(v===true);resetPreview();}}/></div>
           {isBatch&&<div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">Controlled batch send: maximum 20 messages per run, personalized individually, no marketing campaigns or automatic sends. Preview uses the first eligible record as a representative sample.</div>}
           <Button variant="outline" onClick={()=>void previewEmail()} disabled={!emailTargets.length||!!busy}><Mail className="mr-2 h-4 w-4"/>{busy==="preview"?"Preparing preview…":"Preview branded email"}</Button>
           {preview&&<section className="space-y-3 rounded-2xl border bg-muted/15 p-3">
             <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-muted-foreground">TO: {preview.recipient_hint}</p><p className="text-sm font-black">{preview.subject}</p></div><Button size="sm" variant="outline" onClick={()=>void downloadPdf()} disabled={busy==="pdf"}><FileDown className="mr-1 h-4 w-4"/>{busy==="pdf"?"Generating…":"Preview PDF"}</Button></div>
             <iframe title="ResKonnect branded email preview" sandbox="" srcDoc={preview.html} className="h-64 w-full rounded-xl border bg-white" loading="lazy"/>
             <p className="text-[11px] text-muted-foreground">This preview includes your ResKonnect branded footer and contextual status information. PDF download is a sample document for the first record.</p>
             <div className="flex items-start gap-2"><Checkbox id="rk-email-approved" checked={confirmed} onCheckedChange={v=>setConfirmed(v===true)}/><Label htmlFor="rk-email-approved" className="cursor-pointer text-xs leading-5">I have reviewed this communication and authorize sending individual service updates to the selected people.</Label></div>
             {isBatch&&<div className="space-y-1"><Label htmlFor="rk-email-confirm-count" className="text-xs">Type SEND {emailTargets.length} to authorize bulk sending</Label><Input id="rk-email-confirm-count" value={confirmPhrase} onChange={e=>setConfirmPhrase(e.target.value)} placeholder={"SEND "+emailTargets.length}/></div>}
             <Button className="w-full" onClick={()=>void send()} disabled={!confirmed||!connection?.connected||!!busy||(isBatch&&confirmPhrase!=="SEND "+emailTargets.length)}><Send className="mr-2 h-4 w-4"/>Send {emailTargets.length} through Gmail {attachPdf?"+ PDF":""}</Button>
           </section>}
           {!connection?.connected&&<p className="text-xs text-amber-700">Connect Gmail before sending; previews and PDF samples can still be generated.</p>}
         </>:<>
           <div className="space-y-2"><p className="text-sm font-bold">Controlled bulk status updates</p><p className="text-xs leading-5 text-muted-foreground">Updates use existing application/reservation triggers, readiness rules and notifications. They do not send external email automatically.</p></div>
           <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{activeIds.length} records selected · max 25</Badge><Badge variant="outline">{kind==="application"?"Applications":"Reservations"}</Badge></div>
           <div className="space-y-2"><Label>Destination status</Label><Select value={nextStatus} onValueChange={v=>{setNextStatus(v);resetPreview();}}><SelectTrigger><SelectValue placeholder="Choose status"/></SelectTrigger><SelectContent>{statusChoices.map(s=><SelectItem value={s.key} key={s.key}>{s.label}</SelectItem>)}</SelectContent></Select></div>
           <div className="space-y-2"><Label htmlFor="rk-bulk-reason">Reason for audit trail</Label><Textarea id="rk-bulk-reason" minLength={8} maxLength={500} value={statusReason} onChange={e=>{setStatusReason(e.target.value);resetPreview();}} placeholder="Explain why these records should change status (minimum 8 characters)…"/></div>
           <Button variant="outline" disabled={!activeIds.length||!nextStatus||!!busy||statusReason.trim().length<8} onClick={()=>void reviewStatus()}><Layers3 className="mr-2 h-4 w-4"/>Review eligibility and consequences</Button>
           {statusPreview&&<div className="space-y-3 rounded-xl border p-4">
             <p className="text-sm font-bold">{statusPreview.eligible} eligible · {statusPreview.blocked} blocked</p>
             {statusPreview.warnings.map((warning,i)=><p key={i} className="text-xs text-amber-800">{warning}</p>)}
             <div className="max-h-28 space-y-1 overflow-y-auto">{statusPreview.records.filter(r=>!r.eligible).map(r=><p className="text-[11px] text-muted-foreground" key={r.id}>{r.id.slice(0,8)}: {r.reason}</p>)}</div>
             {statusPreview.high_impact&&<div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3"><Checkbox checked={highImpactApproved} onCheckedChange={v=>setHighImpactApproved(v===true)}/><span className="text-xs font-bold text-amber-900">High-impact status change. Approval, rejection, confirmation or cancellation can affect placements and existing automations. I have verified readiness and allocation rules.</span></div>}
             <div className="flex items-start gap-2"><Checkbox checked={confirmed} onCheckedChange={v=>setConfirmed(v===true)}/><Label className="text-xs">I approve the changes and understand that existing notifications may be triggered.</Label></div>
             <div className="space-y-1"><Label className="text-xs" htmlFor="rk-bulk-phrase">Type APPLY {activeIds.length} to continue</Label><Input id="rk-bulk-phrase" value={confirmPhrase} onChange={e=>setConfirmPhrase(e.target.value)} placeholder={"APPLY "+activeIds.length}/></div>
             <Button className="w-full" disabled={!statusPreview.eligible||!confirmed||(statusPreview.high_impact&&!highImpactApproved)||confirmPhrase!=="APPLY "+activeIds.length||!!busy} onClick={()=>void applyStatus()}><BadgeCheck className="mr-2 h-4 w-4"/>Apply {statusPreview.eligible} eligible updates</Button>
           </div>}
         </>}
       </div>
       <footer className="shrink-0 border-t bg-background/95 px-4 py-3 text-[11px] text-muted-foreground"><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-600"/>Protected by ResKonnect roles, residence ownership, audit logs and Gmail send-only permission.</footer>
     </main>
     <aside className={cn("min-h-0 min-w-0 flex-col border-l bg-muted/20",panel==="activity"?"flex":"hidden 2xl:flex")}>
       <div className="shrink-0 border-b bg-background/90 p-4"><div className="flex items-center justify-between"><div><p className="font-black">Activity & context</p><p className="text-xs text-muted-foreground">Gmail sent history · no inbox access</p></div><Clock3 className="h-5 w-5 text-primary"/></div></div>
       <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
         <div className="rounded-2xl border bg-background p-3"><p className="text-xs font-bold uppercase text-muted-foreground">Current selection</p><p className="mt-2 text-lg font-black">{activeIds.length}</p><p className="text-xs text-muted-foreground">{isBatch?"Bulk correspondence":"One-to-one correspondence"}</p><p className="mt-2 text-xs">Recorded status: <strong>{selected?pretty(selected.status):"Select a record"}</strong></p></div>
         {progress&&<div className="rounded-xl border bg-background p-3"><p className="text-xs font-semibold">Batch progress: {progress.done}/{progress.total}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-blue-600" style={{width:progress.total?100*progress.done/progress.total+"%":"0%"}}/></div>{busy==="send"&&<Button size="sm" variant="outline" className="mt-2" onClick={()=>{stopRef.current=true;}}>Stop after current</Button>}</div>}
         {batchResults.length>0&&<div className="rounded-xl border bg-background p-3"><p className="text-xs font-bold">Latest batch results</p><p className="mt-1 text-sm">{batchResults.filter(r=>r.success).length} succeeded · {batchResults.filter(r=>!r.success).length} failed/skipped</p><div className="mt-2 max-h-32 space-y-1 overflow-y-auto">{batchResults.filter(r=>!r.success).map(r=><p key={r.id} className="text-[11px] text-amber-700">{r.id.slice(0,8)}: {r.reason||"Unsuccessful"}</p>)}</div></div>}
         <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase text-muted-foreground">Outgoing email history</p><button className="text-xs text-primary" onClick={()=>void loadHistory()}>Refresh</button></div>
         {focusHistory.length===0?<p className="text-xs leading-5 text-muted-foreground">No outgoing emails for this record yet. Received Gmail replies require separate inbox authorization.</p>:focusHistory.map(row=><div key={row.id} className="rounded-xl border bg-background p-3">
           <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-bold">{pretty(row.template_key)}</p><Badge variant={row.delivery_status==="sent"?"default":row.delivery_status==="failed"?"destructive":"outline"} className="text-[10px]">{pretty(row.delivery_status)}</Badge></div>
           <p className="mt-1 text-xs">{row.subject}</p><p className="mt-1 text-[11px] text-muted-foreground">{row.recipient_email} · {new Date(row.created_at).toLocaleString("en-ZA")}</p>
           {row.pdf_attached&&<p className="mt-1 text-[11px] text-primary"><FileText className="mr-1 inline h-3 w-3"/>PDF attached</p>}
           {row.failure_code&&<p className="mt-1 text-[11px] text-red-600">{row.failure_code}</p>}
         </div>)}
       </div>
       <div className="shrink-0 border-t bg-background p-3 text-[11px] text-muted-foreground"><Badge variant="secondary" className="mb-1">Transactional only</Badge><p>No bulk marketing, no private-document attachments, and no automatic state transitions from emails.</p></div>
     </aside>
   </div>
 </div>;
}
