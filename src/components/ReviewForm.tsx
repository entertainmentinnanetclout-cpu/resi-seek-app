import {useEffect,useState} from "react";
import {ShieldCheck,Star} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Label} from "@/components/ui/label";
import {supabase} from "@/integrations/supabase/client";
import {useAuth} from "@/contexts/AuthContext";
import {toast} from "sonner";

interface ReviewFormProps{residenceId:string;onSuccess:()=>void;onCancel:()=>void;}

/** One genuine approved applicant vote per residence, with comment text
 * withheld from public view until independently moderated. */
export default function ReviewForm({residenceId,onSuccess,onCancel}:ReviewFormProps){
 const {user}=useAuth();
 const [eligible,setEligible]=useState<boolean|null>(null);
 const [rating,setRating]=useState(0);
 const [title,setTitle]=useState("");
 const [comment,setComment]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!user){setEligible(false);return;}
  let active=true;
  void (supabase as any).rpc("reskonnect_can_student_rate_residence",{p_residence_id:residenceId})
   .then(({data,error}:any)=>{if(active)setEligible(!error&&data===true);});
  return()=>{active=false;};
 },[user?.id,residenceId]);
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(!user||eligible!==true)return toast.error("Only approved residence applicants can submit a rating.");
  if(rating<1||rating>5)return toast.error("Choose a rating from one to five stars.");
  if(title.trim().length<3)return toast.error("Write a short review title.");
  setBusy(true);
  try{
   const {error}=await (supabase as any).from("reskonnect_student_residence_reviews")
    .upsert({user_id:user.id,residence_id:residenceId,rating,
      title:title.trim().slice(0,100),comment:comment.trim().slice(0,1200)||null,
      comment_public:false},{onConflict:"residence_id,user_id"});
   if(error)throw error;
   toast.success("Student rating saved. Your written feedback is awaiting review.");
   onSuccess();
  }catch(error:any){
   toast.error(error?.code==="23505"?"You already rated this residence. Edit your existing rating instead.":error?.message||"Could not save rating.");
  }finally{setBusy(false);}
 };
 return <form onSubmit={submit} className="space-y-4 rounded-[20px] border border-[#efe3d2] bg-[#fffaf2] p-4 sm:p-5">
  <div className="flex items-start gap-2 text-xs text-[#677387]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#ae7e2b]"/>
   <p>Only approved applicants can rate their residence. One vote per student per property; updating a vote replaces the previous one. Written feedback is screened before publication.</p>
  </div>
  {eligible===null&&<p className="text-xs text-[#697a8d]">Checking review eligibility…</p>}
  {eligible===false&&<p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Only students with an approved application to this residence can leave a rating. The system has not confirmed your eligibility.</p>}
  <div><Label className="text-sm font-bold">Your student rating</Label>
   <div className="mt-2 flex items-center gap-1" role="group" aria-label="Choose a rating">
    {[1,2,3,4,5].map(n=><button key={n} type="button" disabled={eligible!==true}
      aria-label={`${n} star${n!==1?"s":""}`} aria-pressed={rating===n} onClick={()=>setRating(n)}
      className="rounded-lg p-1.5 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e4ac43] disabled:opacity-50">
      <Star className={`h-7 w-7 ${n<=rating?"fill-[#f0b439] text-[#f0b439]":"text-[#b3bdc9]"}`}/>
    </button>)}
    <span className="ml-2 text-sm font-black text-[#1d3553]">{rating||"—"} / 5</span>
   </div>
  </div>
  <div className="space-y-1.5"><Label htmlFor="student-review-title">Short title</Label>
   <Input id="student-review-title" value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} disabled={eligible!==true}
    placeholder="What stood out about your experience?"/>
  </div>
  <div className="space-y-1.5"><Label htmlFor="student-review-comment">Your experience (optional)</Label>
   <Textarea id="student-review-comment" value={comment} maxLength={1200} rows={3} onChange={e=>setComment(e.target.value)} disabled={eligible!==true}
    placeholder="What would other students find useful to know?"/>
  </div>
  <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
   <Button type="submit" disabled={busy||eligible!==true||rating===0||title.trim().length<3} className="bg-[#133763] text-white hover:bg-[#0d2441]">{busy?"Saving…":"Submit student rating"}</Button></div>
 </form>;
}
