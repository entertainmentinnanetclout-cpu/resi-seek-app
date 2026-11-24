import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {BedSingle,CalendarDays,CheckCircle2,RefreshCw,Search,UsersRound} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {supabase} from "@/integrations/supabase/client";
import {readAllPages} from "@/lib/studentCare";
import {toast} from "sonner";

type RoomRequest={
 id:string;user_id:string;full_name:string;phone:string;campus:string|null;
 academic_year:number;semester:number;room_type:string;preferred_residence:string|null;
 budget:number|null;funding_type:string|null;move_in_date:string|null;notes:string|null;
 status:string;staff_response:string|null;matched_residence_id:string|null;
 created_at:string;updated_at:string;
};
const statuses=["waiting","searching","matched","placed","withdrawn"] as const;
const friendly=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g, c=>c.toUpperCase());
const period=(semester:number)=>semester===3?"Full year":semester===2?"Second semester":"First semester";
const db=supabase as any;

export default function AdminSingleRoomQueue(){
 const [rows,setRows]=useState<RoomRequest[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState("all");
 const [selected,setSelected]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("");
 const [note,setNote]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const data=await readAllPages(()=>db.from("single_room_waitlist")
     .select("id,user_id,full_name,phone,campus,academic_year,semester,room_type,preferred_residence,budget,funding_type,move_in_date,notes,status,staff_response,matched_residence_id,created_at,updated_at")
     .order("created_at",{ascending:false}));
   setRows(data as RoomRequest[]);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Could not load single-room requests");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const filtered=useMemo(()=>rows.filter(row=>
  (filter==="all"||row.status===filter)&&
  [row.full_name,row.phone,row.campus,row.preferred_residence,row.academic_year].join(" ").toLowerCase().includes(search.toLowerCase())
 ),[rows,filter,search]);
 const editing=rows.find(x=>x.id===selected);
 const choose=(row:RoomRequest)=>{setSelected(row.id);setStatus(row.status);setNote(row.staff_response||"");};
 const save=async()=>{
  if(!editing||busy)return;
  if(["matched","placed"].includes(status)&&!editing.matched_residence_id){
   toast.error("Select and verify a suitable residence through Student Care before marking a request matched or placed.");return;
  }
  setBusy(true);
  try{
   const {error:saveError}=await db.from("single_room_waitlist")
     .update({status,staff_response:note.trim()||null})
     .eq("id",editing.id).select("id").single();
   if(saveError)throw saveError;
   toast.success("Single-room case updated");setSelected(null);await load();
  }catch(e){toast.error(e instanceof Error?e.message:"Could not update request");}
  finally{setBusy(false);}
 };
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-gradient-to-br from-[#061532] via-[#0a2c64] to-[#174f9a] p-5 text-white sm:p-7">
   <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-300"><BedSingle className="h-4 w-4"/> Student accommodation · 2027+</div>
    <h2 className="mt-2 text-2xl font-black sm:text-3xl">Single Room Requests</h2>
    <p className="mt-2 max-w-2xl text-sm text-white/80">Track the actual request list, search students, manage care status and add private staff responses. A request is not a confirmed room allocation.</p>
   </div>
   <Button variant="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh list</Button>
  </div>
  <div className="grid gap-3 sm:grid-cols-3">
   {[["Total requests",rows.length],["Waiting",rows.filter(x=>x.status==="waiting").length],["Searching or matched",rows.filter(x=>["searching","matched"].includes(x.status)).length]].map(([label,value])=>
    <Card key={label} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></CardContent></Card>)}
  </div>
  <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
   <label className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Search single room requests" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, campus or residence…" className="pl-9"/></label>
   <Select value={filter} onValueChange={setFilter}><SelectTrigger aria-label="Filter single-room status"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map(s=><SelectItem key={s} value={s}>{friendly(s)}</SelectItem>)}</SelectContent></Select>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{error}</p>}
  {loading?<div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">Loading live single-room cases…</div>:
   !filtered.length?<div className="rounded-2xl border border-dashed p-8 text-center"><UsersRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-semibold">No matching single-room requests</p><p className="mt-1 text-sm text-muted-foreground">Change the filters or refresh to see new submissions.</p></div>:
   <div className="grid gap-3 lg:grid-cols-2">{filtered.map(row=><Card key={row.id} className="rounded-2xl">
     <CardContent className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-base font-black">{row.full_name}</h3><p className="mt-1 text-xs text-muted-foreground">{row.campus||"Campus not supplied"} · {row.academic_year} · {period(Number(row.semester))}</p></div><Badge variant={row.status==="placed"?"default":"secondary"}>{friendly(row.status)}</Badge></div>
      <p className="text-sm"><span className="font-semibold">Preferred:</span> {row.preferred_residence||"Flexible"} · <span className="font-semibold">Budget:</span> {row.budget===null?"Not specified":`R${row.budget}`}</p>
      <p className="text-xs text-muted-foreground">Contact: {row.phone||"Not supplied"} · Funding: {row.funding_type||"Undecided"}</p>
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5"/>Submitted {new Date(row.created_at).toLocaleDateString("en-ZA")}{row.move_in_date?` · Requested move-in ${row.move_in_date}`:""}</p>
      {row.notes&&<p className="line-clamp-2 rounded-lg bg-muted/50 p-2 text-xs">{row.notes}</p>}
      {row.staff_response&&<p className="rounded-xl border p-2 text-xs"><span className="font-semibold">ResKonnect:</span> {row.staff_response}</p>}
      {selected===row.id?<div className="space-y-3 rounded-xl border bg-muted/20 p-3">
       <label className="block text-xs font-semibold">Status</label>
       <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{statuses.map(s=><SelectItem key={s} value={s}>{friendly(s)}</SelectItem>)}</SelectContent></Select>
       <label className="block text-xs font-semibold">Private staff response displayed to the student</label>
       <Textarea rows={3} maxLength={3000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain the next verified step or availability update…"/>
       <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void save()}><CheckCircle2 className="mr-1.5 h-4 w-4"/>Save update</Button><Button variant="outline" disabled={busy} onClick={()=>setSelected(null)}>Cancel</Button></div>
      </div>:<Button className="w-full rounded-xl" variant="outline" onClick={()=>choose(row)}>Manage request</Button>}
     </CardContent>
    </Card>)}</div>}
  <p className="text-xs text-muted-foreground">Matched or placed status requires an actual residence match on record. <Link className="font-bold text-primary underline" to="/admin/student-care">Open Student Care</Link> to manage detailed placement evidence. All personal details in this queue are staff-only.</p>
 </div>;
}
