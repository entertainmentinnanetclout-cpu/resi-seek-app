import {useCallback,useEffect,useMemo,useState} from "react";
import {Link,useLocation} from "react-router-dom";
import {CalendarDays,CheckCircle2,Clock3,FileCheck2,MessageCircle,RefreshCw,ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import {useAuth} from "@/contexts/AuthContext";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";

type CaseItem={
 source_kind:string;source_id:string;source_status:string;academic_year:number|null;
 next_action:string;document_signal:string;last_responded_at:string|null;
 first_response_due_at:string|null;closed_at:string|null;source_created_at:string;
};
const titles:Record<string,string>={
 application:"Accommodation application",reservation:"Accommodation reservation",
 viewing:"Property viewing",enquiry:"Accommodation enquiry"
};
const actionDescriptions:Record<string,string>={
 request_documents:"Upload documents requested for your application",
 request_replacement_documents:"Check your document requests and upload replacements",
 review_uploaded_documents:"Documents received; staff review is pending",
 review_application_status:"Application is awaiting the next staff decision",
 contact_about_reservation:"Residence team to respond to your interest",
 follow_up_reservation:"Residence team to follow up",
 verify_hold_and_next_steps:"Provisional hold requires staff verification",
 propose_viewing_time:"Viewing requested; date is not confirmed",
 schedule_viewing:"Residence is arranging a suitable viewing",
 confirm_viewing_details:"Viewing arranged; check the confirmed details",
 answer_enquiry:"Your enquiry is awaiting response",
 complete:"Case is complete or closed"
};
export default function ResidenceJourneyPanel({residenceId,residenceName}:{residenceId:string;residenceName:string}){
 const {user}=useAuth(),loc=useLocation();
 const [cases,setCases]=useState<CaseItem[]>([]);
 const [viewingTimes,setViewingTimes]=useState<Record<string,{preferred_date:string|null;preferred_time_window:string|null;confirmed_viewing_at:string|null}>>({});
 const [loading,setLoading]=useState(false),[sending,setSending]=useState(false);
 const [date,setDate]=useState(""),[slot,setSlot]=useState("afternoon"),[note,setNote]=useState("");
 const [consent,setConsent]=useState(false);
 const load=useCallback(async()=>{
  if(!user?.id||!residenceId){setCases([]);return;}
  setLoading(true);
  const {data,error}=await (supabase as any).from("reskonnect_case_work_items")
    .select("source_kind,source_id,source_status,academic_year,next_action,document_signal,last_responded_at,first_response_due_at,closed_at,source_created_at")
    .eq("residence_id",residenceId).eq("student_user_id",user.id)
    .order("source_created_at",{ascending:false}).limit(40);
  if(error)toast.error("Unable to load your case progress: "+error.message);
  else setCases(data||[]);
  setLoading(false);
 },[user?.id,residenceId]);
 useEffect(()=>{void load();const handler=()=>void load();window.addEventListener("reskonnect-case-updated",handler);return()=>window.removeEventListener("reskonnect-case-updated",handler);},[load]);
 useEffect(()=>{
  const viewings=cases.filter(c=>c.source_kind==="viewing").slice(0,8);
  if(viewings.length===0){setViewingTimes({});return;}
  let active=true;
  void Promise.all(viewings.map(c=>(supabase as any)
   .rpc("reskonnect_viewing_summary",{p_viewing_id:c.source_id})
   .then(({data,error}:any)=>({id:c.source_id,value:!error&&Array.isArray(data)?data[0]:null}))
  )).then(rows=>{if(active)setViewingTimes(Object.fromEntries(rows.filter(r=>r.value).map(r=>[r.id,r.value])));});
  return()=>{active=false;};
 },[cases]);
  const viewing=useMemo(()=>cases.some(x=>x.source_kind==="viewing"&&!x.closed_at),[cases]);
 const submit=async()=>{
  if(!user?.id)return;
  if(!date||!consent)return toast.error("Select a viewing day and confirm contact consent.");
  setSending(true);
  try{
   const {error}=await (supabase as any).rpc("reskonnect_request_property_viewing",{
     p_residence_id:residenceId,p_date:date,p_window:slot,
     p_note:note.trim(),p_consent:consent
   });
   if(error)throw error;
   toast.success("Viewing request recorded. The residence team must confirm a time.");
   setNote("");setConsent(false);await load();
  }catch(err){toast.error(err instanceof Error?err.message:"Viewing request could not be submitted");}
  finally{setSending(false);}
 };
 return <section id="residence-journey" className="scroll-mt-28 space-y-4">
  <Card className="overflow-hidden border-primary/15">
   <CardHeader className="bg-[#000F2F] text-white"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#E09008]"><CalendarDays className="h-4 w-4"/>Your accommodation journey</div>
    <CardTitle className="text-xl">Arrange a viewing at {residenceName}</CardTitle>
    <p className="text-sm text-white/70">Request a viewing without starting an accommodation application. Dates are preferences until confirmed by the residence team.</p>
   </CardHeader>
   <CardContent className="space-y-4 p-5">
    {!user?<div className="space-y-3 rounded-xl border p-4"><p className="text-sm text-muted-foreground">Browse this residence freely. Sign in only when you are ready to request a viewing or save a reservation.</p>
      <Button asChild><Link to={"/auth?returnTo="+encodeURIComponent(loc.pathname+loc.search)}>Sign in to request a viewing</Link></Button>
    </div>:<>
      <div className="grid gap-3 sm:grid-cols-2">
       <div className="space-y-1.5"><Label htmlFor="rk-viewing-date">Preferred viewing date</Label><Input id="rk-viewing-date" type="date" value={date} min={new Date().toISOString().slice(0,10)}
        onChange={e=>setDate(e.target.value)} className="h-12"/></div>
       <div className="space-y-1.5"><Label>Preferred time window</Label><Select value={slot} onValueChange={setSlot}>
         <SelectTrigger className="h-12"><SelectValue/></SelectTrigger><SelectContent>
          <SelectItem value="morning">Morning</SelectItem><SelectItem value="afternoon">Afternoon</SelectItem>
          <SelectItem value="evening">Evening</SelectItem><SelectItem value="flexible">Flexible</SelectItem>
         </SelectContent></Select></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="rk-viewing-note">Your question (optional)</Label><Textarea id="rk-viewing-note" rows={3} value={note}
       maxLength={700} placeholder="Accessibility, arrival time or a question for the residence team" onChange={e=>setNote(e.target.value)}/></div>
      <label className="flex items-start gap-3 rounded-xl border p-3 text-sm"><Checkbox checked={consent} onCheckedChange={v=>setConsent(v===true)}/>
       <span>I consent to ResKonnect using my saved profile contact details solely to coordinate this viewing and respond to my request. I understand this does not reserve a bed.</span></label>
      <Button onClick={()=>void submit()} disabled={sending||!consent||!date} className="w-full sm:w-auto">
       <CalendarDays className="mr-2 h-4 w-4"/>{sending?"Sending request…":"Request a viewing"}</Button>
      {viewing&&<p className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4"/>You have an active viewing request on this residence. The team will confirm the details.</p>}
    </>}
   </CardContent>
  </Card>
  {user&&<Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-lg"><Clock3 className="h-5 w-5 text-primary"/>Your live case progress</CardTitle><p className="mt-1 text-sm text-muted-foreground">Application, reservation and viewing progress are drawn from the same case records as AdminOS.</p></div>
     <Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button></div></CardHeader>
     <CardContent className="space-y-3">
      {cases.length===0?<p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No saved applications, reservations or viewings for this residence yet.</p>
       :cases.map(item=><div key={item.source_kind+item.source_id} className="rounded-xl border p-4">
         <div className="flex flex-wrap items-center justify-between gap-2"><strong className="flex items-center gap-2 text-sm"><MessageCircle className="h-4 w-4 text-primary"/>{titles[item.source_kind]||"Case"}</strong>
           <Badge variant={item.closed_at?"secondary":"outline"}>{item.source_status.replaceAll("_"," ")}</Badge></div>
         <p className="mt-2 text-sm text-muted-foreground">{actionDescriptions[item.next_action]||"Your request is being processed."}</p>
         {item.source_kind==="viewing"&&viewingTimes[item.source_id]&&<div className="mt-3 rounded-lg bg-muted/20 p-3 text-xs">
          <p>Requested: {viewingTimes[item.source_id].preferred_date||"To be confirmed"} · {(viewingTimes[item.source_id].preferred_time_window||"flexible").replaceAll("_"," ")}</p>
          {viewingTimes[item.source_id].confirmed_viewing_at&&<p className="mt-1 font-semibold text-emerald-700">Confirmed appointment: {new Date(viewingTimes[item.source_id].confirmed_viewing_at!).toLocaleString("en-ZA")}</p>}
         </div>}
         {item.source_kind==="application"&&item.document_signal==="none_uploaded"&&<div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 p-3 text-xs"><FileCheck2 className="h-4 w-4 text-amber-600"/>No application documents uploaded yet. <Link className="font-bold text-primary underline" to="/documents">Open your documents</Link></div>}
         {item.last_responded_at&&<p className="mt-2 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>Last team response recorded {new Date(item.last_responded_at).toLocaleDateString("en-ZA")}</p>}
       </div>)}
     </CardContent></Card>}
 </section>;
}
