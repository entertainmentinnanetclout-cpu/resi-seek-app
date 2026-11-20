import {useCallback,useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {AlertTriangle,CheckCheck,MailCheck,RefreshCw} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";

type Case={id:string;residence_id?:string|null;property:string};
type Pending={id:string;reference:string;student_name:string;status:string;reason:string};
type Summary={
 residence_id:string;residence_name:string;academic_year:number;verified_at:string;
 total_reservations:number;unique_reservations_emailed:number;coverage_percent:number|null;not_emailed:number;
 never_attempted:number;uncertain_only:number;failed_only:number;sent_messages:number;provider_receipts:number;
 repeat_sent_messages:number;total_attempts:number;failed_attempts:number;uncertain_attempts:number;
 with_additional_uncertainty:number;by_day:{day:string;count:number}[];
 by_template:{template:string;count:number}[];pending:Pending[];
 review_uncertainty:{id:string;reference:string;status:string}[];invariant:string;
};
export default function ReservationEmailReconciliation({items,year,revision,premium,onPrepare,onSelect}:{
 items:Case[];year:string;revision:number;
 premium:(body:Record<string,unknown>)=>Promise<any>;
 onPrepare:(ids:string[])=>void;onSelect:(id:string)=>void;
}){
 const choices=useMemo(()=>Array.from(new Map(items.filter(x=>x.residence_id).map(x=>[x.residence_id!,x.property])).entries())
   .map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name)),[items]);
 const [residenceId,setResidenceId]=useState("");
 const [summary,setSummary]=useState<Summary|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
  if(choices.length&&!choices.some(x=>x.id===residenceId)){
   setResidenceId(choices.find(x=>/berlin/i.test(x.name))?.id||choices[0].id);
  }
 },[choices,residenceId]);
 const load=useCallback(async()=>{
  if(!residenceId)return;
  setLoading(true);setError("");setSummary(null);
  try{
   const data=await premium({action:"reservation_reconciliation",residence_id:residenceId,academic_year:Number(year)});
   if(!data||data.residence_id!==residenceId||Number(data.academic_year)!==Number(year))throw Error("Reconciliation scope did not match the selected residence and year");
   setSummary(data as Summary);
  }catch(e){setError(e instanceof Error?e.message:"Unable to reconcile reservation email audit");}
  finally{setLoading(false);}
 },[residenceId,year,premium]);
 useEffect(()=>{void load();},[load,revision]);
 const format=(num:number)=>num.toLocaleString("en-ZA");
 const percent=summary?.coverage_percent===null||summary?.coverage_percent===undefined?"—":summary.coverage_percent.toFixed(1)+"%";
 const eligible=summary?.pending.filter(x=>x.reason==="never_attempted").slice(0,10)||[];
 return <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="Reservation email mathematical reconciliation">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <h3 className="flex items-center gap-2 text-base font-black"><MailCheck className="h-4 w-4 text-primary"/>Reservation-to-email reconciliation</h3>
    <p className="mt-1 text-xs text-muted-foreground">Exact scoped accounting: reservation records are not Gmail messages, and template counts are not unique students.</p>
   </div>
   <Button size="sm" variant="outline" disabled={!residenceId||loading} onClick={()=>void load()}><RefreshCw className="mr-1 h-3.5 w-3.5"/>Recheck actual records</Button>
  </div>
  <div className="flex flex-wrap items-center gap-2">
   <Select value={residenceId} onValueChange={setResidenceId}>
    <SelectTrigger className="w-full max-w-[350px]" aria-label="Residence to reconcile"><SelectValue placeholder="Choose residence"/></SelectTrigger>
    <SelectContent>{choices.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
   </Select>
   <Badge variant="outline">Academic year {year}</Badge>
   {summary&&<span className="text-[11px] text-muted-foreground">Verified {new Date(summary.verified_at).toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg"})} SAST</span>}
  </div>
  {loading&&<p role="status" className="text-sm text-muted-foreground">Comparing every reservation ID with all recorded Gmail attempts…</p>}
  {error&&<p role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-700">{error}. No totals have been assumed.</p>}
  {summary&&!loading&&<>
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {([
     ["All reservations",summary.total_reservations],
     ["Reservations emailed",summary.unique_reservations_emailed],
     ["Not yet confirmed",summary.not_emailed],
     ["Gmail accepted messages",summary.sent_messages]
    ] as const).map(([label,count])=><div key={label} className="rounded-lg border bg-muted/25 p-3"><p className="text-2xl font-black tabular-nums">{format(count)}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
   </div>
   <div className="text-xs leading-6">
    <p><strong>{percent} reservation coverage</strong> · {format(summary.unique_reservations_emailed)} / {format(summary.total_reservations)} unique cases have at least one Gmail-accepted message.</p>
    <p><strong>Exact remaining:</strong> {format(summary.never_attempted)} never attempted, {format(summary.uncertain_only)} only uncertain, {format(summary.failed_only)} only failed.</p>
    <p><strong>Why messages differ:</strong> {format(summary.repeat_sent_messages)} additional successful messages to previously contacted reservations · {format(summary.total_attempts)} total attempted messages · {format(summary.uncertain_attempts)} uncertain · {format(summary.failed_attempts)} failed.</p>
    {summary.with_additional_uncertainty>0&&<p className="font-semibold text-amber-700"><AlertTriangle className="mr-1 inline h-3.5 w-3.5"/> {summary.with_additional_uncertainty} already-contacted reservation(s) also have an uncertain separate attempt. Check Gmail Sent; do not retry them blindly.</p>}
   </div>
   <details className="rounded-lg border p-3 text-xs">
    <summary className="cursor-pointer font-semibold">Breakdown by template and South African send date</summary>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
     <div><p className="mb-1 font-semibold">Gmail messages by template</p>{summary.by_template.map(t=><p key={t.template} className="flex justify-between gap-2 border-b py-1"><span>{t.template.replaceAll("_"," ")}</span><strong>{format(t.count)}</strong></p>)}</div>
     <div><p className="mb-1 font-semibold">Gmail messages by send date</p>{summary.by_day.map(t=><p key={t.day} className="flex justify-between gap-2 border-b py-1"><span>{t.day}</span><strong>{format(t.count)}</strong></p>)}</div>
    </div>
    <p className="mt-2 text-muted-foreground">Invariant: {summary.invariant}. All percentages use the complete selected residence and academic-year denominator; a zero-case denominator is undefined, not 100%.</p>
   </details>
   <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h4 className="font-bold">Reservations without a Gmail-accepted message ({summary.pending.length})</h4>
     <Button size="sm" variant="outline" disabled={!eligible.length} onClick={()=>onPrepare(eligible.map(x=>x.id))}>
      <CheckCheck className="mr-1 h-3.5 w-3.5"/>Select {eligible.length} never-attempted for review
     </Button>
    </div>
    {!summary.pending.length?<p className="text-xs text-muted-foreground">All reservations have a recorded Gmail-accepted message.</p>:
     <div className="grid max-h-72 gap-1.5 overflow-auto sm:grid-cols-2">{summary.pending.map(x=>
      <div key={x.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border p-2">
       <div className="min-w-0"><p className="truncate text-xs font-semibold">{x.student_name} · {x.reference}</p>
        <p className="text-[11px] text-muted-foreground">{x.reason.replaceAll("_"," ")} · {x.status}</p></div>
       <Button size="sm" variant="ghost" className="shrink-0" onClick={()=>onSelect(x.id)}>Review</Button>
      </div>)}</div>}
    <p className="text-[11px] text-muted-foreground">Selection prepares a maximum of 10 unsent cases. It does not send anything. An uncertain attempt requires manual verification before a new send.</p>
   </div>
  </>}
 </section>;
}
