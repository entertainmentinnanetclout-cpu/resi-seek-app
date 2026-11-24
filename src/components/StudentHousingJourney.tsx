import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {ArrowRight,BedDouble,Building2,CalendarCheck2,CheckCircle2,Clock3,FileCheck2,RefreshCw,ShieldCheck} from "lucide-react";
import {useAuth} from "@/contexts/AuthContext";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";

type HousingItem={
 id:string;user_id:string;residence_id:string|null;academic_year:number;
 status:string|null;created_at:string;
};
type RoomItem={id:string;academic_year:number;semester:number;status:string;preferred_residence:string;staff_response:string;created_at:string;matched_residence_id:string|null};
type Residence={id:string;name:string;slug:string|null;image_url:string|null;cover_image_url:string|null};
const closed=new Set(["cancelled","withdrawn","rejected"]);
const nice=(s:string|null)=>String(s||"received").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const date=(s:string)=>{try{return new Date(s).toLocaleDateString("en-ZA",{day:"numeric",month:"short",year:"numeric"});}catch{return "Recently";}};
function Status({value}:{value:string|null}){
 const done=["approved","placed","confirmed","matched","accepted"].includes(String(value||"").toLowerCase());
 return <Badge variant={done?"default":"secondary"} className="capitalize">{nice(value)}</Badge>;
}
export default function StudentHousingJourney(){
 const {user}=useAuth();
 const [apps,setApps]=useState<HousingItem[]>([]);
 const [reservations,setReservations]=useState<HousingItem[]>([]);
 const [rooms,setRooms]=useState<RoomItem[]>([]);
 const [residences,setResidences]=useState<Record<string,Residence>>({});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [year,setYear]=useState("2027");
 const load=useCallback(async()=>{
  if(!user?.id){setLoading(false);return;}
  setLoading(true);setError("");
  const [a,b,c]=await Promise.allSettled([
   supabase.from("applications").select("id,user_id,residence_id,academic_year,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(150),
   (supabase as any).from("accommodation_reservations").select("id,user_id,residence_id,academic_year,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(150),
   (supabase as any).from("single_room_waitlist").select("id,academic_year,semester,status,preferred_residence,staff_response,matched_residence_id,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(150),
  ]);
  const get=(r:PromiseSettledResult<any>)=>r.status==="fulfilled"&&!r.value.error?r.value.data||[]:[];
  const applications=get(a) as HousingItem[],savedReservations=get(b) as HousingItem[],singleRooms=get(c) as RoomItem[];
  setApps(applications);setReservations(savedReservations);setRooms(singleRooms);
  const failed=[a,b,c].some(r=>r.status==="rejected"||(r.status==="fulfilled"&&r.value.error));
  if(failed)setError("Some accommodation records could not be refreshed. Your saved requests are unchanged; retry to load the latest status.");
  const ids=[...new Set([...applications,...savedReservations].map(x=>x.residence_id).filter((x):x is string=>Boolean(x)))].slice(0,120);
  if(ids.length){
   const {data}=await supabase.from("residences").select("id,name,slug,image_url,cover_image_url").in("id",ids);
   if(data)setResidences(Object.fromEntries((data as Residence[]).map(r=>[r.id,r])));
  }
  setLoading(false);
 },[user?.id]);
 useEffect(()=>{void load();},[load]);
 const availableYears=useMemo(()=>[...new Set([2027,...apps.map(x=>x.academic_year),...reservations.map(x=>x.academic_year),...rooms.map(x=>x.academic_year)])].sort((a,b)=>b-a),[apps,reservations,rooms]);
 const currentApps=useMemo(()=>apps.filter(x=>String(x.academic_year)===year),[apps,year]);
 const currentReservations=useMemo(()=>reservations.filter(x=>String(x.academic_year)===year),[reservations,year]);
 const currentRooms=useMemo(()=>rooms.filter(x=>String(x.academic_year)===year),[rooms,year]);
 const activeIds=new Set([...currentApps,...currentReservations].filter(x=>x.residence_id&&!closed.has(String(x.status||"").toLowerCase())).map(x=>x.residence_id));
 const slots=activeIds.size;
 const destinations=3;
 const renderHousing=(items:HousingItem[],kind:"application"|"reservation")=>(
  <div className="grid gap-3 md:grid-cols-2">
   {!items.length?<div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No {kind==="application"?"applications":"reservations"} recorded for {year}. <Link to="/findmyres" className="font-bold text-primary underline">Browse residences</Link></div>:
    items.map(item=>{
     const residence=item.residence_id?residences[item.residence_id]:null;
     const address=item.residence_id?`/res/${encodeURIComponent(item.residence_id)}`:"/my-applications";
     return <article key={item.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
       <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">{kind==="application"?<FileCheck2 className="h-6 w-6"/>:<CalendarCheck2 className="h-6 w-6"/>}</div>
        <div className="min-w-0 flex-1"><p className="truncate font-black">{residence?.name||"Accommodation residence"}</p><p className="text-xs text-muted-foreground">{kind==="application"?"Application":"Reservation"} · {date(item.created_at)}</p></div>
        <Status value={item.status}/>
       </div>
       <p className="text-xs leading-5 text-muted-foreground">Your {kind} is on record. The status shown is the actual saved status, not confirmation of a room unless explicitly approved.</p>
       <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild><Link to={kind==="application"?"/my-applications":address}>View {kind==="application"?"application":"residence"}<ArrowRight className="ml-2 h-3.5 w-3.5"/></Link></Button>
       </div>
     </article>;
    })}
  </div>
 );
 return <section aria-label="My accommodation requests" className="space-y-5">
  <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
   <div className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-[#061633] to-[#14478d] p-5 text-white sm:p-7">
    <div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">My Living Journey</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">My applications, reservations & single rooms</h2><p className="mt-2 max-w-2xl text-sm text-white/75">Everything you have submitted, what has changed, and the next useful action — in one place.</p></div>
    <Button variant="secondary" size="sm" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:px-6">
    <label className="flex items-center gap-2 text-sm font-bold">Academic year
     <select aria-label="Select academic year" className="rounded-lg border bg-background px-3 py-2 font-bold" value={year} onChange={e=>setYear(e.target.value)}>{availableYears.map(y=><option key={y} value={String(y)}>{y}</option>)}</select>
    </label>
    <span className="text-xs text-muted-foreground">One active application and reservation at most per residence. Three distinct active residences per year.</span>
   </div>
   <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-6">
    {([["Applications",currentApps.length,FileCheck2],["Reservations",currentReservations.length,CalendarCheck2],["Single-room requests",currentRooms.length,BedDouble],["Selected residences",slots,Building2]] as const).map(([label,total,Icon])=>
     <div key={label} className="min-w-0 rounded-2xl border bg-muted/30 p-3 sm:p-4"><Icon className="h-5 w-5 text-primary"/><p className="mt-3 text-2xl font-black tabular-nums">{total}</p><p className="text-xs font-semibold text-muted-foreground">{label}</p></div>)}
   </div>
   <div className="px-4 pb-5 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-primary/[.04] p-4">
     <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/><div><p className="text-sm font-black">{slots>=destinations?"Your residence selection limit is reached":`${Math.max(0,destinations-slots)} residence ${destinations-slots===1?"choice":"choices"} remaining`}</p><p className="text-xs text-muted-foreground">A reservation and application for the same residence use one selection, not two.</p></div></div>
     <div className="flex gap-1" aria-label={`${slots} of 3 residences used`}>{Array.from({length:3},(_,i)=><span key={i} className={`h-3 w-9 rounded-full ${i<slots?"bg-primary":"bg-muted"}`}/>)}</div>
    </div>
    {slots>=3&&<p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Your three selections are in progress. Track them below rather than submitting a fourth residence.</p>}
   </div>
  </div>
  {error&&<div role="status" className="rounded-xl border border-amber-400/50 p-3 text-sm">{error}</div>}
  {loading&&<p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin"/>Updating your accommodation records…</p>}
  <Tabs defaultValue="applications" className="space-y-4">
   <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/50 p-1">
    <TabsTrigger value="applications">Applications ({currentApps.length})</TabsTrigger>
    <TabsTrigger value="reservations">Reservations ({currentReservations.length})</TabsTrigger>
    <TabsTrigger value="single-rooms">Single rooms ({currentRooms.length})</TabsTrigger>
   </TabsList>
   <TabsContent value="applications">{renderHousing(currentApps,"application")}</TabsContent>
   <TabsContent value="reservations">{renderHousing(currentReservations,"reservation")}</TabsContent>
   <TabsContent value="single-rooms"><div className="grid gap-3 md:grid-cols-2">
    {!currentRooms.length?<div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No single-room requests for {year}. <Link className="font-bold text-primary underline" to="/single-room-waiting-list">Request a private room</Link></div>:
     currentRooms.map(room=><article key={room.id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary"/><h3 className="font-black">Private single-room request</h3></div><p className="mt-1 text-xs text-muted-foreground">Submitted {date(room.created_at)} · {room.semester===3?"Full year":room.semester===2?"Semester 2":"Semester 1"}</p></div><Status value={room.status}/></div>
      <p className="text-sm"><strong>Preferred residence:</strong> {room.preferred_residence||"Flexible"}</p>
      <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Latest ResKonnect response</p><p className="mt-1 whitespace-pre-wrap text-sm">{room.staff_response||"Your request has been received. We will update you after a suitable single-room option has been reviewed."}</p></div>
      <Button asChild variant="outline" size="sm"><Link to="/single-room-waiting-list">View or manage request<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
     </article>)}
   </div></TabsContent>
  </Tabs>
  <div className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4"><Button asChild><Link to="/findmyres">Browse accommodation <ArrowRight className="ml-2 h-4 w-4"/></Link></Button><Button variant="outline" asChild><Link to="/dashboard/updates">My updates</Link></Button></div>
 </section>;
}
