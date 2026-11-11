import {useCallback,useEffect,useState} from "react";
import {CheckCircle2,RefreshCw,ShieldCheck,XCircle,Star} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {supabase} from "@/integrations/supabase/client";
import {toast} from "sonner";

type Review={id:string;residence_id:string;rating:number;title:string;comment:string|null;comment_public:boolean;created_at:string};
export default function AdminResidenceReviewModeration(){
 const [reviews,setReviews]=useState<Review[]>([]);
 const [names,setNames]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null);
 const load=useCallback(async()=>{
  setLoading(true);
  const db=supabase as any;
  const {data,error}=await db.from("reskonnect_student_residence_reviews")
   .select("id,residence_id,rating,title,comment,comment_public,created_at").order("created_at",{ascending:false}).limit(150);
  if(error){toast.error("Review moderation is available only to authorized ResKonnect administrators.");setLoading(false);return;}
  setReviews(data||[]);
  const ids=[...new Set((data||[]).map((r:Review)=>r.residence_id))];
  if(ids.length){
   const {data:res}=await db.from("residences").select("id,name").in("id",ids);
   setNames(Object.fromEntries((res||[]).map((r:any)=>[r.id,r.name])));
  }
  setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const moderate=async(review:Review,approved:boolean)=>{
  setBusy(review.id);
  const {data,error}=await (supabase as any).from("reskonnect_student_residence_reviews")
   .update({comment_public:approved}).eq("id",review.id).select("id,comment_public").maybeSingle();
  setBusy(null);
  if(error||!data||data.comment_public!==approved){toast.error("Moderation change was not saved. Check your admin permission.");return;}
  toast.success(approved?"Feedback approved for public display":"Feedback hidden; the student's star rating remains recorded.");
  await load();
 };
 return <section className="space-y-4">
  <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-5">
   <div><h2 className="text-xl font-black">Student review moderation</h2>
    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Approved applicants can cast one star vote per residence. Ratings aggregate automatically; written comments stay hidden until independently reviewed by ResKonnect administrators.</p></div>
   <Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
  </div>
  {loading?<p className="p-5 text-sm text-muted-foreground">Loading student feedback…</p>:
   reviews.length===0?<p className="rounded-2xl border border-dashed p-8 text-sm text-muted-foreground">No eligible student ratings have been submitted yet. No averages are fabricated.</p>:
   <div className="grid gap-3 lg:grid-cols-2">
    {reviews.map(review=><article key={review.id} className="rounded-2xl border bg-card p-4">
     <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-xs font-semibold text-muted-foreground">{names[review.residence_id]||"Residence"}</p>
       <p className="mt-1 font-bold">{review.title}</p></div>
      <Badge variant={review.comment_public?"default":"secondary"}>{review.comment_public?"Public":"Not published"}</Badge>
     </div>
     <p className="mt-2 flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-amber-400 text-amber-400"/>{review.rating}/5 · {new Date(review.created_at).toLocaleDateString("en-ZA")}</p>
     <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{review.comment||"No written feedback supplied"}</p>
     {review.comment&&<div className="mt-4 flex gap-2">
      <Button size="sm" disabled={busy===review.id||review.comment_public} onClick={()=>void moderate(review,true)}><CheckCircle2 className="mr-1.5 h-4 w-4"/>Approve text</Button>
      <Button size="sm" variant="outline" disabled={busy===review.id||!review.comment_public} onClick={()=>void moderate(review,false)}><XCircle className="mr-1.5 h-4 w-4"/>Hide text</Button>
     </div>}
    </article>)}
   </div>}
  <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Landlords cannot approve or edit student comments. Every rating comes from an approved applicant account.</p>
 </section>;
}
