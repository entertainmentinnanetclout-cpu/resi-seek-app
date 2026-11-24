import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {BedSingle,ClipboardList,Download,RefreshCw,Search,ShieldCheck,UsersRound} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {supabase} from "@/integrations/supabase/client";
import {readAllPages,friendlyStatus} from "@/lib/studentCare";
import {downloadText,toCsv} from "@/lib/contactExport";
import {toast} from "sonner";

type RoomStatus="waiting"|"searching"|"matched"|"placed"|"withdrawn";
type WaitlistRecord={
  id:string; user_id:string; full_name:string; phone:string; campus:string;
  academic_year:number; semester:number; room_type:string;
  preferred_residence:string; budget:number|null; funding_type:string;
  move_in_date:string|null; notes:string; staff_response:string;
  matched_residence_id:string|null; status:RoomStatus;
  created_at:string; updated_at:string;
};
const STATUSES:RoomStatus[]=["waiting","searching","matched","placed","withdrawn"];
const period=(value:number)=>value===3?"Full academic year / both semesters":value===2?"Second semester":"First semester";
const money=(value:number|null)=>value==null?"Budget not provided":`R${Number(value).toLocaleString("en-ZA")}/month`;
const isActive=(s:RoomStatus)=>s==="waiting"||s==="searching"||s==="matched";
const date=(value:string)=>new Date(value).toLocaleDateString("en-ZA",{year:"numeric",month:"short",day:"numeric",timeZone:"Africa/Johannesburg"});

