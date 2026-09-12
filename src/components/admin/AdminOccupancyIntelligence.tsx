import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, BedDouble, Building2, RefreshCw, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row={
  id:string;residence_id:string;academic_year:number;capacity:number;reported_available_beds:number|null;blocked_beds:number;
  derived_occupied_beds:number|null;fill_rate:number|null;active_applications:number;active_reservations:number;confirmed_reservations:number;
  moved_in_students:number;demand_people:number;excess_demand:number;cohort_breakdown:Record<string,number>;intelligence_status:string;
  action_priority:number;recommended_action:string|null;department_key:string|null;refreshed_at:string;
  residences?:{name?:string|null;campus?:string|null}|null;
};

const currentYear=new Date().getFullYear();
const years=Array.from({length:4},(_,i)=>currentYear-1+i);
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,(x)=>x.toUpperCase());

export default function AdminOccupancyIntelligence(){
  const[rows,setRows]=useState<Row[]>([]);
  const[year,setYear]=useState(currentYear);
  const[status,setStatus]=useState("all");
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const{data,error}=await(supabase as any).from("adminos_occupancy_intelligence")
      .select("*,residences(name,campus)")
      .eq("academic_year",year)
      .order("action_priority",{ascending:false})
      .order("reported_available_beds",{ascending:false});
    if(error)toast.error(error.message||"Could not load occupancy intelligence");
    setRows(data||[]);setLoading(false);
  },[year]);
  useEffect(()=>{void load();},[load]);

  const runNow=async()=>{
    setRunning(true);
    const{data,error}=await(supabase as any).rpc("adminos_run_rg8_now");
    setRunning(false);
    if(error)return toast.error(error.message||"RG8 cycle failed");
    toast.success("Occupancy intelligence refreshed · "+Number(data?.residence_year_rows||0)+" residence-year rows");
    await load();
  };

  const filtered=useMemo(()=>rows.filter((r)=>status==="all"||r.intelligence_status===status),[rows,status]);
  const stats=useMemo(()=>({
    capacity:rows.reduce((s,r)=>s+Number(r.capacity||0),0),
    open:rows.reduce((s,r)=>s+Number(r.reported_available_beds||0),0),
    occupied:rows.reduce((s,r)=>s+Number(r.derived_occupied_beds||0),0),
    demand:rows.reduce((s,r)=>s+Number(r.demand_people||0),0),
    excess:rows.reduce((s,r)=>s+Number(r.excess_demand||0),0),
    unreported:rows.filter((r)=>r.intelligence_status==="inventory_unreported").length,
    pressure:rows.filter((r)=>["demand_pressure","full"].includes(r.intelligence_status)).length,
    opportunities:rows.filter((r)=>["vacancy_opportunity","low_fill"].includes(r.intelligence_status)).length,
  }),[rows]);

  const statuses=["all","inventory_unreported","demand_pressure","full","near_full","vacancy_opportunity","low_fill","healthy"];

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap gap-2"><Badge>RG8</Badge><Badge variant="outline">Academic-year occupancy intelligence</Badge><Badge variant="outline">No automatic room allocation</Badge></div>
        <h2 className="mt-3 text-2xl font-black">Accommodation & Occupancy Intelligence</h2>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Occupancy is calculated from the selected academic year's inventory only. Annual, semester and trimester data are demand cohorts—not separate bed pools—so the same physical capacity is never double-counted.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={String(year)} onValueChange={(v)=>setYear(Number(v))}><SelectTrigger className="w-32"><SelectValue/></SelectTrigger><SelectContent>{years.map((y)=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button>
        <Button onClick={()=>void runNow()} disabled={running}><Sparkles className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG8</Button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric icon={BedDouble} label="Capacity" value={stats.capacity}/>
      <Metric icon={BedDouble} label="Reported open" value={stats.open}/>
      <Metric icon={Building2} label="Derived occupied" value={stats.occupied}/>
      <Metric icon={Users} label="Demand people" value={stats.demand}/>
      <Metric icon={AlertTriangle} label="Excess demand" value={stats.excess}/>
      <Metric icon={AlertTriangle} label="Unreported" value={stats.unreported}/>
      <Metric icon={BarChart3} label="Pressure/full" value={stats.pressure}/>
      <Metric icon={Sparkles} label="Vacancy opportunities" value={stats.opportunities}/>
    </div>

    <div className="flex flex-wrap gap-2">
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-56"><SelectValue/></SelectTrigger><SelectContent>{statuses.map((s)=><SelectItem key={s} value={s}>{s==="all"?"All intelligence states":label(s)}</SelectItem>)}</SelectContent></Select>
      <Badge variant="outline">Marketing receives only top vacancy/low-fill opportunities</Badge>
      <Badge variant="outline">Inventory gaps create Accommodation tasks only when demand exists</Badge>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      {filtered.slice(0,80).map((row)=>{
        const fill=row.fill_rate===null?null:Number(row.fill_rate);
        const cohort=row.cohort_breakdown||{};
        return <Card key={row.id} className="rounded-[22px]">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div><CardTitle className="text-base">{row.residences?.name||"Residence"}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{row.residences?.campus||"Campus not set"} · {row.academic_year}</p></div>
              <div className="text-right"><Badge variant={row.action_priority>=90?"destructive":row.action_priority>=75?"default":"outline"}>{label(row.intelligence_status)}</Badge><p className="mt-1 text-[10px] text-muted-foreground">priority {row.action_priority}/100</p></div>
            </div>
          </CardHeader>
          <CardContent>
            {fill===null?<div className="rounded-xl bg-muted/40 p-3 text-sm font-semibold">Occupancy unknown until {row.academic_year} open beds are reported.</div>:<><div className="flex items-end justify-between"><div><p className="text-3xl font-black">{Math.round(fill)}%</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">derived fill</p></div><div className="text-right text-xs"><p><strong>{row.derived_occupied_beds||0}</strong> occupied</p><p><strong>{row.reported_available_beds||0}</strong> open · <strong>{row.blocked_beds||0}</strong> blocked</p></div></div><Progress value={fill} className="mt-3 h-2"/></>}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Tiny label="applications" value={row.active_applications}/><Tiny label="reservations" value={row.active_reservations}/><Tiny label="demand people" value={row.demand_people}/><Tiny label="confirmed" value={row.confirmed_reservations}/><Tiny label="moved in" value={row.moved_in_students}/><Tiny label="excess demand" value={row.excess_demand}/></div>
            <div className="mt-4 rounded-xl border p-3"><p className="text-xs font-black">Recommended action</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{row.recommended_action||"Continue monitoring."}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-primary">Owner: {label(row.department_key||"accommodation")}</p></div>
            <div className="mt-3 flex flex-wrap gap-1">
              {["annual","semester_1","semester_2","trimester_1","trimester_2","trimester_3","undergraduate","postgraduate","advanced"].filter((k)=>Number(cohort[k]||0)>0).map((k)=><Badge key={k} variant="secondary" className="text-[9px]">{label(k)} {Number(cohort[k]||0)}</Badge>)}
            </div>
          </CardContent>
        </Card>;
      })}
    </div>

    {!loading&&filtered.length===0&&<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No occupancy intelligence rows match this filter.</div>}
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Tiny({label,value}:{label:string;value:number}){return <div className="rounded-xl bg-muted/40 p-2"><p className="text-sm font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>;}
