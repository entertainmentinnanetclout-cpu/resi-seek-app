import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {AlarmClock,ArrowRight,BookOpenCheck,CheckCircle2,ChevronLeft,ChevronRight,ClipboardCheck,Clock3,FileCheck2,Headphones,Handshake,Home,Mail,MessageCircle,RefreshCw,Search,Send,ShieldCheck,Sparkles,UsersRound} from "lucide-react";
import {toast} from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Checkbox} from "@/components/ui/checkbox";
import {supabase} from "@/integrations/supabase/client";

type Kind="application"|"reservation"|"viewing"|"enquiry"|"onboarding"|"application_support"|"private_rental"|"student_support"|"wil"|"landlord"|"partner";
type FlowAction="begin_review"|"request_info"|"waiting_residence"|"waiting_partner"|"set_followup"|"contact_confirmed"|"complete_cycle"|"reopen"|"private_note";
type Metric={total:number;open:number;overdue:number;unanswered:number;waiting:number;post_service:number;replied_today:number};
type Item={id:string;kind:Kind;customer:string;residence_name:string;status:string;step:string;next_action:string;priority:string;
 first_response_due_at:string;next_action_due_at:string;last_human_response_at:string|null;last_human_channel:string|null;
 receipt_issued_at:string|null;overdue:boolean;needs_reply:boolean;delegated_review_open:boolean;source_created_at:string;closed_at:string|null};