function RoomQueueRecord({record,onSaved}:{record:WaitlistRecord;onSaved:()=>Promise<void>}){
  const[status,setStatus]=useState<RoomStatus>(record.status);
  const[response,setResponse]=useState(record.staff_response||"");
  const[verified,setVerified]=useState(false);
  const[busy,setBusy]=useState(false);
  useEffect(()=>{setStatus(record.status);setResponse(record.staff_response||"");setVerified(false);},
    [record.id,record.status,record.staff_response]);

  const dirty=status!==record.status||response!==record.staff_response;
  const save=async()=>{
    if(!dirty)return;
    if((status==="matched"||status==="placed")&&!verified)
      return toast.error("Confirm that the proposed accommodation is a genuine single-occupancy room.");
    if(status==="placed"&&!response.trim())
      return toast.error("Record the confirmed single-room placement and next step before marking placed.");
    if(status==="withdrawn"&&record.status!=="withdrawn"&&!window.confirm("Withdraw this request? The student will no longer be in the active single-room queue."))return;
    setBusy(true);
    try{
      const payload={status,staff_response:response.trim(),updated_at:new Date().toISOString()};
      // RLS permits this ONLY to a recognised AAL2 staff/admin session.
      const {data,error}=await(supabase as any).from("single_room_waitlist")
        .update(payload).eq("id",record.id).select("id,status,staff_response").maybeSingle();
      if(error)throw error;
      if(!data||data.id!==record.id||data.status!==status)
        throw new Error("Update was not confirmed. Verify your admin permissions and refresh the queue.");
      toast.success("Single-room case updated; the response is visible to the student.");
      await onSaved();
    }catch(error:any){
      toast.error(error?.message||"Unable to save single-room update");
    }finally{setBusy(false);}
  };

  return <article className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words font-black">{record.full_name}</h3>
          <Badge variant={isActive(record.status)?"secondary":"outline"}>{friendlyStatus(record.status)}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{record.academic_year} · {period(record.semester)} · {record.campus}</p>
        <p className="mt-1 text-xs text-muted-foreground">Submitted {date(record.created_at)} · {money(record.budget)} · {friendlyStatus(record.funding_type)}</p>
      </div>
      <Button variant="outline" size="sm" asChild><Link to={`/admin/students/${record.user_id}`}>Student 360</Link></Button>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
      <a className="font-semibold text-primary underline underline-offset-2" href={`tel:${record.phone.replace(/[^+\d]/g,"")}`}>{record.phone}</a>
      <span className="text-muted-foreground">Residence preference: {record.preferred_residence?.trim()||"Any residence — flexible"}</span>
      {record.move_in_date&&<span className="text-muted-foreground">Preferred move-in: {record.move_in_date}</span>}
    </div>
    {record.notes&&<p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs leading-relaxed">{record.notes}</p>}
    <details className="mt-3 rounded-xl border">
      <summary className="cursor-pointer px-3 py-3 text-sm font-bold">Manage request and send student-facing update</summary>
      <div className="grid gap-3 border-t p-3">
        <label className="grid gap-1 text-sm font-semibold">Request stage
          <select className="h-10 rounded-lg border bg-background px-3 text-sm font-normal"
            value={status} onChange={event=>{setStatus(event.target.value as RoomStatus);setVerified(false);}}>
            {STATUSES.map(value=><option value={value} key={value}>{friendlyStatus(value)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Student-facing response / next step
          <Textarea maxLength={5000} rows={3} value={response}
            placeholder="We are searching across residences for a single-occupancy room…"
            onChange={event=>setResponse(event.target.value)}/>
        </label>
        {(status==="matched"||status==="placed")&&<label className="flex items-start gap-2 text-xs">
          <input className="mt-0.5" type="checkbox" checked={verified} onChange={event=>setVerified(event.target.checked)}/>
          <span>I verified this is an actual single-occupancy option{status==="placed"?" and confirmed the placement with the student":""}. This is not an automatic allocation.</span>
        </label>}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">Updates only this waitlist record; no residence application, reservation or outbound message is created.</p>
          <Button disabled={!dirty||busy} onClick={()=>void save()}>{busy?"Saving…":"Save update"}</Button>
        </div>
      </div>
    </details>
  </article>;
}

/** The single-room queue is intentionally independent from applications, feedback,
 * marketing partners and legacy Student Care joins. A failing workspace must never
 * conceal a valid waitlist record.
 */
export default function SingleRoomWaitlistQueue(){
  const[records,setRecords]=useState<WaitlistRecord[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[authorized,setAuthorized]=useState<boolean|null>(null);
  const[search,setSearch]=useState("");
  const[year,setYear]=useState("2027");
  const[status,setStatus]=useState("active");
  const[semester,setSemester]=useState("all");

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      // Do not silently show an empty list when the session lacks staff AAL2.
      const access=await(supabase as any).rpc("adminos_is_staff");
      if(access.error)throw access.error;
      setAuthorized(access.data===true);
      if(access.data!==true){
        setRecords([]);
        setError("A verified staff/admin session with two-factor authentication (AAL2) is required to view private single-room requests.");
        return;
      }
      const rows=await readAllPages<WaitlistRecord>(()=>(supabase as any)
        .from("single_room_waitlist").select("*")
        .order("created_at",{ascending:false}).order("id",{ascending:false}));
      setRecords(rows);
      setError("");
    }catch(error:any){
      setError(error?.message||"Could not load the single-room waiting list.");
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{
    void load();
    const channel=supabase.channel("admin-single-room-waitlist-queue")
      .on("postgres_changes",{event:"*",schema:"public",table:"single_room_waitlist"},
        ()=>{void load();}).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[load]);

  const years=useMemo(()=>[...new Set([2027,...records.map(row=>row.academic_year)])].sort((a,b)=>b-a),[records]);
  const totals=useMemo(()=>({
    total:records.length,
    waiting:records.filter(r=>r.status==="waiting").length,
    searching:records.filter(r=>r.status==="searching").length,
    matched:records.filter(r=>r.status==="matched").length,
    placed:records.filter(r=>r.status==="placed").length,
    active:records.filter(r=>isActive(r.status)).length,
  }),[records]);

  const shown=useMemo(()=>records.filter(row=>{
    if(year!=="all"&&row.academic_year!==Number(year))return false;
    if(semester!=="all"&&row.semester!==Number(semester))return false;
    if(status==="active"&&!isActive(row.status))return false;
    if(status!=="all"&&status!=="active"&&row.status!==status)return false;
    const needle=search.trim().toLocaleLowerCase("en-ZA");
    return !needle||[row.full_name,row.phone,row.campus,row.preferred_residence,row.funding_type,row.notes]
      .some(value=>String(value||"").toLocaleLowerCase("en-ZA").includes(needle));
  }),[records,year,semester,status,search]);

  const exportCsv=()=>{
    if(authorized!==true||!shown.length)return toast.info("There are no authorized results to export.");
    downloadText(`ResKonnect_Single_Room_Waitlist_${year}_${new Date().toISOString().slice(0,10)}.csv`,
      toCsv(shown.map(row=>({
        Name:row.full_name,Phone:row.phone,Campus:row.campus,Year:row.academic_year,
        "Required period":period(row.semester),Status:row.status,
        "Preferred residence":row.preferred_residence||"Any residence",
        "Monthly budget":row.budget??"",Funding:row.funding_type,
        "Move in":row.move_in_date||"",Preferences:row.notes,
        "Staff response":row.staff_response,
        "Date received":row.created_at,
      }))),"text/csv;charset=utf-8");
  };

  return <section className="space-y-5" aria-label="Single-room waiting list management">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-primary"><BedSingle className="h-5 w-5"/><span className="text-xs font-black uppercase tracking-wider">Accommodation · independent demand</span></div>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">Single-room waiting list</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Students requesting a single-occupancy room at <strong>any suitable residence</strong>.
          These are requests for help, not applications tied to a particular landlord or guaranteed bookings.
          Existing applications and reservations remain separate.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild><Link to="/single-room-waiting-list">View student form</Link></Button>
        <Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
      </div>
    </header>

    {authorized===true&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {([
        ["All",totals.total],["Active",totals.active],["Waiting",totals.waiting],
        ["Searching",totals.searching],["Matched",totals.matched],["Placed",totals.placed]
      ] as const).map(([label,count])=><div key={label} className="rounded-2xl border bg-card p-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-black tabular-nums">{count}</p>
      </div>)}
    </div>}

    {error&&<div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-bold">Waiting list needs attention</p>
      <p className="mt-1">{error}</p>
      {authorized===false&&<p className="mt-2 text-xs">Use your authorized AdminOS account and complete the existing two-factor security check. Student records are never exposed by bypassing access restrictions.</p>}
      <Button className="mt-3" size="sm" variant="outline" onClick={()=>void load()}>Retry secure access</Button>
    </div>}

    {authorized===true&&<>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_140px_170px_180px_auto]">
        <label className="grid gap-1 text-xs font-bold"><span>Search student, campus or phone</span>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
            <Input className="pl-9" placeholder="Find a single-room request" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </label>
        <label className="grid gap-1 text-xs font-bold"><span>Academic year</span>
          <select className="h-10 rounded-lg border bg-background px-3 text-sm font-normal" value={year} onChange={e=>setYear(e.target.value)}>
            <option value="all">All years</option>{years.map(value=><option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold"><span>Room period</span>
          <select className="h-10 rounded-lg border bg-background px-3 text-sm font-normal" value={semester} onChange={e=>setSemester(e.target.value)}>
            <option value="all">Any period</option><option value="3">Full year</option><option value="1">First semester</option><option value="2">Second semester</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold"><span>Case status</span>
          <select className="h-10 rounded-lg border bg-background px-3 text-sm font-normal" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="active">Active queue</option><option value="all">All cases</option>
            {STATUSES.map(value=><option key={value} value={value}>{friendlyStatus(value)}</option>)}
          </select>
        </label>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!shown.length}>
          <Download className="mr-2 h-4 w-4"/>Export CSV
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p><UsersRound className="mr-1 inline h-4 w-4"/>{shown.length} matching request(s); ordered newest first.</p>
        <p><ShieldCheck className="mr-1 inline h-4 w-4"/>Private staff-only data · CSV contains personal contact details</p>
      </div>
      {loading?<p role="status" className="rounded-xl border p-6 text-sm">Refreshing single-room requests…</p>:
        shown.length===0?<div className="rounded-xl border border-dashed p-7 text-center">
          <ClipboardList className="mx-auto mb-3 h-7 w-7 text-muted-foreground"/>
          <p className="font-semibold">No single-room requests match these filters.</p>
          <p className="mt-2 text-xs text-muted-foreground">Try All years, All cases or remove the text search.</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={()=>{setSearch("");setYear("all");setStatus("all");setSemester("all");}}>Clear filters</Button>
        </div>:
        <div className="grid items-start gap-3 xl:grid-cols-2">
          {shown.map(record=><RoomQueueRecord key={record.id} record={record} onSaved={load}/>)}
        </div>}
    </>}
  </section>;
}
