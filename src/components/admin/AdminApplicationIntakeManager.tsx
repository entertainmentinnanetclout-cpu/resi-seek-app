import {useCallback,useEffect,useMemo,useState} from "react";
import {CalendarClock,LockKeyhole,RefreshCw,ShieldCheck,UnlockKeyhole} from "lucide-react";
import {toast} from "sonner";
import {supabase} from "@/integrations/supabase/client";
import {useAuth} from "@/contexts/AuthContext";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Badge} from "@/components/ui/badge";
import type {ResidenceIntakeRule} from "@/lib/residenceIntake";

type Residence={id:string;name:string;accepts_private:boolean};
export default function AdminApplicationIntakeManager(){
 const {user}=useAuth();
 const [residences,setResidences]=useState<Residence[]>([]);
 const [rules,setRules]=useState<ResidenceIntakeRule[]>([]);
 const [year,setYear]=useState("2026");
 const [residenceId,setResidenceId]=useState("");
 const [starts,setStarts]=useState("2026-11-01");
 const [ends,setEnds]=useState("2026-12-31");
 const [saving,setSaving]=useState(false);
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const [r,g]=await Promise.all([
    supabase.from("residences").select("id,name,accepts_private").order("name"),
    (supabase as any).from("residence_application_intake").select("*").order("academic_year",{ascending:false})
   ]);
   if(r.error||g.error)throw r.error||g.error;
   setResidences((r.data||[]) as Residence[]);
   setRules((g.data||[]) as ResidenceIntakeRule[]);
  }catch(e){toast.error(e instanceof Error?e.message:"Could not load application intake settings");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const selected=useMemo(()=>rules.find(r=>r.academic_year===Number(year)&&r.residence_id===residenceId),[rules,year,residenceId]);
 const active=rules.filter(r=>r.academic_year===Number(year)&&r.is_open).length;
 const chooseResidence=(id:string)=>{
  setResidenceId(id);
  const rule=rules.find(r=>r.residence_id===id&&r.academic_year===Number(year));
  setStarts(rule?.opens_on||year+"-11-01");
  setEnds(rule?.closes_on||year+"-12-31");
 };
 const chooseYear=(newYear:string)=>{
  setYear(newYear);setResidenceId("");
  setStarts(newYear+"-11-01");setEnds(newYear+"-12-31");
 };
 const save=async(open:boolean)=>{
  if(!user?.id||!residenceId)return toast.error("Choose a residence first");
  const selectedResidence=residences.find(r=>r.id===residenceId);
  if(!selectedResidence?.accepts_private)return toast.error("This residence is not configured for private tenants");
  if(!starts||!ends||ends<starts)return toast.error("Use a valid date window");
  if(open&&!window.confirm("Open "+selectedResidence.name+" applications for PRIVATE-PAYING tenants only, "+starts+" to "+ends+"? This allows new student submissions."))return;
  setSaving(true);
  try{
   const {error}=await (supabase as any).from("residence_application_intake").upsert({
    residence_id:residenceId,academic_year:Number(year),private_only:true,
    is_open:open,opens_on:starts,closes_on:ends,updated_by:user.id,updated_at:new Date().toISOString()
   },{onConflict:"residence_id,academic_year"});
   if(error)throw error;
   toast.success(open?"Private application window enabled":"Application window closed");
   await refresh();
  }catch(e){toast.error(e instanceof Error?e.message:"Could not update intake");}
  finally{setSaving(false);}
 };
 return <Card className="border-primary/20">
  <CardHeader className="pb-3"><div className="flex items-start justify-between gap-2">
   <div><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5"/>Accommodation application control</CardTitle>
    <p className="mt-2 text-sm text-muted-foreground">All new applications are blocked by the database unless you explicitly open a residence. 2027 reservations remain separate.</p></div>
   <Button variant="outline" size="sm" onClick={()=>void refresh()} disabled={loading}><RefreshCw className="mr-1 h-4 w-4"/>Refresh</Button>
  </div></CardHeader>
  <CardContent className="space-y-4">
   <div className="flex flex-wrap items-center gap-2"><Badge variant={active?"default":"secondary"}>{active} enabled for {year}</Badge>
    <Badge variant="outline">Private-paying tenants only</Badge><Badge variant="outline">Admin authorization required</Badge></div>
   <div className="grid gap-3 sm:grid-cols-2">
    <div><Label>Application academic year</Label><Select value={year} onValueChange={chooseYear}>
     <SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="2026">2026 · historical / late private intake</SelectItem><SelectItem value="2027">2027 · currently closed</SelectItem></SelectContent>
    </Select></div>
    <div><Label>Residence to configure</Label><Select value={residenceId} onValueChange={chooseResidence}>
     <SelectTrigger><SelectValue placeholder="Select a residence"/></SelectTrigger><SelectContent>{residences.filter(r=>r.accepts_private).map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
    </Select></div>
    <div><Label htmlFor="intake-from">Open from</Label><Input id="intake-from" type="date" value={starts} onChange={e=>setStarts(e.target.value)}/></div>
    <div><Label htmlFor="intake-until">Close after</Label><Input id="intake-until" type="date" value={ends} onChange={e=>setEnds(e.target.value)}/></div>
   </div>
   {residenceId&&<div className="rounded-lg bg-muted/40 p-3 text-sm"><p className="font-semibold">{selected?.is_open?"Configured open window":"No open application window"}</p>
    <p className="mt-1 text-xs text-muted-foreground">Applications are accepted only within these dates, for the selected residence/year, and with private-paying funding. Closed rules are enforced server-side.</p></div>}
   <div className="flex flex-wrap gap-2">
    <Button onClick={()=>void save(true)} disabled={!residenceId||saving}><UnlockKeyhole className="mr-2 h-4 w-4"/>Authorize private applications</Button>
    <Button variant="outline" onClick={()=>void save(false)} disabled={!residenceId||saving}><LockKeyhole className="mr-2 h-4 w-4"/>Close applications</Button>
   </div>
   <div className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0"/>Changing this schedule does not modify existing applications or reservations.</div>
  </CardContent>
 </Card>;
}
