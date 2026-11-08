import {useCallback,useEffect,useState} from "react";
import {BedDouble,CheckCircle2,Clock3,ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import {supabase} from "@/integrations/supabase/client";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";

type Room={id:string;room_code:string|null;name:string|null;capacity:number;available_beds:number;status:string};
export function ResKonnectReservationActions({reservationId,residenceId,status,onChanged}:{reservationId:string;residenceId:string;status:string;onChanged:()=>void}){
 const [rooms,setRooms]=useState<Room[]>([]),[chosen,setChosen]=useState(""),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  const {data,error}=await (supabase as any).from("resmap_rooms")
    .select("id,room_code,name,capacity,available_beds,status")
    .eq("residence_id",residenceId).eq("inventory_kind","physical_room")
    .eq("is_verified",true).eq("reservable",true).eq("is_published",true)
    .in("status",["available","limited"]).order("room_code").limit(150);
  if(error)toast.error(error.message);else setRooms(data||[]);
 },[residenceId]);
 useEffect(()=>{void load();},[load]);
 const invoke=async(op:"hold"|"confirm"|"release")=>{
  if(op==="hold"&&!chosen)return toast.error("Select a verified physical room.");
  if(op==="confirm"&&!window.confirm("Confirm that the physical bed, residence, applicant and current room hold have been verified? This is an actual accommodation allocation."))return;
  setBusy(true);
  const fn=op==="hold"?"reskonnect_hold_verified_room":op==="confirm"?"reskonnect_confirm_verified_room":"reskonnect_release_verified_room_hold";
  const args=op==="hold"?{p_reservation_id:reservationId,p_room_id:chosen}:{p_reservation_id:reservationId};
  const {error}=await (supabase as any).rpc(fn,args);
  setBusy(false);
  if(error)return toast.error(error.message);
  toast.success(op==="hold"?"One physical bed has a provisional hold (24 hours).":op==="confirm"?"Verified room allocation confirmed and inventory synchronized.":"Room hold released.");
  await load();onChanged();
 };
 return <Card className="border-emerald-500/20"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BedDouble className="h-4 w-4 text-emerald-600"/>Verified room allocation</CardTitle>
  <p className="text-xs text-muted-foreground">Reservation interest is not a guaranteed bed. Only published, verified, explicitly reservable <strong>physical rooms</strong> can receive a transactional hold. Holds expire after 24 hours.</p></CardHeader><CardContent className="space-y-3">
   {status==="confirmed"?<p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4"/>This reservation has a confirmed physical-room allocation.</p>
    :status==="cancelled"?<p className="text-sm text-muted-foreground">This reservation is cancelled. A new reservation request is required.</p>
    :status==="provisional_hold"?<div className="flex flex-wrap gap-2">
      <Badge variant="outline"><Clock3 className="mr-1 h-3 w-3"/>Hold awaiting staff confirmation</Badge>
      <Button disabled={busy} onClick={()=>void invoke("confirm")}><ShieldCheck className="mr-2 h-4 w-4"/>Confirm verified bed</Button>
      <Button variant="outline" disabled={busy} onClick={()=>void invoke("release")}>Release and return to contacted</Button>
     </div>
    :<><div className="space-y-2"><Label>Choose an actual verified physical room</Label>
      <Select value={chosen||"none"} onValueChange={v=>setChosen(v==="none"?"":v)}><SelectTrigger><SelectValue placeholder="Select physical room"/></SelectTrigger>
       <SelectContent><SelectItem value="none">Select physical room</SelectItem>{rooms.map(r=><SelectItem key={r.id} value={r.id}>{r.room_code||r.name||"Verified room"} · {r.available_beds} beds reported</SelectItem>)}</SelectContent></Select>
     </div>
     {rooms.length===0?<p className="rounded-lg border border-amber-500/30 p-3 text-xs text-muted-foreground">No eligible verified physical rooms are configured. The reservation can remain as interest, but it cannot be marked as a confirmed bed. Set up verified physical-room inventory first.</p>:<Button disabled={busy||!chosen} onClick={()=>void invoke("hold")}><BedDouble className="mr-2 h-4 w-4"/>Place 24-hour room hold</Button>}
    </>}
  </CardContent></Card>;
}
export function ResKonnectViewingActions({viewingId,status,onChanged}:{viewingId:string;status:string;onChanged:()=>void}){
 const choices:Record<string,string[]>={requested:["contacted","cancelled"],contacted:["scheduled","cancelled"],scheduled:["completed","no_show","cancelled"],no_show:["contacted"]};
 const statuses=choices[status]||[];
 const [next,setNext]=useState(statuses[0]||""),[confirmedAt,setConfirmedAt]=useState(""),[busy,setBusy]=useState(false);
 const [schedule,setSchedule]=useState<{viewing_status:string;preferred_date:string|null;preferred_time_window:string|null;confirmed_viewing_at:string|null}|null>(null);
 useEffect(()=>{
   let active=true;
   void (supabase as any).rpc("reskonnect_viewing_summary",{p_viewing_id:viewingId})
     .then(({data,error}:any)=>{if(active&&!error)setSchedule(Array.isArray(data)?(data[0]||null):null);});
   return()=>{active=false;};
 },[viewingId,status]);
 useEffect(()=>{setNext((choices[status]||[])[0]||"");setConfirmedAt("");},[status,viewingId]);
 const submit=async()=>{
  if(!next)return;
  if(next==="scheduled"&&!confirmedAt)return toast.error("Specify the real date/time agreed with the student.");
  if(next==="scheduled"&&!window.confirm("Have the student and residence agreed on this actual appointment?"))return;
  setBusy(true);
  const {error}=await (supabase as any).rpc("reskonnect_progress_viewing",{
   p_viewing_id:viewingId,p_status:next,p_confirmed_at:next==="scheduled"?new Date(confirmedAt).toISOString():null
  });
  setBusy(false);
  if(error)return toast.error(error.message);
  toast.success("Viewing status changed and student notification recorded.");onChanged();
 };
 if(!statuses.length)return <p className="text-xs text-muted-foreground">This viewing is completed or closed.</p>;
 return <Card><CardHeader><CardTitle className="text-base">Confirm or progress viewing</CardTitle><p className="text-xs text-muted-foreground">Scheduled status requires a real, mutually agreed appointment. The student receives an in-app status notification; no WhatsApp or email is falsely marked sent.</p></CardHeader><CardContent className="space-y-3">
  {schedule&&<div className="rounded-lg border bg-muted/20 p-3 text-sm">
    <p><strong>Requested day:</strong> {schedule.preferred_date||"No date"}</p>
    <p className="mt-1"><strong>Preferred window:</strong> {(schedule.preferred_time_window||"not specified").replaceAll("_"," ")}</p>
    {schedule.confirmed_viewing_at&&<p className="mt-1"><strong>Confirmed appointment:</strong> {new Date(schedule.confirmed_viewing_at).toLocaleString("en-ZA")}</p>}
    <p className="mt-2 text-xs text-muted-foreground">Contact information is protected; arrange confirmation using authorized ResKonnect communications.</p>
   </div>}
  <div className="space-y-1"><Label>Next viewing status</Label><Select value={next} onValueChange={setNext}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
   {statuses.map(x=><SelectItem key={x} value={x}>{x.replaceAll("_"," ")}</SelectItem>)}
  </SelectContent></Select></div>
  {next==="scheduled"&&<div className="space-y-1"><Label>Agreed viewing date and time</Label><Input type="datetime-local" value={confirmedAt} onChange={e=>setConfirmedAt(e.target.value)}/></div>}
  <Button disabled={!next||busy} onClick={()=>void submit()}>{busy?"Saving…":"Update verified viewing status"}</Button>
 </CardContent></Card>;
}
