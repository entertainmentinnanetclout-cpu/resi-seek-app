import {useCallback,useEffect,useMemo,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {toast} from "sonner";
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ClipboardCheck,Clock3,FileCheck2,
 GraduationCap,HeartHandshake,Home,Mail,RefreshCw,ShieldCheck,UserRound,Workflow} from "lucide-react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import {supabase} from "@/integrations/supabase/client";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";

type Milestone={key:string;label:string;status:string;recorded:boolean;note:string|null;
 evidence_reference:string|null;verified_at:string|null;updated_at:string|null};
type Case={kind:string;source_id:string;source_status:string;step:string;priority:string;next_action:string;
 next_action_due_at:string|null;last_human_response_at:string|null;closed_at:string|null;source_created_at:string};
type RecordRow={id:string;status:string;created_at:string;[key:string]:unknown};
type Snapshot={
 found:boolean;
 profile:{id:string;full_name:string|null;email:string|null;phone:string|null;student_number:string|null;
 campus:string|null;course:string|null;year_of_study:number|null;academic_year:number|null;
 study_level:string|null;student_stage:string|null;applicant_stage:string|null;created_at:string}|null;
 milestones:Milestone[];
 summary:{applications:number;reservations:number;wil:number;admissions_support:number;documents_pending:number;
 documents_verified:number;open_cases:number;unanswered_cases:number;open_automation:number};
 applications:RecordRow[];reservations:RecordRow[];admission_assistance:RecordRow[];
 wil:RecordRow[];documents:{id:string;document_type:string;status:string;uploaded_at:string;verified_at:string|null}[];
 cases:Case[];
 communication:{provider_sent_email_count:number;outbound_email_failed_count:number;
 whatsapp_operator_attested_count:number;whatsapp_draft_opened_count:number;linked_whatsapp_messages:number};
 timeline:{event_at:string;event_type:string;label:string;detail:string;source_id:string|null}[];
};
const format=(v:unknown)=>String(v??"Not recorded").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const when=(v:string|null|undefined)=>v?new Date(v).toLocaleDateString("en-ZA",{year:"numeric",month:"short",day:"numeric"}):"Not recorded";
const statusTone=(s:string)=>s==="verified_complete"?"default":s==="blocked"?"destructive":"outline";
const stages=["not_started","preparing","in_progress","blocked","verified_complete"];
const actionRoute=(kind:string)=>kind==="wil"?"/admin/wil":kind==="application"||kind==="reservation"?"/admin/cases":"/admin/golden-cycle";
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await (supabase as any).rpc(name,args);
 if(error)throw new Error(error.message||"The private Student 360 service could not be opened.");
 return (typeof data==="string"?JSON.parse(data):data) as T;
}
function Metric({title,value,description}:{title:string;value:number;description:string}){
 return <div className="rk-neo-inset rounded-2xl p-3.5">
  <p className="text-[11px] font-black uppercase tracking-wider text-[#536985]">{title}</p>
  <p className="mt-2 text-3xl font-black tabular-nums text-[#071326]">{value.toLocaleString("en-ZA")}</p>
  <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
 </div>;
}
export default function AdminStudent360(){
 const {userId}=useParams<{userId:string}>();
 const [data,setData]=useState<Snapshot|null>(null);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [editing,setEditing]=useState<Milestone|null>(null);
 const [status,setStatus]=useState("not_started"),[note,setNote]=useState(""),[evidence,setEvidence]=useState("");
 const reload=useCallback(async()=>{
  if(!userId||!/^[a-f0-9-]{36}$/i.test(userId)){setError("Invalid student profile reference");setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const snapshot=await rpc<Snapshot>("rk_student_360_snapshot",{p_user_id:userId});
   if(!snapshot?.found)throw new Error("Student profile not found");
   setData(snapshot);
  }catch(e){setError(e instanceof Error?e.message:"Student profile unavailable");setData(null);}
  finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void reload();},[reload]);
 const alerts=useMemo(()=>{
  if(!data)return [];
  const result:{title:string;detail:string;to:string}[]=[];
  if(data.summary.unanswered_cases>0)result.push({title:"Reply evidence needs checking",
   detail:data.summary.unanswered_cases+" open service journeys have no confirmed human response. Check actual contact before messaging.",
   to:"/admin/communications?tab=email"});
  if(data.summary.documents_pending>0)result.push({title:"Documents awaiting review",
   detail:data.summary.documents_pending+" uploaded general document(s) still require authorised verification.",to:"/admin/documents"});
  if(data.cases.some(c=>!c.closed_at&&c.next_action_due_at&&new Date(c.next_action_due_at).getTime()<Date.now()))
   result.push({title:"Follow-up overdue",detail:"At least one open service deadline has passed.",to:"/admin/golden-cycle"});
  if(data.wil.some(w=>!["placed","completed"].includes(w.status)))
   result.push({title:"WIL journey active",detail:"Review real placement progress; an application is not proof of placement.",to:"/admin/wil"});
  return result;
 },[data]);
 const openEdit=(m:Milestone)=>{setEditing(m);setStatus(m.status);setNote(m.note||"");setEvidence(m.evidence_reference||"");};
 const save=async()=>{
  if(!editing||!userId||saving)return;
  if(note.trim().length<12)return toast.error("Record at least 12 characters of factual review context.");
  if(status==="verified_complete"&&evidence.trim().length<8)return toast.error("Verified milestones require an evidence reference.");
  if(status==="verified_complete"&&!window.confirm("Confirm that supporting evidence was reviewed? This updates the journey ledger only, not any admission, funding, housing, WIL or employment decision."))return;
  setSaving(true);
  try{
   await rpc("rk_student_360_milestone_set",{
    p_user_id:userId,p_milestone:editing.key,p_status:status,p_note:note.trim(),
    p_evidence_reference:evidence.trim()||null,p_expected_updated_at:editing.updated_at||null
   });
   toast.success("Journey milestone saved with an audit record. No external message was sent.");
   setEditing(null);await reload();
  }catch(e){toast.error(e instanceof Error?e.message:"Could not save verified journey state");}
  finally{setSaving(false);}
 };
 return <AdminLayout>
  <SEO noIndex title="Student 360 | ResKonnect" description="Private verified student journey and connected operational cases"/>
  <div className="rk-motion mx-auto max-w-[1600px] space-y-5 p-3 sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <Button asChild variant="outline" size="sm"><Link to="/admin/brain"><ArrowLeft className="mr-2 h-4 w-4"/>Back to ResKonnect Brain</Link></Button>
    <Button variant="outline" size="sm" disabled={loading} onClick={()=>void reload()}>
     <RefreshCw className="mr-2 h-4 w-4"/>Refresh connected records
    </Button>
   </div>
   {loading?<div className="rk-neo-panel p-10 text-center">Loading the protected Student 360 journey…</div>
   :error?<div role="alert" className="rk-neo-panel space-y-3 p-6"><p className="font-semibold text-destructive">{error}</p>
     <Button onClick={()=>void reload()} variant="outline">Retry</Button></div>:data&&<>
    <header className="rk-skeuo-frame overflow-hidden rounded-[26px] bg-[linear-gradient(125deg,#071326,#153b74)] p-5 text-white sm:p-7">
     <div className="flex flex-wrap items-start gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><UserRound className="h-7 w-7"/></div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">
       <Badge className="border-0 bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]">STUDENT 360</Badge>
       <Badge variant="outline" className="border-white/40 text-white">One person · all service journeys</Badge>
      </div>
       <h1 className="mt-3 break-words text-2xl font-black sm:text-4xl">{data.profile?.full_name||"Student profile"}</h1>
       <p className="mt-2 text-sm leading-6 text-white/80">{data.profile?.student_number||"Student number pending"} · {data.profile?.campus||"Campus not recorded"} · {data.profile?.course||"Programme not recorded"}</p>
       <p className="mt-1 break-words text-xs text-white/70">{data.profile?.email||"Email not recorded"} · {data.profile?.phone||"Phone not recorded"}</p>
      </div>
     </div>
     <div className="mt-5 flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline" className="border-white/30 bg-white/10 text-white hover:text-white"><Link to="/admin/communications?tab=email"><Mail className="mr-2 h-4 w-4"/>Open communications</Link></Button>
      <Button asChild size="sm" variant="outline" className="border-white/30 bg-white/10 text-white hover:text-white"><Link to="/admin/cases"><ClipboardCheck className="mr-2 h-4 w-4"/>Eligibility & applications</Link></Button>
      <Button asChild size="sm" variant="outline" className="border-white/30 bg-white/10 text-white hover:text-white"><Link to="/admin/wil"><BriefcaseBusiness className="mr-2 h-4 w-4"/>WIL</Link></Button>
     </div>
    </header>
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-5" aria-label="Connected student facts">
     <Metric title="Open services" value={data.summary.open_cases} description="Not necessarily unresolved applications"/>
     <Metric title="No confirmed reply" value={data.summary.unanswered_cases} description="Evidence gap, not proof of neglect"/>
     <Metric title="Files pending" value={data.summary.documents_pending} description="Compulsory human review"/>
     <Metric title="Housing records" value={data.summary.applications+data.summary.reservations} description="Applications and reservations"/>
     <Metric title="Automation follow-ups" value={data.summary.open_automation} description="Pending, not yet handled"/>
    </section>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
     <div className="space-y-4">
      <Card className="rk-neo-panel">
       <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>Lifetime journey</CardTitle>
        <p className="text-xs leading-5 text-muted-foreground">Stages can overlap. Unrecorded means not verified; completing a milestone never changes the legal business decision. Only authorized reviewed evidence can complete a milestone.</p>
       </CardHeader>
       <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {data.milestones.map((m,i)=><div key={m.key} className="rk-neo-inset rounded-2xl p-3">
         <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-[#55729a]">{String(i+1).padStart(2,"0")}</span>
          <Badge variant={statusTone(m.status) as "default"|"outline"|"destructive"}>{m.recorded?format(m.status):"Unverified"}</Badge></div>
         <p className="mt-2 text-sm font-black">{m.label}</p>
         <p className="mt-1 min-h-10 text-xs text-muted-foreground">{m.recorded?(m.note||"No factual context recorded"):"No verified milestone record yet."}</p>
         <Button variant="outline" size="sm" className="mt-3 w-full" onClick={()=>openEdit(m)}><ShieldCheck className="mr-1.5 h-3.5 w-3.5"/>Review milestone</Button>
        </div>)}
       </CardContent>
      </Card>
      <Card className="rk-neo-panel"><CardHeader><CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5 text-primary"/>Linked service cases</CardTitle>
       <p className="text-xs text-muted-foreground">Opening this profile shows the student's real source statuses, deadlines and next actions across departments.</p>
      </CardHeader><CardContent className="space-y-2">
       {data.cases.length===0?<p className="text-sm text-muted-foreground">No tracked service case linked to this user yet.</p>:
       data.cases.slice(0,25).map(c=><div key={c.kind+":"+c.source_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
        <div><div className="flex flex-wrap gap-2"><span className="font-bold">{format(c.kind)}</span><Badge variant="outline">{format(c.source_status)}</Badge>{c.closed_at&&<Badge variant="secondary">Closed</Badge>}</div>
         <p className="mt-1 text-xs text-muted-foreground">{format(c.step)} · {c.next_action||"No next action"} · Due {when(c.next_action_due_at)}</p></div>
        <Button size="sm" variant="outline" asChild><Link to={actionRoute(c.kind)}>Open workflow<ArrowRight className="ml-1.5 h-3.5 w-3.5"/></Link></Button>
       </div>)}
      </CardContent></Card>
      <Card className="rk-neo-panel"><CardHeader><CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-primary"/>Applications & housing history</CardTitle></CardHeader>
      <CardContent className="space-y-3">
       <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">Accommodation applications · {data.summary.applications}</p>
        {data.applications.length===0?<p className="text-sm text-muted-foreground">No accommodation application linked.</p>:
        data.applications.map(a=><div key={a.id} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><div><p className="font-semibold">{String(a.residence_name||"Residence unspecified")}</p><p className="text-xs text-muted-foreground">{format(a.status)} · {when(a.created_at)} · {String(a.academic_year||"Year unknown")}</p></div>
         <Button variant="outline" size="sm" asChild><Link to={"/admin/applications?application="+a.id}>Open application<ArrowRight className="ml-1 h-3.5 w-3.5"/></Link></Button></div>)}
       </div>
       <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">Accommodation reservations · {data.summary.reservations}</p>
        {data.reservations.length===0?<p className="text-sm text-muted-foreground">No accommodation reservation linked.</p>:
        data.reservations.map(a=><div key={a.id} className="mb-2 rounded-xl border p-3"><p className="font-semibold">{String(a.residence_name||"Residence unspecified")}</p><p className="text-xs text-muted-foreground">{format(a.status)} · {when(a.created_at)} · {String(a.academic_year||"Year unknown")}</p></div>)}
        <Button variant="outline" size="sm" asChild><Link to="/admin/cases">Reservation review and handover</Link></Button>
       </div>
      </CardContent></Card>
     </div>
     <div className="space-y-4">
      <Card className="rk-neo-panel"><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary"/>Next-best actions</CardTitle>
       <p className="text-xs text-muted-foreground">Evidence-based suggestions only; no automatic message or approval.</p></CardHeader>
      <CardContent className="space-y-2">{alerts.length?alerts.map(a=><div key={a.title} className="rounded-xl border p-3"><p className="text-sm font-black">{a.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{a.detail}</p><Button variant="outline" size="sm" asChild className="mt-2"><Link to={a.to}>Review now<ArrowRight className="ml-1 h-3.5 w-3.5"/></Link></Button></div>)
       :<p className="text-sm text-muted-foreground">No urgent action detected in the currently linked records. Review incomplete milestones and external evidence separately.</p>}
      </CardContent></Card>
      <Card className="rk-neo-panel"><CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary"/>Communication truth</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
       {([
        ["Provider-recorded sent emails",data.communication.provider_sent_email_count],
        ["Emails marked failed",data.communication.outbound_email_failed_count],
        ["WhatsApp operator-attested sends",data.communication.whatsapp_operator_attested_count],
        ["WhatsApp drafts only opened",data.communication.whatsapp_draft_opened_count],
        ["Linked WhatsApp message records",data.communication.linked_whatsapp_messages]
       ] as const).map(([label,value])=><div key={label} className="flex justify-between gap-4 border-b pb-2"><span>{label}</span><strong className="tabular-nums">{value}</strong></div>)}
       <p className="text-xs leading-5 text-muted-foreground">An operator-attested WhatsApp send is not provider-confirmed delivery. A synced message record is not automatically a verified reply.</p>
       <Button asChild variant="outline" size="sm"><Link to="/admin/communications?tab=email">Open Mail Dock</Link></Button>
      </CardContent></Card>
      <Card className="rk-neo-panel"><CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary"/>Document evidence</CardTitle></CardHeader>
       <CardContent className="space-y-2">{data.documents.length?data.documents.slice(0,20).map(d=><div key={d.id} className="flex justify-between gap-2 rounded-lg border p-2 text-xs"><div><p className="font-semibold">{format(d.document_type)}</p><p className="text-muted-foreground">{when(d.uploaded_at)}</p></div><Badge variant={d.status==="verified"?"default":"outline"}>{format(d.status)}</Badge></div>):<p className="text-sm text-muted-foreground">No general documents linked.</p>}
        <Button asChild variant="outline" size="sm"><Link to="/admin/documents">Authorised document review</Link></Button>
       </CardContent>
      </Card>
      <Card className="rk-neo-panel"><CardHeader><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary"/>Admissions & career</CardTitle></CardHeader>
       <CardContent className="space-y-2">
        {data.admission_assistance.map(a=><p key={a.id} className="rounded-lg border p-2 text-xs">Admission support · {String(a.preferred_institution||"Institution unspecified")} · {format(a.status)}</p>)}
        {data.wil.map(w=><p key={w.id} className="rounded-lg border p-2 text-xs">WIL · {String(w.course||"Programme unspecified")} · {format(w.status)}</p>)}
        {!data.wil.length&&!data.admission_assistance.length&&<p className="text-sm text-muted-foreground">No admission support or WIL application recorded.</p>}
        <Button asChild variant="outline" size="sm"><Link to="/admin/wil">Open placement office</Link></Button>
       </CardContent>
      </Card>
     </div>
    </div>
    <Card className="rk-neo-panel"><CardHeader><CardTitle className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-primary"/>One factual student timeline</CardTitle>
     <p className="text-xs text-muted-foreground">Chronological source events are shown together. Uploads, status changes and verified achievements remain distinct.</p></CardHeader>
     <CardContent><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{data.timeline.length?data.timeline.slice(0,45).map((event,i)=><div key={event.event_type+event.event_at+i} className="rounded-xl border p-3">
      <p className="text-[10px] font-semibold text-muted-foreground">{when(event.event_at)} · {format(event.event_type)}</p>
      <p className="mt-1 text-sm font-black">{format(event.label)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{format(event.detail)}</p>
     </div>):<p className="text-sm text-muted-foreground">No recorded events linked to this user yet.</p>}</div></CardContent></Card>
   </>}
  </div>
  <Dialog open={!!editing} onOpenChange={open=>{if(!open&&!saving)setEditing(null);}}>
   <DialogContent className="max-w-lg">
    <DialogHeader><DialogTitle>Verify journey milestone</DialogTitle>
     <DialogDescription>Only record what you checked. This is an auditable journey note; it does not approve external institution, funding, housing, graduation or employment outcomes.</DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
     <p className="font-black">{editing?.label}</p>
     <div><Label>Verified operational state</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="mt-2"><SelectValue/></SelectTrigger>
      <SelectContent>{stages.map(s=><SelectItem key={s} value={s}>{format(s)}</SelectItem>)}</SelectContent></Select></div>
     <div><Label htmlFor="student360-note">Evidence review note (required)</Label>
      <Textarea id="student360-note" value={note} onChange={e=>setNote(e.target.value)} rows={4} maxLength={1000} placeholder="What was checked, by whom and what still needs follow-up?"/></div>
     <div><Label htmlFor="student360-evidence">Evidence reference {status==="verified_complete"?"(required)":"(optional)"}</Label>
      <Input id="student360-evidence" value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={240} placeholder="Internal document reference or official source (no ID numbers)"/></div>
     <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground"><CheckCircle2 className="mr-1 inline h-4 w-4"/> Every change is separately audited. It cannot send messages or change an application decision.</div>
     <Button disabled={saving||note.trim().length<12||(status==="verified_complete"&&evidence.trim().length<8)} className="w-full rk-clay-action" onClick={()=>void save()}>
      {saving?"Saving reviewed evidence…":"Save verified journey state"}</Button>
    </div>
   </DialogContent>
  </Dialog>
 </AdminLayout>;
}
