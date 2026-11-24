import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {BedDouble,CheckCircle2,Clock3,RefreshCw,Search,Users} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {supabase} from "@/integrations/supabase/client";
import {toast} from "sonner";

type RoomRequest={
 id:string;user_id:string;full_name:string;phone:string;academic_year:number;
 semester:number;campus:string;preferred_residence:string;budget:number|null;
 funding_type:string;status:string;notes:string;staff_response:string;
 matched_residence_id:string|null;created_at:string;updated_at:string;
};
const statuses=["waiting","searching","matched","placed","withdrawn"] as const;
const format=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const period=(value:number)=>value===3?"Full year":value===2?"Semester 2":"Semester 1";

export default function AdminSingleRoomRequestsContent(){
 const [rows,setRows]=useState<RoomRequest[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [status,setStatus]=useState("all");
 const [year,setYear]=useState("all");
 const [activeId,setActiveId]=useState<string|null>(null);
 const [drafts,setDrafts]=useState<Record<string,{status:string;staff_response:string;confirmed:boolean}>>({});
 const load=useCallback(async()=>{
   setLoading(true);
   try{
     const all:RoomRequest[]=[];
     for(let page=0;page<15;page++){
       const {data,error:err}=await (supabase as any).from("single_room_waitlist")
         .select("id,user_id,full_name,phone,academic_year,semester,campus,preferred_residence,budget,funding_type,status,notes,staff_response,matched_residence_id,created_at,updated_at")
         .order("created_at",{ascending:false}).range(page*200,page*200+199);
       if(err)throw err;
       all.push(...(data||[]));
       if((data||[]).length<200)break;
     }
     setRows(all);setError("");
   }catch(e:any){setError(e?.message||"Could not load single-room requests");}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const filtered=useMemo(()=>rows.filter(row=>{
   const text=[row.full_name,row.phone,row.campus,row.preferred_residence,row.funding_type,row.status].join(" ").toLowerCase();
   return text.includes(search.toLowerCase())&&(status==="all"||row.status===status)&&(year==="all"||String(row.academic_year)===year);
 }),[rows,search,status,year]);
 const years=[...new Set(rows.map(r=>r.academic_year))].sort((a,b)=>b-a);
 const update=async(row:RoomRequest)=>{
   const draft=drafts[row.id]||{status:row.status,staff_response:row.staff_response,confirmed:false};
   if(["matched","placed"].includes(draft.status)&&!draft.confirmed){
     toast.error("Confirm a real single-room match and the student-visible next step before marking matched or placed.");return;
   }
   if(draft.status!=="withdrawn"&&!draft.staff_response.trim()){
     toast.error("Provide a student-visible response before changing the request.");return;
   }
   setActiveId(row.id);
   try{
     const {error:err}=await (supabase as any).from("single_room_waitlist")
       .update({status:draft.status,staff_response:draft.staff_response.trim(),updated_at:new Date().toISOString()})
       .eq("id",row.id).select("id").single();
     if(err)throw err;
     toast.success("Single-room request updated");
     await load();
   }catch(e:any){toast.error(e?.message||"Update failed");}
   finally{setActiveId(null);}
 };
 return <section className="space-y-5" aria-label="Single-room request operations">
   <div className="rounded-3xl border bg-gradient-to-br from-[#061633] via-[#103e83] to-[#154fa0] p-5 text-white shadow-xl sm:p-7">
     <div className="flex flex-wrap items-center justify-between gap-4">
       <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-slate-950"><BedDouble className="h-6 w-6"/></span>
         <div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-300">2027 private room support</p><h2 className="text-2xl font-black">Single Room Requests</h2></div>
       </div>
       <Button variant="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
     </div>
     <p className="mt-3 max-w-3xl text-sm text-white/80">A dedicated intake queue alongside applications and reservations. Requests are not confirmed room allocations. Match against verified availability before changing their status.</p>
     <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
       {([["Total",rows.length,Users],["Waiting",rows.filter(x=>x.status==="waiting").length,Clock3],["Matching",rows.filter(x=>x.status==="searching").length,Search],["Matched / placed",rows.filter(x=>["matched","placed"].includes(x.status)).length,CheckCircle2]] as const).map(([label,count,Icon])=>
         <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-3"><Icon className="h-4 w-4 text-amber-300"/><p className="mt-2 text-2xl font-black">{count}</p><p className="text-xs text-white/70">{label}</p></div>)}
     </div>
   </div>
   <div className="flex flex-wrap gap-3 rounded-2xl border bg-card p-3">
     <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Search student, contact or campus" value={search} onChange={e=>setSearch(e.target.value)}/></div>
     <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[155px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map(s=><SelectItem key={s} value={s}>{format(s)}</SelectItem>)}</SelectContent></Select>
     <Select value={year} onValueChange={setYear}><SelectTrigger className="w-[115px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All years</SelectItem>{years.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
   </div>
   {error&&<div role="alert" className="rounded-xl border border-destructive p-4 text-sm">{error}</div>}
   {loading&&<p className="text-sm text-muted-foreground">Loading live single-room intake…</p>}
   {!loading&&!filtered.length&&<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No requests match these filters.</div>}
   <div className="grid gap-4 lg:grid-cols-2">
     {filtered.map(row=>{
       const draft=drafts[row.id]||{status:row.status,staff_response:row.staff_response||"",confirmed:false};
       const set=(patch:Partial<typeof draft>)=>setDrafts(d=>({...d,[row.id]:{...draft,...patch}}));
       return <article key={row.id} className="min-w-0 space-y-3 rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
         <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-lg font-black">{row.full_name}</h3><p className="text-xs text-muted-foreground">{row.academic_year} · {period(row.semester)} · {row.campus}</p></div><Badge variant={row.status==="withdrawn"?"secondary":"outline"}>{format(row.status)}</Badge></div>
         <p className="text-sm"><strong>Preferred:</strong> {row.preferred_residence||"Flexible"} · <strong>Budget:</strong> {row.budget===null?"Not specified":"R"+row.budget} · <strong>Funding:</strong> {format(row.funding_type)}</p>
         <p className="rounded-xl bg-muted/40 p-3 text-sm leading-5">{row.notes||"No additional notes"}</p>
         <p className="text-xs text-muted-foreground">Student contact: {row.phone} · Submitted {new Date(row.created_at).toLocaleDateString("en-ZA")}</p>
         <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
           <div className="space-y-1"><label className="text-xs font-bold" htmlFor={`single-status-${row.id}`}>Status</label>
             <select id={`single-status-${row.id}`} value={draft.status} onChange={e=>set({status:e.target.value,confirmed:false})} className="w-full rounded-lg border bg-background p-2 text-sm">{statuses.map(s=><option key={s} value={s}>{format(s)}</option>)}</select></div>
           <div className="space-y-1"><label className="text-xs font-bold" htmlFor={`single-reply-${row.id}`}>Student-visible response</label><Textarea id={`single-reply-${row.id}`} rows={2} maxLength={5000} value={draft.staff_response} onChange={e=>set({staff_response:e.target.value})}/></div>
         </div>
         {["matched","placed"].includes(draft.status)&&<label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={draft.confirmed} onChange={e=>set({confirmed:e.target.checked})}/>I have verified this is a single-room option and will communicate the actual next steps.</label>}
         <div className="flex flex-wrap items-center justify-between gap-2">
           <Button size="sm" disabled={activeId===row.id} onClick={()=>void update(row)}>{activeId===row.id?"Saving…":"Save student update"}</Button>
           <Button variant="link" size="sm" asChild><Link to="/admin/student-care">Open full student care</Link></Button>
         </div>
       </article>;
     })}
   </div>
 </section>;
}
