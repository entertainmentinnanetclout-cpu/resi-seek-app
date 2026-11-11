import {useMemo,useState} from "react";
import {ArrowDown,ArrowRight,ArrowUp,ImageOff,Sparkles} from "lucide-react";
import {Link} from "react-router-dom";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {supabase} from "@/integrations/supabase/client";
import {spotlightPhoto,spotlightPriority} from "@/lib/residenceSpotlight";

type Residence={
 id:string;name:string;slug?:string|null;city?:string|null;address?:string|null;
 is_visible?:boolean|null;is_spotlight?:boolean|null;spotlight_rank?:number|null;
 cover_image_url?:string|null;image_url?:string|null;images?:string[]|null;
};
type Props={residences:Residence[];onRefresh:()=>void};

export default function SpotlightPlacementManager({residences,onRefresh}:Props){
 const [saving,setSaving]=useState(false);
 const ordered=useMemo(()=>residences.filter(r=>r.is_spotlight===true)
  .sort((a,b)=>spotlightPriority(a)-spotlightPriority(b)||a.name.localeCompare(b.name)),[residences]);
 const move=async(index:number,direction:-1|1)=>{
  const target=index+direction;
  if(saving||target<0||target>=ordered.length)return;
  const next=[...ordered];
  [next[index],next[target]]=[next[target],next[index]];
  setSaving(true);
  try{
   // Existing admin-only residence write policies apply. Never grant public
   // permission to mutate editorial placement order.
   // Persist a complete 1..N sequence so existing null/duplicate ranks converge.
   for(let i=0;i<next.length;i++){
    const {data,error}=await (supabase as any).from("residences")
     .update({spotlight_rank:i+1}).eq("id",next[i].id)
     .select("id,spotlight_rank").maybeSingle();
    if(error||!data||Number(data.spotlight_rank)!==i+1)throw error||new Error("The placement was not saved. Check your admin permissions.");
   }
   toast.success("Spotlight order saved on the homepage and Find My Res");
  }catch(e){
   toast.error(e instanceof Error?e.message:"Could not reorder Spotlight; refresh and retry");
  }finally{setSaving(false);onRefresh();}
 };
 return <section aria-label="Premium spotlight placement management"
  className="mb-5 overflow-hidden rounded-[23px] border border-[#173b70]/25 bg-[linear-gradient(125deg,#091a35,#103663)] text-white shadow-[0_14px_30px_rgba(8,27,56,.14)]">
  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/15 px-5 py-5 sm:px-6">
   <div>
    <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#ffd88f]"><Sparkles className="h-4 w-4"/> Featured residence placements</div>
    <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Control your high-visibility blocks</h3>
    <p className="mt-2 max-w-3xl text-xs leading-5 text-white/70 sm:text-sm">Priority #1 gets the large hero card; #2–#5 appear beside it on the homepage and Find My Res. Turn Spotlight on or off in the residence table below.</p>
   </div>
   <Badge className="border border-white/25 bg-white/10 px-3 py-1.5 text-white">{ordered.length} selected</Badge>
  </div>
  <div className="grid gap-2 p-3 sm:p-4 lg:grid-cols-2">
   {ordered.length===0?<p className="col-span-full p-5 text-sm text-white/80">No spotlight residences selected. Use the Spotlight toggle in the residence table to select priority properties.</p>:
   ordered.map((r,i)=>{
    const picture=spotlightPhoto(r);
    const eligible=!!picture&&r.is_visible!==false;
    return <div key={r.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.07] p-3">
     <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edc57b] text-sm font-black text-[#091a35]">{i+1}</span>
     <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-white/10">
      {picture?<img src={picture} alt="" className="h-full w-full object-cover"/>:<ImageOff className="m-auto mt-4 h-6 w-6 text-white/50"/>}
     </div>
     <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-white">{r.name}</p>
      <p className="mt-0.5 truncate text-[11px] text-white/60">{i===0?"Large hero placement":i<5?"Supporting premium card":"Not in the first five positions"}</p>
      {!eligible&&<p className="mt-0.5 text-[10px] font-semibold text-[#ffdc9b]">Not shown: publish the listing and add a property photo</p>}
     </div>
     <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-1">
       <Button size="icon" variant="outline" className="h-8 w-8 border-white/25 bg-white/10 text-white hover:bg-white/20" disabled={saving||i===0} onClick={()=>void move(i,-1)} aria-label={`Move ${r.name} up`}><ArrowUp className="h-4 w-4"/></Button>
       <Button size="icon" variant="outline" className="h-8 w-8 border-white/25 bg-white/10 text-white hover:bg-white/20" disabled={saving||i===ordered.length-1} onClick={()=>void move(i,1)} aria-label={`Move ${r.name} down`}><ArrowDown className="h-4 w-4"/></Button>
      </div>
      <Link to={`/find-my-res/${encodeURIComponent(r.slug||r.id)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#ffd88f] hover:underline">Open listing <ArrowRight className="h-3 w-3"/></Link>
     </div>
    </div>;
   })}
  </div>
  <p className="border-t border-white/15 px-5 py-3 text-[11px] text-white/70">
   These are editorial placements. Paid sponsorships are managed separately and must always carry a Sponsored disclosure. A spotlight does not mean verified accreditation or confirmed vacancy.
  </p>
 </section>;
}
