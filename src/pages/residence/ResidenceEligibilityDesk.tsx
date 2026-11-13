import {useCallback,useEffect,useMemo,useState} from "react";
import {Link,useOutletContext} from "react-router-dom";
import {ArrowRight,CheckCircle2,ClipboardCheck,FileText,MessageCircle,RefreshCw,ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import SEO from "@/components/SEO";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {supabase} from "@/integrations/supabase/client";
import type {ResidencePortalContext} from "./ResidenceLayout";
type Kind="application"|"reservation";
type TaskRow={id:string;kind:Kind;stage:string;status:string;student_name:string|null;student_number:string|null;residence_id:string;residence_name:string|null;task_id:string|null;task_status:string|null;created_at:string;document_readiness:{ready:boolean;missing?:string[];uploaded?:number}};
type Conversation={id:string;message:string;visibility:string;created_at:string};
const rpc=async(name:string,args:Record<string,unknown>)=>{
 const {data,error}=await (supabase as any).rpc(name,args);
 if(error)throw new Error(error.message||"Residence collaboration unavailable");
 return data;
};
export default function ResidenceEligibilityDesk(){
 const {residence}=useOutletContext<ResidencePortalContext>();
 const [kind,setKind]=useState<Kind>("reservation");
 const [rows,setRows]=useState<TaskRow[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [selected,setSelected]=useState<TaskRow|null>(null);
 const [profile,setProfile]=useState<any>(null);
 const [comments,setComments]=useState<Conversation[]>([]);
 const [decision,setDecision]=useState<"eligible"|"needs_documents"|"ineligible">("needs_documents");
 const [note,setNote]=useState("");
 const [message,setMessage]=useState("");
 const [search,setSearch]=useState("");
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  if(!residence?.id)return;
  setLoading(true);setError("");
  try{
   const d=await rpc("rk_case_queue",{p_kind:kind,p_scope:"landlord",p_limit:100,p_offset:0,p_stage:null});
   setRows((d.items||[]).filter((x:TaskRow)=>x.residence_id===residence.id));
  }catch(e){setRows([]);setError(e instanceof Error?e.message:"Could not load delegated cases");}
  finally{setLoading(false);}
 },[kind,residence?.id]);
 useEffect(()=>{void load();setSelected(null);setProfile(null);},[load]);
 const filtered=useMemo(()=>rows.filter(x=>[x.student_name,x.student_number,x.stage,x.status].join(" ").toLowerCase().includes(search.toLowerCase())),[rows,search]);
 const open=async(row:TaskRow)=>{
  setSelected(row);setProfile(null);setComments([]);setNote("");setMessage("");
  try{
   const [p,c]=await Promise.all([
     rpc("rk_case_profile_packet",{p_kind:row.kind,p_case_id:row.id}),
     rpc("rk_case_collaboration_list",{p_kind:row.kind,p_case_id:row.id})
   ]);
   setProfile(p);setComments(c||[]);
  }catch(e){toast.error(e instanceof Error?e.message:"Eligibility packet unavailable");}
 };
 const review=async()=>{
  if(!selected?.task_id||selected.task_status!=="open"||note.trim().length<8)return;
  if(!window.confirm("Submit this eligibility recommendation to ResKonnect? You cannot confirm the reservation or approve the handover."))return;
  setBusy(true);
  try{
   await rpc("rk_landlord_review_task",{p_task_id:selected.task_id,p_decision:decision,p_note:note});
   toast.success("Recommendation submitted for ResKonnect decision");
   setSelected(null);setProfile(null);await load();
  }catch(e){toast.error(e instanceof Error?e.message:"Could not record eligibility assessment");}
  finally{setBusy(false);}
 };
 const post=async()=>{
  if(!selected||message.trim().length<4)return;
  setBusy(true);
  try{await rpc("rk_case_collaboration_post",{p_kind:selected.kind,p_case_id:selected.id,p_message:message,p_shared:true});
   const c=await rpc("rk_case_collaboration_list",{p_kind:selected.kind,p_case_id:selected.id});
   setComments(c||[]);setMessage("");toast.success("Message shared securely with ResKonnect");
  }catch(e){toast.error(e instanceof Error?e.message:"Cannot post message");}finally{setBusy(false);}
 };
 return <div className="rk-motion mx-auto max-w-7xl space-y-5">
  <SEO noIndex title="Assigned Student Eligibility Reviews | ResKonnect Property OS" description="Review delegated student eligibility and return recommendations to ResKonnect"/>
  <header className="rk-skeuo-frame rounded-[26px] bg-[linear-gradient(120deg,#071326,#19477e)] p-6 text-white">
   <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-[#F5B32F]"><ClipboardCheck className="h-4 w-4"/>Residence eligibility queue</div>
   <h1 className="mt-2 text-2xl font-black sm:text-3xl">Your students, ready for assessment</h1>
   <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">ResKonnect delegates individual student eligibility profiles, not automatic placement decisions. Check study details and funding readiness, review your authorised application documents, and return a recommendation.</p>
   <Badge className="mt-3 border border-amber-400/40 bg-amber-500/20 text-white"><ShieldCheck className="mr-1 h-3.5 w-3.5"/>ResKonnect retains final handover approval</Badge>
  </header>
  <div className="grid gap-4 lg:grid-cols-[minmax(290px,.8fr)_minmax(0,1.2fr)]">
   <Card className="rk-neo-panel"><CardContent className="space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-black">Assigned reviews</h2><Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading}><RefreshCw className="h-4 w-4"/></Button></div>
    <div className="grid grid-cols-2 gap-2">{(["reservation","application"] as const).map(v=><Button key={v} variant={kind===v?"default":"outline"} onClick={()=>setKind(v)} className="capitalize">{v==="reservation"?"Reservations":"Applications"}</Button>)}</div>
    <Input aria-label="Search delegated student reviews" placeholder="Student, reference or status" value={search} onChange={e=>setSearch(e.target.value)}/>
    {error&&<p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">{error}</p>}
    <div className="rk-stagger-list max-h-[600px] space-y-2 overflow-auto">
     {filtered.map(item=><button key={item.id} type="button" onClick={()=>void open(item)} className={"rk-pressable w-full rounded-xl border p-3 text-left "+(selected?.id===item.id?"border-blue-500 bg-blue-50":"bg-background hover:bg-muted/30")}>
      <span className="block text-sm font-black">{item.student_name||"Student profile pending"}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{item.student_number||"Student number pending"} · {item.status.replaceAll("_"," ")}</span>
      <span className="mt-2 flex flex-wrap gap-1.5"><Badge variant="outline">{item.stage.replaceAll("_"," ")}</Badge><Badge variant={item.task_status==="open"?"default":"secondary"}>{item.task_status==="open"?"Your review needed":item.task_status==="completed"?"Review submitted":"ResKonnect sign-off"}</Badge></span>
     </button>)}
     {!filtered.length&&!loading&&!error&&<p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No delegated student profiles yet. ResKonnect must assign eligibility work before a profile appears here.</p>}
    </div>
   </CardContent></Card>
   <div className="space-y-4">
    {!selected?<Card className="rk-neo-panel"><CardContent className="py-20 text-center text-muted-foreground"><ClipboardCheck className="mx-auto h-10 w-10"/><p className="mt-3 text-sm">Select a delegated case to review its verified eligibility information and send recommendations.</p></CardContent></Card>:
     <Card className="rk-neo-panel"><CardContent className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">{profile?.student?.name||selected.student_name}</h2><p className="mt-1 text-xs text-muted-foreground">Ref {selected.id.slice(0,8).toUpperCase()} · {kind} · {selected.status}</p></div>
       <Badge variant={profile?.handover_approved_at?"default":"outline"}>{profile?.handover_approved_at?"Handover approved by ResKonnect":"Pending ResKonnect authorisation"}</Badge></div>
      <div className="rk-stagger-list grid gap-2 sm:grid-cols-2">
       {([["Student number",profile?.student?.student_number],["Campus",profile?.student?.campus],["Course",profile?.student?.course],["Year of study",profile?.student?.year_of_study],["Funding route",profile?.student?.funding_type],["Academic year",profile?.student?.academic_year]] as const).map(([label,val])=><div key={label} className="rk-neo-stat p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#60738e]">{label}</p><p className="mt-1 text-sm font-black">{val||"Not yet provided"}</p></div>)}
      </div>
      <section className="rounded-xl border p-4"><p className="flex items-center gap-2 font-black"><FileText className="h-4 w-4"/>Document readiness</p>
       <p className="mt-2 text-xs">{profile?.document_readiness?.ready?"Required evidence is recorded as verified. ResKonnect still decides the handover.":"Supporting evidence is missing, unverified or incomplete. A recommendation does not replace document checks."}</p>
       {(profile?.document_readiness?.missing||selected.document_readiness?.missing||[]).map((x:string)=><p key={x} className="mt-1 text-xs text-amber-700">• {x}</p>)}
       <div className="mt-3 flex flex-wrap gap-2">{kind==="application"?<Button variant="outline" size="sm" asChild><Link to={"/residence/communications?kind=application&target="+selected.id}>Open secure document review <ArrowRight className="ml-2 h-3.5 w-3.5"/></Link></Button>:<p className="text-xs text-muted-foreground">Reservation-wide identity files remain private. ResKonnect verifies student-level documents before sign-off.</p>}</div>
      </section>
      {profile?.contact&&<p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">Handover-approved contact: {profile.contact.email||"—"} · {profile.contact.phone||"—"}</p>}
      {selected.task_id&&selected.task_status==="open"&&<section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4"><h3 className="text-sm font-black">Complete your eligibility recommendation</h3>
       <Label>Recommendation</Label><Select value={decision} onValueChange={v=>setDecision(v as typeof decision)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="eligible">Candidate appears eligible · recommend</SelectItem><SelectItem value="needs_documents">Further evidence is needed</SelectItem><SelectItem value="ineligible">Not eligible · explain</SelectItem></SelectContent></Select>
       <Label htmlFor="rk-landlord-reason">Reason / checks completed</Label><Textarea id="rk-landlord-reason" value={note} onChange={e=>setNote(e.target.value)} rows={3} maxLength={800} placeholder="Explain the checks performed and any missing requirements"/>
       <Button className="rk-clay-action w-full" disabled={busy||note.trim().length<8} onClick={()=>void review()}><CheckCircle2 className="mr-2 h-4 w-4"/>Submit to ResKonnect for decision</Button>
      </section>}
      <section className="space-y-3 border-t pt-4"><h3 className="flex items-center gap-2 text-sm font-black"><MessageCircle className="h-4 w-4"/>Internal ResKonnect discussion</h3><p className="text-xs text-muted-foreground">Visible to your assigned residence and ResKonnect administrators; never sent to the student as WhatsApp or email.</p>
       <div className="max-h-40 space-y-2 overflow-auto">{comments.length?comments.map(c=><div key={c.id} className="rounded-xl border bg-muted/20 p-3"><p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("en-ZA")}</p><p className="mt-1 whitespace-pre-wrap text-xs">{c.message}</p></div>):<p className="text-xs text-muted-foreground">No messages yet.</p>}</div>
       <Textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} maxLength={2000} placeholder="Ask ResKonnect about eligibility, room readiness or the required documents"/>
       <Button size="sm" onClick={()=>void post()} disabled={busy||message.trim().length<4}>Send private collaboration message</Button>
      </section>
     </CardContent></Card>}
   </div>
  </div>
 </div>;
}
