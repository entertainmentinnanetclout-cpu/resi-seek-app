import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {AlertCircle,ArrowRight,CalendarClock,CheckCircle2,ClipboardList,FileCheck2,Mail,MessageCircle,RefreshCw,Send,ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";

type Case={
 source_kind:string;source_id:string;residence_id:string;student_user_id:string|null;
 academic_year:number|null;source_status:string;document_signal:string;next_action:string;
 first_response_due_at:string|null;followup_due_at:string|null;last_responded_at:string|null;
 last_responded_channel:string|null;closed_at:string|null;
 source_created_at:string;source_updated_at:string;updated_at:string;
};
const nextLabels:Record<string,string>={
 request_documents:"Request missing application documents",
 request_replacement_documents:"Request corrected documents",
 review_uploaded_documents:"Review documents received",
 review_application_status:"Review application decision",
 contact_about_reservation:"Contact the applicant about reservation interest",
 follow_up_reservation:"Follow up on the reservation",
 verify_hold_and_next_steps:"Verify provisional room hold",
 propose_viewing_time:"Arrange the requested viewing",
 schedule_viewing:"Agree the viewing date",
 confirm_viewing_details:"Confirm viewing details",
 answer_enquiry:"Reply to the enquiry",
 follow_up_enquiry:"Follow up with the student",
 complete:"Completed / closed"
};
const cap=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const PAGE_SIZE=30;
export default function ResKonnectCaseDesk({residenceId,admin=false}:{residenceId?:string;admin?:boolean}){
 const [cases,setCases]=useState<Case[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(0);
 const [kind,setKind]=useState("all"),[stage,setStage]=useState("open"),[filterRes,setFilterRes]=useState(residenceId||"all");
 const [residences,setResidences]=useState<{id:string;name:string}[]>([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState<string|null>(null);
 const [selected,setSelected]=useState<Case|null>(null),[action,setAction]=useState("contact_confirmed");
 const [channel,setChannel]=useState("whatsapp"),[note,setNote]=useState("");
 const [confirm,setConfirm]=useState(false),[followup,setFollowup]=useState("");
 const [targetHours,setTargetHours]=useState("24"),[followupHours,setFollowupHours]=useState("48");
 const [counts,setCounts]=useState<{open:number;unanswered:number;due:number}>({open:0,unanswered:0,due:0});
 const res= residenceId||filterRes;
 const now=useMemo(()=>new Date().toISOString(),[page,kind,stage,filterRes]);
 const load=useCallback(async()=>{
  setLoading(true);
  let q=(supabase as any).from("reskonnect_case_work_items")
    .select("source_kind,source_id,residence_id,student_user_id,academic_year,source_status,document_signal,next_action,first_response_due_at,followup_due_at,last_responded_at,last_responded_channel,closed_at,source_created_at,source_updated_at,updated_at",{count:"exact"})
    .order("source_updated_at",{ascending:false}).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
  if(res!=="all")q=q.eq("residence_id",res);
  if(kind!=="all")q=q.eq("source_kind",kind);
  if(stage==="open")q=q.is("closed_at",null);
  else if(stage==="closed")q=q.not("closed_at","is",null);
  else if(stage==="unanswered")q=q.is("closed_at",null).is("last_responded_at",null);
  else if(stage==="overdue")q=q.is("closed_at",null).is("last_responded_at",null).lt("first_response_due_at",new Date().toISOString());
  else if(stage==="followup")q=q.is("closed_at",null).lt("followup_due_at",new Date().toISOString());
  else if(stage==="documents")q=q.eq("source_kind","application").in("document_signal",["none_uploaded","rejected_documents_present","submitted_for_review"]).is("closed_at",null);
  const {data,error,count}=await q;
  if(error){toast.error(error.message);setCases([]);}else{setCases(data||[]);setTotal(count||0);}
  setLoading(false);
 },[res,page,kind,stage]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(!admin)return;
  void (supabase as any).from("residences").select("id,name").order("name").limit(1000)
  .then(({data}:any)=>setResidences(data||[]));
 },[admin]);
 useEffect(()=>{
  let active=true;
  if(res==="all"){setCounts({open:0,unanswered:0,due:0});return;}
  (async()=>{
   const db=supabase as any,base=()=>db.from("reskonnect_case_work_items").select("source_id",{count:"exact",head:true}).eq("residence_id",res).is("closed_at",null);
   const [open,unanswered,due]=await Promise.all([base(),base().is("last_responded_at",null),base().is("last_responded_at",null).lt("first_response_due_at",new Date().toISOString())]);
   if(active)setCounts({open:open.count||0,unanswered:unanswered.count||0,due:due.count||0});
  })();
  return()=>{active=false;};
 },[res,total]);
 useEffect(()=>{if(res==="all")return;void (supabase as any).from("reskonnect_residence_service_targets").select("first_response_hours,followup_hours").eq("residence_id",res).maybeSingle().then(({data}:any)=>{setTargetHours(String(data?.first_response_hours||24));setFollowupHours(String(data?.followup_hours||48));});},[res]);
 useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},60000);return()=>window.clearInterval(timer);},[load]);
 const saveTargets=async()=>{
  if(res==="all")return;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return toast.error("Session expired.");
  const h=Number(targetHours),f=Number(followupHours);
  if(!Number.isInteger(h)||h<1||h>168||!Number.isInteger(f)||f<4||f>336)return toast.error("Response target must be 1–168 hours; follow-up 4–336 hours.");
  const {error}=await (supabase as any).from("reskonnect_residence_service_targets")
    .upsert({residence_id:res,first_response_hours:h,followup_hours:f,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"residence_id"});
  if(error)return toast.error(error.message);
  toast.success("Internal response targets updated for future cases");
 };
 const handleAction=async()=>{
  if(!selected)return;
  if(action==="contact_confirmed"&&!confirm)return toast.error("Confirm you actually completed the external contact first.");
  if(action==="followup_scheduled"&&!followup)return toast.error("Choose a follow-up date.");
  setBusy(selected.source_id);
  const {error}=await (supabase as any).rpc("reskonnect_record_case_action",{
   p_kind:selected.source_kind,p_id:selected.source_id,p_action:action,
   p_channel:action==="contact_confirmed"?channel:null,
   p_note:note.trim()||null,
   p_followup_at:followup?new Date(followup).toISOString():null,
   p_confirm_sent:action==="contact_confirmed"&&confirm
  });
  setBusy(null);
  if(error)return toast.error(error.message);
  toast.success(action==="contact_confirmed"?"Actual contact recorded":"Case activity saved");
  setSelected(null);setNote("");setConfirm(false);setFollowup("");void load();
 };
 const detailsLink=(item:Case)=>{
  if(!admin){
   if(item.source_kind==="application")return "/residence/application/"+item.source_id;
   if(item.source_kind==="reservation")return "/residence/reservations-2027";
   return "/residence/crm";
  }
  if(item.source_kind==="application")return "/admin/applications";
  if(item.source_kind==="reservation")return "/admin/operations-office";
  return "/admin/operations-office";
 };
 return <div className="space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><ShieldCheck className="h-4 w-4"/>ResKonnect Service Engine</div>
    <h2 className="mt-2 text-2xl font-black">Unified conversion & service desk</h2>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Applications, reservations, viewing requests and standalone enquiries in one privacy-minimized queue. Contacts are recorded only after an actual response; case statuses stay linked to their original records.</p>
   </div>
   <Button variant="outline" disabled={loading} onClick={()=>void load()}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button>
  </div>
  {res!=="all"&&<div className="grid grid-cols-3 gap-3">{[
   ["Open",counts.open,ClipboardList],["Awaiting response",counts.unanswered,MessageCircle],["Past target",counts.due,AlertCircle]
  ].map(([title,value,Icon]:any)=><Card key={title}><CardContent className="p-4"><Icon className="h-5 w-5 text-primary"/><p className="mt-2 text-2xl font-black">{value}</p><p className="text-xs text-muted-foreground">{title}</p></CardContent></Card>)}</div>}
  <Card><CardContent className="flex flex-wrap gap-3 p-4">
    {admin&&<Select value={filterRes} onValueChange={v=>{setFilterRes(v);setPage(0);}}>
     <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="All residences"/></SelectTrigger><SelectContent>
       <SelectItem value="all">All residences</SelectItem>{residences.map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
     </SelectContent></Select>}
    <Select value={kind} onValueChange={v=>{setKind(v);setPage(0);}}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
      <SelectContent><SelectItem value="all">All cases</SelectItem>{["application","reservation","viewing","enquiry"].map(v=><SelectItem key={v} value={v}>{cap(v)}</SelectItem>)}</SelectContent></Select>
    <Select value={stage} onValueChange={v=>{setStage(v);setPage(0);}}><SelectTrigger className="w-44"><SelectValue/></SelectTrigger>
      <SelectContent><SelectItem value="open">Active</SelectItem><SelectItem value="unanswered">Awaiting response</SelectItem><SelectItem value="overdue">Past target</SelectItem><SelectItem value="followup">Follow-up due</SelectItem><SelectItem value="documents">Document tasks</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="all">All history</SelectItem></SelectContent>
    </Select>
    <Badge variant="outline" className="self-center">{total.toLocaleString("en-ZA")} matching records</Badge>
   </CardContent></Card>
  <div className="grid gap-3">
   {loading?<Card><CardContent className="p-12 text-center text-muted-foreground">Loading cases…</CardContent></Card>:cases.length===0?<Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No cases in this filter. Try another status or residence.</CardContent></Card>
    :cases.map(item=>{
     const overdue=!item.closed_at&&!item.last_responded_at&&item.first_response_due_at&&new Date(item.first_response_due_at).getTime()<Date.now();
     return <Card key={item.source_kind+item.source_id}><CardContent className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge>{cap(item.source_kind)}</Badge><Badge variant="outline">{cap(item.source_status)}</Badge>
       {overdue&&<Badge className="bg-amber-600 text-white">Past response target</Badge>}
       {item.closed_at&&<Badge variant="secondary">Closed</Badge>}</div>
       <span className="text-xs text-muted-foreground">Intake {item.academic_year||"Not specified"} · {new Date(item.source_created_at).toLocaleDateString("en-ZA")}</span>
      </div>
      <p className="font-semibold">{nextLabels[item.next_action]||cap(item.next_action)}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
       <span>Case ref: {item.source_id.slice(0,8).toUpperCase()}</span>
       {item.source_kind==="application"&&<span>Documents: {cap(item.document_signal)}</span>}
       {item.first_response_due_at&&<span>Internal first-response target: {new Date(item.first_response_due_at).toLocaleString("en-ZA")}</span>}
       {item.last_responded_at&&<span>Last response: {new Date(item.last_responded_at).toLocaleString("en-ZA")} ({item.last_responded_channel})</span>}
      </div>
      <div className="flex flex-wrap gap-2">
       <Button size="sm" variant="outline" asChild><Link to={detailsLink(item)}><ArrowRight className="mr-1 h-4 w-4"/>Open original case</Link></Button>
       {!admin&&["application","reservation"].includes(item.source_kind)&&<Button size="sm" variant="outline" asChild><Link to={"/residence/communications?kind="+item.source_kind+"&target="+item.source_id}><Mail className="mr-1 h-4 w-4"/>Open branded email/WhatsApp dock</Link></Button>}
       <Button size="sm" onClick={()=>{setSelected(item);setAction("contact_confirmed");setNote("");setConfirm(false);setFollowup("");}}><ClipboardList className="mr-1 h-4 w-4"/>Record action</Button>
      </div>
     </CardContent></Card>;
    })}
  </div>
  <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Page {page+1} · {PAGE_SIZE} records per page</p><div className="flex gap-2"><Button variant="outline" disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>Previous</Button><Button variant="outline" disabled={loading||(page+1)*PAGE_SIZE>=total} onClick={()=>setPage(p=>p+1)}>Next</Button></div></div>
  {selected&&<Card className="border-primary/40"><CardHeader><CardTitle className="text-lg">Record a real service action</CardTitle><p className="text-xs text-muted-foreground">This logs case work; it does not send a message or change an application decision. Never mark a message as sent unless you've sent it through the actual channel.</p></CardHeader><CardContent className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Action</Label><Select value={action} onValueChange={setAction}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
     <SelectItem value="contact_confirmed">Confirm completed contact</SelectItem><SelectItem value="followup_scheduled">Schedule follow-up</SelectItem><SelectItem value="internal_note">Internal note only</SelectItem>
    </SelectContent></Select></div>
    {action==="contact_confirmed"&&<div className="space-y-1"><Label>Real contact channel</Label><Select value={channel} onValueChange={setChannel}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
     {["whatsapp","email","phone","in_person"].map(x=><SelectItem key={x} value={x}>{cap(x)}</SelectItem>)}
    </SelectContent></Select></div>}</div>
    <div className="space-y-1"><Label>Action note (optional except finance)</Label><Textarea rows={3} value={note} maxLength={1200} onChange={e=>setNote(e.target.value)} placeholder="Non-sensitive service summary, no ID numbers or passwords"/></div>
    {(action==="followup_scheduled"||action==="contact_confirmed")&&<div className="space-y-1"><Label>Next follow-up (optional after contact)</Label><Input type="datetime-local" value={followup} onChange={e=>setFollowup(e.target.value)}/></div>}
    {action==="contact_confirmed"&&<label className="flex items-start gap-2 rounded-lg border p-3 text-sm"><Checkbox checked={confirm} onCheckedChange={v=>setConfirm(v===true)}/><span>I confirm I have already sent or completed this communication. ResKonnect should log the actual contact, not dispatch a message.</span></label>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy!==null||(action==="contact_confirmed"&&!confirm)} onClick={()=>void handleAction()}><CheckCircle2 className="mr-2 h-4 w-4"/>Save service action</Button><Button variant="outline" onClick={()=>setSelected(null)}>Cancel</Button></div>
   </CardContent></Card>}
  {admin&&res!=="all"&&<Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4"/>Internal service targets for this residence</CardTitle>
    <p className="text-xs text-muted-foreground">Internal operational deadlines only; not a promise of automatic replies. New case targets use these settings.</p></CardHeader><CardContent className="flex flex-wrap items-end gap-3">
     <div className="space-y-1"><Label>First response (hours)</Label><Input type="number" min={1} max={168} value={targetHours} onChange={e=>setTargetHours(e.target.value)} className="w-32"/></div>
     <div className="space-y-1"><Label>Follow-up (hours)</Label><Input type="number" min={4} max={336} value={followupHours} onChange={e=>setFollowupHours(e.target.value)} className="w-32"/></div>
     <Button onClick={()=>void saveTargets()}>Save targets</Button>
   </CardContent></Card>}
 </div>;
}