type Event={event_type:string;note:string|null;channel:string|null;created_at:string};
const KINDS:[Kind,string][]=[["reservation","Reservations"],["application","Housing applications"],["viewing","Property viewings"],["enquiry","Housing enquiries"],["onboarding","New enquiries & onboarding"],["application_support","University/TVET applications"],["private_rental","Private rental requests"],["student_support","Student service desk"],["wil","WIL & placements"],["landlord","Landlord onboarding"],["partner","Partner relationships"]];
const ACTIONS:[FlowAction,string,string][]=[
 ["begin_review","Start review","Begin an internal assessment; this is not a customer response."],
 ["request_info","Waiting on customer","Create an evidence request task. Send the actual message using Communications."],
 ["waiting_residence","Track delegated residence","Only available after Case Command Center has assigned an active eligibility review."],
 ["waiting_partner","Await external partner","Internal coordination only; never grants access to private student documents."],
 ["set_followup","Schedule next touch","Set the next time ResKonnect should follow up."],
 ["contact_confirmed","Record real contact","Only after you actually sent the message or completed the conversation."],
 ["complete_cycle","Close fulfilled service","Requires a final business state and factual proof of service completion."],
 ["reopen","Reopen service care","Reopens a service follow-up only, never reverses legal decisions."],
 ["private_note","Add private note","For ResKonnect internal records; never sent to the customer."],
];
const journey=[["01","Discover","Landing → matching"],["02","Capture","Request created"],["03","Acknowledge","In-app receipt"],["04","Triage","Operator queue"],["05","Verify","Evidence & eligibility"],["06","Delegate","Residence or partner"],["07","Handover","Approved outcome"],["08","Delight","Move-in & follow-up"]];
const pretty=(v?:string|null)=>String(v||"—").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
const date=(v?:string|null)=>v?new Date(v).toLocaleString("en-ZA",{dateStyle:"medium",timeStyle:"short"}):"Not recorded";
const asDateTimeLocal=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
const nowPlus=()=>asDateTimeLocal(new Date(Date.now()+24*3600000));
const detailsUrl=(kind:Kind)=>{
 if(kind==="reservation"||kind==="application")return "/admin/cases";
 if(kind==="wil")return "/admin/wil";
 if(kind==="landlord")return "/admin/landlord-applications";
 if(kind==="partner")return "/admin/partnerships";
 if(kind==="student_support")return "/admin/operations-office?tab=service";
 if(kind==="application_support")return "/admin/student-care";
 return "/admin/operations-office";
};
const rpc=async(name:string,args:Record<string,unknown>)=>{
 const {data,error}=await (supabase as any).rpc(name,args);
 if(error)throw new Error(error.message||"Golden Service Cycle unavailable");
 return data;
};
export default function AdminGoldenServiceCycle(){
 const [filter,setFilter]=useState("overdue");
 const [kind,setKind]=useState("all");
 const [offset,setOffset]=useState(0);
 const [query,setQuery]=useState("");
 const [items,setItems]=useState<Item[]>([]);
 const [metrics,setMetrics]=useState<Metric>({total:0,open:0,overdue:0,unanswered:0,waiting:0,post_service:0,replied_today:0});
 const [selected,setSelected]=useState<Item|null>(null);
 const [events,setEvents]=useState<Event[]>([]);
 const [action,setAction]=useState<FlowAction>("begin_review");
 const [note,setNote]=useState("");
 const [nextDue,setNextDue]=useState(nowPlus);
 const [channel,setChannel]=useState("email");
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  setError("");
  try{
   const data=await rpc("rk_golden_service_queue",{p_filter:filter,p_kind:kind==="all"?null:kind,p_limit:80,p_offset:offset});
   setItems(Array.isArray(data?.items)?data.items:[]);
   setMetrics(data?.metrics||{total:0,open:0,overdue:0,unanswered:0,waiting:0,post_service:0,replied_today:0});
  }catch(e){setError(e instanceof Error?e.message:"Service queue could not be loaded");}
  finally{setLoading(false);}
 },[filter,kind,offset]);
 useEffect(()=>{void load();const id=window.setInterval(()=>{if(!document.hidden)void load(true);},60000);return()=>window.clearInterval(id);},[load]);
 const open=async(item:Item)=>{
  setSelected(item);setEvents([]);setNote("");setAction("begin_review");setConfirmed(false);setNextDue(nowPlus());
  try{const h=await rpc("rk_golden_case_history",{p_kind:item.kind,p_id:item.id});setEvents(Array.isArray(h)?h:[]);}
  catch(e){toast.error(e instanceof Error?e.message:"History unavailable");}
 };
 const apply=async()=>{
  if(!selected||busy)return;
  if(action==="contact_confirmed"&&!confirmed)return toast.error("Only record contact after the message or call truly happened.");
  if(action==="complete_cycle"&&!window.confirm("Confirm that this service is fulfilled and the business outcome is final?"))return;
  setBusy(true);
  try{
   const params={p_kind:selected.kind,p_id:selected.id,p_action:action,
    p_note:note.trim()||null,
    p_due_at:action==="set_followup"?new Date(nextDue).toISOString():null,
    p_channel:action==="contact_confirmed"?channel:null,
    p_confirm_sent:action==="contact_confirmed"&&confirmed,
    p_expected_status:selected.status};
   await rpc("rk_golden_service_action",params);
   toast.success("Next action recorded. Original business status unchanged.");
   await load(true);
   const h=await rpc("rk_golden_case_history",{p_kind:selected.kind,p_id:selected.id});
   setEvents(Array.isArray(h)?h:[]);setNote("");setConfirmed(false);
   setSelected(prev=>prev?{...prev,step:action==="complete_cycle"?"closed":action==="reopen"?"in_review":action==="contact_confirmed"?"followup":prev.step,
    last_human_response_at:action==="contact_confirmed"?new Date().toISOString():prev.last_human_response_at,
    closed_at:action==="complete_cycle"?new Date().toISOString():action==="reopen"?null:prev.closed_at}:prev);
  }catch(e){toast.error(e instanceof Error?e.message:"No change was saved");}
  finally{setBusy(false);}
 };
 const filtered=useMemo(()=>items.filter(x=>[x.customer,x.kind,x.status,x.step,x.next_action,x.residence_name,x.id].join(" ").toLowerCase().includes(query.toLowerCase())),[items,query]);
 const selectedAction=ACTIONS.find(x=>x[0]===action);
 const stats=[["Open cases",metrics.open,UsersRound],["Action overdue",metrics.overdue,AlarmClock],["No confirmed reply",metrics.unanswered,MessageCircle],["Awaiting others",metrics.waiting,Handshake],["Aftercare",metrics.post_service,Home],["Contacted today",metrics.replied_today,CheckCircle2]] as const;
 return <AdminLayout>
  <SEO noIndex title="Golden Service Cycle | ResKonnect God Mode" description="Solo-operator end-to-end service queue, verified case deadlines and task handovers"/>
  <div className="rk-motion mx-auto max-w-[1600px] space-y-5">
   <header className="rk-skeuo-frame overflow-hidden rounded-[26px] bg-[linear-gradient(125deg,#071326,#153b74)] p-5 text-white sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
     <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#F5B32F]"><Sparkles className="h-4 w-4"/> ResKonnect · One-Person Service OS</p>
      <h1 className="mt-2 text-2xl font-black sm:text-4xl">Golden Service Cycle</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">One command desk from first contact to application, eligibility, delegation, approved handover and aftercare. Every open case has a next action and deadline; confirmed human replies are tracked separately from automated receipts.</p></div>
     <Badge className="border border-white/30 bg-white/10 text-white"><ShieldCheck className="mr-1.5 h-4 w-4"/>God Mode MFA</Badge>
    </div>
    <div className="mt-5 flex flex-wrap gap-2">
     <Button asChild variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:text-white"><Link to="/admin/cases"><ClipboardCheck className="mr-2 h-4 w-4"/>Verified case decisions</Link></Button>
     <Button asChild variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:text-white"><Link to="/admin/communications?tab=email"><Mail className="mr-2 h-4 w-4"/>Email & WhatsApp</Link></Button>
     <Button asChild variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:text-white"><Link to="/admin/studio">Visual Studio</Link></Button>
    </div>
   </header>
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
    {stats.map(([label,n,Icon])=><div key={label} className="rk-neo-stat min-w-0 p-3 sm:p-4"><div className="flex items-center justify-between gap-1 text-[#60738e]"><p className="text-[10px] font-black uppercase tracking-wider">{label}</p><Icon className="h-4 w-4 shrink-0"/></div><p className="mt-2 text-2xl font-black tabular-nums text-[#071326]">{Number(n||0).toLocaleString("en-ZA")}</p></div>)}
   </div>
   <section aria-label="Golden customer journey" className="rk-neo-panel p-3 sm:p-4">
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-black">Golden customer journey</h2><span className="text-[11px] text-muted-foreground">Automation prepares · operator verifies · partners deliver</span></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">{journey.map(([i,title,desc])=><div key={i} className="rk-neo-inset min-w-0 p-3"><span className="text-[10px] font-black text-[#2563eb]">{i}</span><p className="mt-1 text-xs font-black">{title}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{desc}</p></div>)}</div>
   </section>
   <div className="rk-neo-panel flex flex-wrap items-center gap-2 p-3">
    <div className="flex flex-wrap items-center gap-2">
     <Label htmlFor="golden-filter">Work to do</Label><Select value={filter} onValueChange={x=>{setFilter(x);setOffset(0);setSelected(null);}}>
      <SelectTrigger id="golden-filter" className="w-[165px]"><SelectValue/></SelectTrigger><SelectContent>
       <SelectItem value="overdue">Needs attention</SelectItem><SelectItem value="all">All open</SelectItem>
       <SelectItem value="needs_reply">Awaiting first reply</SelectItem><SelectItem value="waiting">Waiting on others</SelectItem>
       <SelectItem value="post_service">Move-in & aftercare</SelectItem><SelectItem value="closed">Closed services</SelectItem>
      </SelectContent></Select>
    </div>
    <Select value={kind} onValueChange={x=>{setKind(x);setOffset(0);setSelected(null);}}>
     <SelectTrigger aria-label="Filter by service category" className="w-[225px]"><SelectValue/></SelectTrigger>
     <SelectContent><SelectItem value="all">All 11 service categories</SelectItem>{KINDS.map(([k,label])=><SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
    </Select>
    <div className="relative min-w-[180px] flex-1"><Search className="pointer-events-none absolute left-2.5 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-8" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search loaded cases, customers or references"/></div>
    <Button variant="outline" onClick={()=>void load()} disabled={loading} size="sm"><RefreshCw className={"mr-1.5 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button>
   </div>
   {error&&<div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
   <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(320px,.96fr)_minmax(0,1.04fr)]">
    <Card className="rk-neo-panel min-w-0"><CardContent className="p-3 sm:p-4">
     <div className="mb-3 flex items-center justify-between"><h2 className="font-black">Service attention queue</h2><Badge variant="outline">{filtered.length} loaded</Badge></div>
     {loading&&!items.length&&<p className="p-7 text-sm text-muted-foreground">Loading secured service cases…</p>}
     <div className="rk-stagger-list max-h-[780px] space-y-2 overflow-y-auto">
      {filtered.map(row=><button key={row.kind+row.id} type="button" onClick={()=>void open(row)}
       className={"rk-pressable w-full rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 "+(selected?.id===row.id&&selected?.kind===row.kind?"border-blue-500 bg-blue-50":"border-border bg-card hover:border-blue-200 hover:bg-muted/40")}>
       <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wide text-[#55729a]">{pretty(row.kind)}</span><div className="flex gap-1">{row.overdue&&<Badge variant="destructive">Overdue</Badge>}{row.needs_reply&&<Badge variant="outline">No verified reply</Badge>}</div></div>
       <p className="mt-1 text-sm font-black">{row.customer||"Service customer"}</p>
       <p className="mt-1 text-xs text-muted-foreground">{row.residence_name||pretty(row.status)} · {pretty(row.next_action)}</p>
       <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{pretty(row.step)}</Badge>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3"/> {date(row.needs_reply?row.first_response_due_at:row.next_action_due_at)}</span></div>
       {row.delegated_review_open&&<p className="mt-2 text-[11px] font-semibold text-amber-700">Residence eligibility task is open</p>}
      </button>)}
      {!loading&&!filtered.length&&!error&&<div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No cases match this view. Try a different service category or status.</div>}
     </div>
     <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
      <Button size="sm" variant="outline" disabled={!offset||loading} onClick={()=>setOffset(n=>Math.max(0,n-80))}><ChevronLeft className="mr-1 h-4 w-4"/>Previous</Button>
      <span className="text-[11px] text-muted-foreground">Page {1+Math.floor(offset/80)}</span>
      <Button size="sm" variant="outline" disabled={items.length<80||loading} onClick={()=>setOffset(n=>n+80)}>Next <ChevronRight className="ml-1 h-4 w-4"/></Button>
     </div>
    </CardContent></Card>
    <div className="space-y-4">
     {!selected?<Card className="rk-neo-panel"><CardContent className="grid min-h-72 place-items-center p-10 text-center"><div><Headphones className="mx-auto h-10 w-10 text-[#2563eb]"/><h2 className="mt-3 font-black">Select a customer to continue their journey</h2><p className="mt-2 text-sm text-muted-foreground">See the next best action, verified response history and official fulfilment workspace. No automatic approval or external send is performed here.</p></div></CardContent></Card>:
      <Card className="rk-neo-panel"><CardContent className="space-y-4 p-4 sm:p-5">
       <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#2563eb]">Current service journey</p><h2 className="mt-1 text-xl font-black">{selected.customer}</h2><p className="mt-1 text-xs text-muted-foreground">{pretty(selected.kind)} · {selected.id.slice(0,8).toUpperCase()}</p></div><Badge variant="outline">{pretty(selected.status)}</Badge></div>
       <div className="grid gap-2 sm:grid-cols-2"><div className="rk-neo-stat p-3"><p className="text-[10px] font-black uppercase text-muted-foreground">Next action</p><p className="mt-1 text-sm font-black">{pretty(selected.next_action)}</p></div><div className="rk-neo-stat p-3"><p className="text-[10px] font-black uppercase text-muted-foreground">Operator deadline</p><p className="mt-1 text-sm font-black">{date(selected.needs_reply?selected.first_response_due_at:selected.next_action_due_at)}</p></div></div>
       <div className="rounded-xl border bg-muted/20 p-3 text-xs leading-5"><p><strong>In-app receipt:</strong> {selected.receipt_issued_at?"Recorded":"Not recorded (historical cases were not auto-contacted)"}</p><p><strong>Confirmed human contact:</strong> {date(selected.last_human_response_at)} {selected.last_human_channel?"· "+pretty(selected.last_human_channel):""}</p><p className="mt-1 text-muted-foreground">A task status or automated receipt is never proof of a sent email, WhatsApp or finished eligibility assessment.</p></div>
       <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild size="sm" variant="outline"><Link to={detailsUrl(selected.kind)}><FileCheck2 className="mr-1.5 h-4 w-4"/>Official case workspace</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to={"/admin/communications?tab=email"+(["application","reservation"].includes(selected.kind)?"&kind="+selected.kind:"")}><Mail className="mr-1.5 h-4 w-4"/>Communication dock</Link></Button>
       </div>
       {["reservation","application"].includes(selected.kind)&&<p className="text-xs leading-5 text-amber-800">Document verification and landlord handover must be completed in Case Command Center. This service desk cannot approve reservations or bypass funding checks.</p>}
       <section className="space-y-3 border-t pt-4">
        <Label htmlFor="golden-action" className="text-sm font-black">Choose your next service action</Label>
        <Select value={action} onValueChange={x=>{setAction(x as FlowAction);setConfirmed(false);}}>
         <SelectTrigger id="golden-action"><SelectValue/></SelectTrigger><SelectContent>{ACTIONS.map(([id,label])=>
          <SelectItem key={id} value={id} disabled={id==="waiting_residence"&&!selected.delegated_review_open}>{label}</SelectItem>
         )}</SelectContent>
        </Select>
        <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-[#23416b]">{selectedAction?.[2]}</p>
        {action==="set_followup"&&<div><Label htmlFor="golden-next">Next follow-up date/time</Label><Input id="golden-next" type="datetime-local" value={nextDue} onChange={e=>setNextDue(e.target.value)} className="mt-1"/></div>}
        {action==="contact_confirmed"&&<>
         <Label htmlFor="golden-channel">Actual contact channel</Label><Select value={channel} onValueChange={setChannel}><SelectTrigger id="golden-channel"><SelectValue/></SelectTrigger><SelectContent>
          <SelectItem value="email">Email actually sent</SelectItem><SelectItem value="whatsapp">WhatsApp actually sent</SelectItem><SelectItem value="phone">Phone call completed</SelectItem><SelectItem value="in_person">Met face-to-face</SelectItem>
         </SelectContent></Select>
         <label className="flex items-start gap-2 rounded-xl border p-3 text-xs leading-5"><Checkbox checked={confirmed} onCheckedChange={v=>setConfirmed(v===true)}/>I confirm the message was delivered or the conversation actually happened. Drafting/opening an app is not proof of sending.</label>
        </>}
        <Label htmlFor="golden-note">Internal reason or follow-up details</Label>
        <Textarea id="golden-note" rows={3} value={note} maxLength={1500} onChange={e=>setNote(e.target.value)} placeholder="What needs to happen next, what is missing, or what was genuinely communicated?"/>
        <Button className="rk-clay-action w-full" onClick={()=>void apply()} disabled={busy||(action==="contact_confirmed"&&!confirmed)}>
         <CheckCircle2 className="mr-2 h-4 w-4"/>{busy?"Saving safely…":"Record next service action"}
        </Button>
       </section>
      </CardContent></Card>}
     {selected&&<Card className="rk-neo-panel"><CardContent className="p-4"><h3 className="flex items-center gap-2 text-sm font-black"><BookOpenCheck className="h-4 w-4"/>Private service activity</h3>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{events.length?events.map((event,i)=><div key={event.created_at+i} className="rounded-xl border bg-muted/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black">{pretty(event.event_type)}</p><p className="text-[10px] text-muted-foreground">{date(event.created_at)}</p></div><p className="mt-1 whitespace-pre-wrap text-xs">{event.note||"No additional comment"}</p></div>):<p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">No manual actions yet. Historic service contacts are reconciled when provider delivery records exist.</p>}</div>
     </CardContent></Card>}
    </div>
   </div>
   <p className="rounded-xl border bg-card p-4 text-xs leading-6 text-muted-foreground">Solo-company service principle: automate logging, reminders and draft preparation; retain human judgement for identity, eligibility, placement, sensitive documents, commitments and final communication delivery. Historical cases remain on the queue until someone actually services them. The watchdog alerts God Mode daily when deadlines are missed.</p>
  </div>
 </AdminLayout>;
}
