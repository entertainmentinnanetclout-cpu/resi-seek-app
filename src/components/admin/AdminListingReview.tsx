import {useCallback,useEffect,useMemo,useState} from "react";
import {CheckCircle2,Eye,ImageIcon,RefreshCw,ShieldCheck,XCircle} from "lucide-react";
import {toast} from "sonner";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Textarea} from "@/components/ui/textarea";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";

type StudioRow={
 residence_id:string;owner_id:string;status:string;
 payload:Record<string,any>;reviewer_note:string|null;
 submitted_at:string|null;updated_at:string;revision:number;
};
const cash=(n:unknown)=>"R"+Number(n||0).toLocaleString("en-ZA");
export default function AdminListingReview(){
 const [rows,setRows]=useState<StudioRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("submitted");
 const [current,setCurrent]=useState<string|null>(null);
 const [note,setNote]=useState("");
 const load=useCallback(async()=>{
   setLoading(true);
   try{
    const {data,error}=await (supabase as any).from("reskonnect_listing_studio_drafts")
      .select("residence_id,owner_id,payload,status,reviewer_note,submitted_at,updated_at,revision")
      .eq("status",status).order("updated_at",{ascending:false}).limit(100);
    if(error)throw error;
    setRows(data||[]);
    setCurrent(old=>old&&(data||[]).some((r:StudioRow)=>r.residence_id===old)?old:(data||[])[0]?.residence_id||null);
   }catch(e){toast.error(e instanceof Error?e.message:"Cannot load listing review queue");}
   finally{setLoading(false);}
 },[status]);
 useEffect(()=>{void load();},[load]);
 const selected=useMemo(()=>rows.find(r=>r.residence_id===current),[rows,current]);
 const review=async(approve:boolean)=>{
   if(!selected||busy)return;
   if(!approve&&note.trim().length<12)return toast.error("Explain what the landlord needs to correct (at least 12 characters).");
   if(approve&&!window.confirm("Confirm the real residence details, room capacity and genuine photos have been checked. Approve and publish these updates to the existing listing?"))return;
   setBusy(true);
   try{
    const {data,error}=await (supabase as any).rpc("reskonnect_review_listing",{
      p_residence_id:selected.residence_id,p_approve:approve,p_note:note.trim()||null
    });
    if(error)throw error;
    toast.success(approve?"Listing data and inventory approved and synchronized":"Corrections requested from the residence");
    setNote("");setCurrent(null);await load();
   }catch(e){toast.error(e instanceof Error?e.message:"Listing review failed");}
   finally{setBusy(false);}
 };
 return <div className="space-y-4">
  <Card className="border-primary/20"><CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-xl"><ShieldCheck className="h-5 w-5 text-primary"/>Listing Studio · Verification queue</CardTitle>
   <p className="text-sm text-muted-foreground">Landlords prepare their property profile and real room inventory. Only an authorized administrator can approve publication. Trust and accreditation remain separate checks.</p>
  </CardHeader><CardContent className="flex flex-wrap items-center gap-2">
   <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-52"><SelectValue/></SelectTrigger><SelectContent>
    <SelectItem value="submitted">Awaiting review</SelectItem>
    <SelectItem value="changes_requested">Corrections requested</SelectItem>
    <SelectItem value="approved">Approved</SelectItem>
    <SelectItem value="draft">Draft (not submitted)</SelectItem>
   </SelectContent></Select>
   <Badge variant="outline">{rows.length} in this view</Badge>
   <Button size="sm" variant="outline" disabled={loading} onClick={()=>void load()}><RefreshCw className="mr-1 h-4 w-4"/>Refresh</Button>
  </CardContent></Card>
  <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
   <Card><CardContent className="max-h-[720px] space-y-2 overflow-y-auto p-3">
    {loading?<p className="p-4 text-sm text-muted-foreground">Loading verified queue…</p>:rows.length===0?<p className="p-5 text-sm text-muted-foreground">No {status.replaceAll("_"," ")} listings. Submitted properties will appear here.</p>:rows.map(row=><button type="button" key={row.residence_id} onClick={()=>{setCurrent(row.residence_id);setNote("");}}
     className={"w-full rounded-xl border p-3 text-left "+(current===row.residence_id?"border-primary bg-primary/5":"hover:bg-muted/30")}>
     <p className="font-bold">{row.payload?.name||"Unnamed property"}</p>
     <p className="mt-1 text-xs text-muted-foreground">{[row.payload?.place_label,row.payload?.city].filter(Boolean).join(", ")}</p>
     <div className="mt-2 flex items-center justify-between gap-2"><Badge variant="outline">{row.status.replaceAll("_"," ")}</Badge><span className="text-[11px] text-muted-foreground">Revision {row.revision}</span></div>
    </button>)}
   </CardContent></Card>
   {selected?<Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><Eye className="h-5 w-5"/>{selected.payload?.name||"Property review"}</CardTitle>
    <p className="text-xs text-muted-foreground">Submitted: {selected.submitted_at?new Date(selected.submitted_at).toLocaleString("en-ZA"):"Not submitted"} · Residence reference {selected.residence_id}</p></CardHeader>
    <CardContent className="space-y-5">
     <div className="grid gap-3 sm:grid-cols-3">{[
       ["Room categories",selected.payload?.rooms?.length||0],
       ["Total beds",(selected.payload?.rooms||[]).reduce((n:number,r:any)=>n+Number(r.capacity||0),0)],
       ["Genuine photos",selected.payload?.photos?.length||0]
     ].map(([label,value])=><div key={String(label)} className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}</div>
     <div><h4 className="font-bold">Property location</h4>
      <p className="mt-1 text-sm">{[selected.payload?.address,selected.payload?.place_label,selected.payload?.city,selected.payload?.province].filter(Boolean).join(", ")}</p>
      <p className="mt-1 text-xs text-muted-foreground">Full address restricted to this authenticated staff review; public listing location settings remain controlled separately.</p></div>
     <div><h4 className="font-bold">Description and lease</h4><p className="mt-1 whitespace-pre-line text-sm">{selected.payload?.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">{selected.payload?.lease_period} · Move-in {selected.payload?.move_in_date} · Nearest campus: {selected.payload?.campus||"Not provided"}</p></div>
     <div className="space-y-2"><h4 className="font-bold">Room inventory and prices</h4>
      {(selected.payload?.rooms||[]).map((r:any,i:number)=><div key={r.id||i} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm">
       <span>{r.name} · {r.available_beds}/{r.capacity} beds</span><strong>{cash(r.private_price)}/month</strong>
      </div>)}
      <p className="text-xs text-muted-foreground">These are landlord-provided figures, not independently verified availability. Confirm dates and capacity before approving.</p>
     </div>
     <div className="space-y-2"><h4 className="flex items-center gap-2 font-bold"><ImageIcon className="h-4 w-4"/>Actual property photos</h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(selected.payload?.photos||[]).map((p:any,i:number)=><div key={p.id||i} className="overflow-hidden rounded-lg border">
       <img src={p.url} alt={"Photo "+(i+1)+" "+p.room_tag} className="aspect-[4/3] w-full object-cover" loading="lazy"/>
       <p className="p-1.5 text-xs text-muted-foreground">{i===0?"Cover · ":""}{p.room_tag}</p>
      </div>)}</div></div>
     <p className="rounded-lg border p-3 text-sm">Verification route: <strong>{String(selected.payload?.verification_method||"Not selected").replaceAll("_"," ")}</strong>. Confirm any supporting property documents through the private compliance portal before granting a trust badge.</p>
     {selected.reviewer_note&&<p className="rounded-lg bg-muted/50 p-3 text-xs">Previous review: {selected.reviewer_note}</p>}
     {selected.status==="submitted"&&<div className="space-y-3 border-t pt-4">
      <Textarea rows={3} placeholder="Review notes or specific corrections required (include exact missing evidence)" value={note} onChange={e=>setNote(e.target.value)} aria-label="Review notes"/>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void review(true)}><CheckCircle2 className="mr-2 h-4 w-4"/>Approve verified property details</Button>
       <Button disabled={busy||note.trim().length<12} variant="outline" onClick={()=>void review(false)}><XCircle className="mr-2 h-4 w-4"/>Request corrections</Button></div>
      <p className="text-xs text-muted-foreground">Approval updates the residence's non-sensitive public listing data, room-type inventory and approved photographs. It does not create any fake accreditation, automatic payment or applicant acceptance.</p>
     </div>}
    </CardContent>
   </Card>:<Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Select a residence to inspect its proposed listing and approve it.</CardContent></Card>}
  </div>
 </div>;
}
