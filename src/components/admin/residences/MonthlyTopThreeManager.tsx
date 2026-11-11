import {useCallback,useEffect,useMemo,useState} from "react";
import {CalendarDays,ChartNoAxesCombined,RotateCcw,ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {supabase} from "@/integrations/supabase/client";
import {spotlightPhoto} from "@/lib/residenceSpotlight";

type Residence={id:string;name:string;city?:string|null;is_visible?:boolean|null;
 cover_image_url?:string|null;image_url?:string|null;images?:string[]|null};
type EditorialRow={position:number;residence_id:string};
type PerformanceRow={residence_id:string;rank_position:number;activity_score:number};
const currentMonth=()=>{
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit"}).formatToParts(new Date());
 const year=parts.find(p=>p.type==="year")?.value||String(new Date().getFullYear());
 const month=parts.find(p=>p.type==="month")?.value||String(new Date().getMonth()+1).padStart(2,"0");
 return `${year}-${month}`;
};

export default function MonthlyTopThreeManager({residences}:{residences:Residence[]}){
 const [month,setMonth]=useState(currentMonth);
 const [rows,setRows]=useState<EditorialRow[]>([]);
 const [organic,setOrganic]=useState<PerformanceRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const monthStart=month+"-01";
 const candidates=useMemo(()=>residences.filter(r=>r.is_visible===true&&!!spotlightPhoto(r))
  .sort((a,b)=>a.name.localeCompare(b.name)),[residences]);
 const names=useMemo(()=>new Map(residences.map(r=>[r.id,r.name])),[residences]);
 const load=useCallback(async()=>{
  setLoading(true);
  const db=supabase as any;
  const [selections,performance]=await Promise.all([
   db.from("reskonnect_monthly_top3_editorial").select("position,residence_id").eq("month_start",monthStart).order("position"),
   db.rpc("reskonnect_public_top3_monthly")
  ]);
  if(selections.error)toast.error("Cannot load admin Top 3 selections: "+selections.error.message);
  else setRows(Array.isArray(selections.data)?selections.data:[]);
  if(!performance.error)setOrganic(Array.isArray(performance.data)?performance.data:[]);
  setLoading(false);
 },[monthStart]);
 useEffect(()=>{void load();},[load]);
 const choose=async(position:number,residenceId:string)=>{
  if(saving)return;
  if(residenceId&&rows.some(r=>r.residence_id===residenceId&&r.position!==position)){
   toast.error("This residence already occupies another Top 3 position");return;
  }
  if(residenceId&&!candidates.some(r=>r.id===residenceId)){
   toast.error("Select a published residence with a real property photo");return;
  }
  setSaving(true);
  try{
   const db=supabase as any;
   if(residenceId){
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError||!user)throw new Error("Sign in as an administrator to manage rankings.");
    const {data,error}=await db.from("reskonnect_monthly_top3_editorial").upsert({
     month_start:monthStart,position,residence_id:residenceId,updated_by:user.id,updated_at:new Date().toISOString()
    },{onConflict:"month_start,position"}).select("position,residence_id").single();
    if(error||!data||data.residence_id!==residenceId)throw error||new Error("The change did not save.");
   }else{
    const {error}=await db.from("reskonnect_monthly_top3_editorial")
     .delete().eq("month_start",monthStart).eq("position",position);
    if(error)throw error;
   }
   toast.success(residenceId?"Top 3 editorial position saved":"Position returned to automatic ranking");
   await load();
  }catch(err){toast.error(err instanceof Error?err.message:"Unable to save Top 3 selection");await load();}
  finally{setSaving(false);}
 };
 const reset=async()=>{
  if(saving||!rows.length)return;
  if(!window.confirm(`Return every Top 3 position in ${month} to the automatic student-interest ranking?`))return;
  setSaving(true);
  try{
   const {error}=await (supabase as any).from("reskonnect_monthly_top3_editorial")
    .delete().eq("month_start",monthStart);
   if(error)throw error;
   toast.success("Automatic Top 3 ranking restored");
  }catch(err){toast.error(err instanceof Error?err.message:"Unable to reset ranking");}
  finally{setSaving(false);await load();}
 };
 return <section aria-label="Monthly top three management" className="mb-6 overflow-hidden rounded-2xl border border-[#dce4f0] bg-white shadow-sm">
  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e7eaf1] bg-[#f8fafc] p-5">
   <div className="max-w-2xl">
    <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#2563eb]"><ChartNoAxesCombined className="h-4 w-4"/> ResKonnect · monthly showcases</p>
    <h3 className="mt-2 text-xl font-black text-[#071326] sm:text-2xl">Manage the Top 3 of the month</h3>
    <p className="mt-2 text-sm leading-6 text-[#42526a]">Choose a residence for any of the three positions, or leave it on Automatic to use measured student activity. Editorial selections are explicitly labelled on the public website.</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    <label htmlFor="rk-top3-month" className="text-xs font-bold text-[#071326]"><CalendarDays className="mr-1 inline h-4 w-4"/>Month</label>
    <input id="rk-top3-month" type="month" value={month} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value))setMonth(e.target.value);}} className="h-10 rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm text-[#071326]"/>
    <Button variant="outline" size="sm" disabled={saving||loading||rows.length===0} onClick={()=>void reset()}><RotateCcw className="mr-1.5 h-4 w-4"/>Reset month</Button>
   </div>
  </div>
  <div className="grid gap-3 p-4 md:grid-cols-3">
   {[1,2,3].map(position=>{
    const selected=rows.find(r=>r.position===position)?.residence_id||"";
    const original=organic.find(r=>r.rank_position===position);
    return <div key={position} className="rounded-xl border border-[#e0e7f1] bg-white p-4">
     <div className="mb-3 flex items-center justify-between gap-2">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#071326] text-sm font-black text-[#f5b32f]">#{position}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">{selected?"Editorial selection":"Automatic ranking"}</span>
     </div>
     <label htmlFor={`rk-top3-slot-${position}`} className="mb-1 block text-xs font-semibold text-[#071326]">Residence</label>
     <select id={`rk-top3-slot-${position}`} className="h-11 w-full rounded-lg border border-[#cbd5e1] bg-white px-2 text-sm text-[#071326]" value={selected}
      disabled={saving||loading} onChange={e=>void choose(position,e.target.value)}>
      <option value="">Automatic · student demand</option>
      {candidates.filter(r=>r.id===selected||!rows.some(s=>s.residence_id===r.id)).map(r=><option key={r.id} value={r.id}>{r.name}{r.city?` · ${r.city}`:""}</option>)}
     </select>
     <p className="mt-3 min-h-10 text-xs leading-5 text-[#64748b]">{selected?"Labelled as a ResKonnect editorial choice, not an organic performance winner.":original?`Organic benchmark: ${names.get(original.residence_id)||"Residence"} · ${original.activity_score} activity points.`:"No qualifying organic activity recorded for this position."}</p>
    </div>;
   })}
  </div>
  <p className="flex items-start gap-2 border-t border-[#e7eaf1] px-5 py-3 text-xs leading-5 text-[#475569]">
   <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]"/>
   Only administrators can save selections. Months are independent; future selections activate in their month. The original organic analytics, student review scores, sponsored labels, and accreditation rules remain unchanged.
  </p>
 </section>;
}
