import {useCallback,useEffect,useState} from "react";
import {ArrowRight,CheckCircle2,Clock3,Headphones,RefreshCw,ShieldCheck,Star} from "lucide-react";
import {Textarea} from "@/components/ui/textarea";
import {Link} from "react-router-dom";
import {supabase} from "@/integrations/supabase/client";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent} from "@/components/ui/card";
type Entry={id:string;kind:string;status:string;step:string;next_action:string;received_at:string;last_human_response_at:string|null;receipt_recorded:boolean;feedback_rating?:number|null;closed:boolean};
const pretty=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const label=(s:string)=>({
 application:"Accommodation application",reservation:"Reservation",viewing:"Property viewing",enquiry:"Residence enquiry",
 onboarding:"New customer request",application_support:"Study application help",private_rental:"Private rental",
 student_support:"Service request",wil:"WIL placement",landlord:"Landlord enquiry",partner:"Partner enquiry"
}[s]||pretty(s));
const next=(s:string)=>({
 received:"Received — awaiting triage",in_review:"Under review by ResKonnect",
 awaiting_customer:"Information requested — check your messages",awaiting_residence:"Residence review in progress",
 awaiting_partner:"External response pending",followup:"Follow-up arranged",
 post_service:"Placement/approval aftercare",closed:"Service follow-up closed"
}[s]||pretty(s));
const links:Record<string,string>={application:"/my-applications",reservation:"/dashboard",wil:"/wil",student_support:"/dashboard/services",application_support:"/application-assistance"};
export default function GoldenServiceJourneyPanel(){
 const [rows,setRows]=useState<Entry[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [feedback,setFeedback]=useState<Record<string,{rating:number;note:string}>>({});
 const [sending,setSending]=useState<string|null>(null);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const {data,error}=await (supabase as any).rpc("rk_golden_my_service");
   if(error)throw error;setRows(Array.isArray(data?.items)?data.items:[]);
  }catch(e){setError(e instanceof Error?e.message:"Journey unavailable");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const submit=async(entry:Entry)=>{
  const key=entry.kind+":"+entry.id;
  const value=feedback[key];if(!value?.rating||sending)return;
  setSending(key);
  try{
   const {data,error}=await (supabase as any).rpc("rk_golden_service_feedback_submit",{
    p_kind:entry.kind,p_id:entry.id,p_rating:value.rating,p_comment:value.note.trim()||null
   });
   if(error)throw error;
   setFeedback(x=>{const next={...x};delete next[key];return next;});
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to record service feedback");}
  finally{setSending(null);}
 };
 return <Card className="rk-neo-panel overflow-hidden">
  <CardContent className="p-4 sm:p-5">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#2563eb]"><ShieldCheck className="h-4 w-4"/>Your Golden Service Journey</p>
    <h2 className="mt-1 text-xl font-black">Every request, one place to track it</h2>
    <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">We bring your accommodation, application, WIL and support requests into one service view. You can see what has been received and what happens next. Decisions and confirmations still depend on verified information and available placements.</p></div>
    <Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-1.5 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button>
   </div>
   {error&&<p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{error}</p>}
   {loading?<p role="status" className="py-6 text-xs text-muted-foreground">Checking your secure request timeline…</p>:
   rows.length===0?<div className="mt-4 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
    <p className="font-semibold text-foreground">No tracked requests yet</p>
    <p className="mt-1 text-xs">Your future requests will appear here. Already need help? Use the service request form below or start with accommodation discovery.</p>
    <div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to="/findmyres">Find accommodation <ArrowRight className="ml-1.5 h-3.5 w-3.5"/></Link></Button><Button asChild size="sm" variant="outline"><Link to="/get-started">Get started</Link></Button></div>
   </div>:
   <div className="rk-stagger-list mt-4 grid gap-2 md:grid-cols-2">
    {rows.slice(0,20).map(r=><div key={r.kind+r.id} className="rk-neo-inset rounded-xl p-3">
     <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black">{label(r.kind)}</p><Badge variant={r.closed?"secondary":"outline"}>{r.closed?"Completed / closed":"Active"}</Badge></div>
     <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#214b84]">{r.closed?<CheckCircle2 className="h-3.5 w-3.5"/>:<Clock3 className="h-3.5 w-3.5"/>}{next(r.step)}</p>
     <p className="mt-1 text-[11px] text-muted-foreground">Current status: {pretty(r.status)} · Received {new Date(r.received_at).toLocaleDateString("en-ZA")}</p>
     <p className="mt-1 text-[11px] text-muted-foreground">{r.last_human_response_at?"Last confirmed human response: "+new Date(r.last_human_response_at).toLocaleDateString("en-ZA"):
      r.receipt_recorded?"Request logged automatically; personal review is still pending.":"This historical request has not had a response confirmed in the new service tracker."}</p>
     {links[r.kind]&&<Link className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary underline" to={links[r.kind]}>View this service <ArrowRight className="h-3 w-3"/></Link>}
     {(r.closed||r.step==="post_service")&&<div className="mt-3 border-t pt-3">
      <p className="text-xs font-black">How was your ResKonnect service?</p>
      {r.feedback_rating?<p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500"/>You rated your experience {r.feedback_rating}/5. Ratings can be updated after 24 hours.</p>:
       <><div className="mt-2 flex gap-1" role="group" aria-label="Rate your service from one to five">
        {[1,2,3,4,5].map(star=><button type="button" key={star} aria-label={star+" of 5 stars"}
         onClick={()=>setFeedback(x=>({...x,[r.kind+":"+r.id]:{rating:star,note:x[r.kind+":"+r.id]?.note||""}}))}
         className="rounded-lg border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
         <Star className={"h-4 w-4 "+((feedback[r.kind+":"+r.id]?.rating||0)>=star?"fill-amber-400 text-amber-500":"text-muted-foreground")}/></button>)}
       </div>
       {feedback[r.kind+":"+r.id]?.rating>0&&<><Textarea rows={2} maxLength={450} className="mt-2" aria-label="Optional private service feedback" placeholder="What should we improve? (optional)"
         value={feedback[r.kind+":"+r.id]?.note||""} onChange={e=>setFeedback(x=>({...x,[r.kind+":"+r.id]:{rating:x[r.kind+":"+r.id]?.rating||0,note:e.target.value}}))}/>
        <Button size="sm" className="mt-2 w-full" disabled={sending===r.kind+":"+r.id} onClick={()=>void submit(r)}>{sending===r.kind+":"+r.id?"Saving feedback…":"Submit private feedback"}</Button></>}
       </>}
      <p className="mt-2 text-[10px] text-muted-foreground">Your feedback stays in ResKonnect Service, not public residence reviews. Low ratings create a private recovery task.</p>
     </div>}
    </div>)}
   </div>}
   <p className="mt-4 text-[11px] leading-5 text-muted-foreground"><Headphones className="mr-1 inline h-3.5 w-3.5"/>Automatic acknowledgement means we have a record of your request; it does not mean an email was sent, supporting documents were verified, funding was awarded or a room was confirmed.</p>
  </CardContent>
 </Card>;
}
