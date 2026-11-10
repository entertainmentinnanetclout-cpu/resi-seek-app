import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Activity,ArrowRight,CheckCircle2,Clock3,Mail,MessageCircle,RefreshCw,Search,ShieldAlert,Users} from "lucide-react";
import {supabase} from "@/integrations/supabase/client";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {ScrollArea} from "@/components/ui/scroll-area";

type CaseKind="application"|"reservation"|"housing_lead"|"support_enquiry";
type Event={id:string;source:string;channel:"email"|"whatsapp"|"status";state:string;at:string};
type Contact={
 key:string;student_name:string;property:string;status:string;
 case_kind:CaseKind|null;case_id:string|null;linked:boolean;last_at:string;
 email_count:number;whatsapp_count:number;status_count:number;
 last_email_state:string|null;last_whatsapp_state:string|null;last_status_change:string|null;
 next_action:string;events:Event[];
};
type Response={items:Contact[];has_more:boolean;next_page:number;as_of:string;scope:string};
type Filter="all"|"action"|"email"|"whatsapp"|"status"|"unlinked";
type Props={
 mode:"admin"|"landlord";
 invoke:(body:Record<string,unknown>)=>Promise<any>;
 onOpenCase:(kind:CaseKind,id:string)=>void;
 refreshKey:number;
};

const friendly=(value:string)=>String(value||"").replace(/_/g," ").replace(/\b\w/g,letter=>letter.toUpperCase());
const time=(value:string)=>value?new Date(value).toLocaleString("en-ZA",{dateStyle:"medium",timeStyle:"short"}):"—";
const evidence=(event:Event)=>{
 if(event.channel==="status")return "Status changed to "+friendly(event.state);
 if(event.channel==="email")return event.state==="sent"?"Gmail accepted · not a delivery receipt":event.state==="failed"?"Email attempt failed":event.state==="unknown"?"Email outcome uncertain":friendly(event.state);
 if(event.source==="manual_whatsapp")return event.state==="opened"?"WhatsApp opened · not yet confirmed sent":event.state==="operator_marked_sent"?"Operator marked WhatsApp sent":friendly(event.state);
 return "WhatsApp "+friendly(event.state)+" · provider reported";
};
function joinPages(pages:Map<number,Response>):Contact[]{
 const merged=new Map<string,Contact>();
 for(const [_,page] of [...pages].sort((a,b)=>a[0]-b[0])){
  for(const contact of page.items){
   const old=merged.get(contact.key);
   if(!old){merged.set(contact.key,{...contact,events:[...contact.events]});continue;}
   const unique=new Map<string,Event>();
   for(const evt of [...old.events,...contact.events])unique.set(evt.source+":"+evt.id,evt);
   const events=[...unique.values()].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,80);
   const newer=contact.last_at>old.last_at?contact:old;
   merged.set(contact.key,{
    ...newer,events,
    email_count:old.email_count+contact.email_count,
    whatsapp_count:old.whatsapp_count+contact.whatsapp_count,
    status_count:old.status_count+contact.status_count
   });
  }
 }
 return [...merged.values()].sort((a,b)=>b.last_at.localeCompare(a.last_at));
}
export default function ContactActivityDashboard({mode,invoke,onOpenCase,refreshKey}:Props){
 const [pages,setPages]=useState<Map<number,Response>>(()=>new Map());
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [filter,setFilter]=useState<Filter>("all");
 const [expanded,setExpanded]=useState(true);
 const [details,setDetails]=useState<Set<string>>(()=>new Set());
 const [lastSync,setLastSync]=useState("");
 const pending=useRef(false);
 const maxPage=useRef(0);
 const load=useCallback(async(page=0,reset=false)=>{
  if(pending.current)return;
  pending.current=true;
  setLoading(true);
  try{
   const r=await invoke({action:"contact_activity",page}) as Response;
   if(!Array.isArray(r.items))throw Error("Contact activity response was incomplete");
   setPages(old=>{
    if(reset)return new Map([[0,r]]);
    const next=new Map(old);next.set(page,r);return next;
   });
   if(reset)maxPage.current=0;
   else maxPage.current=Math.max(maxPage.current,page);
   setLastSync(r.as_of||new Date().toISOString());
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load activity");}
  finally{pending.current=false;setLoading(false);}
 },[invoke]);
 useEffect(()=>{void load(0,true);},[load,refreshKey]);
 useEffect(()=>{
  // Realtime is only an acceleration path. 15-second foreground polling also
  // covers events written to private audit tables that are not replicated.
  const timer=window.setInterval(()=>{
   if(document.visibilityState==="visible")void load(0,false);
  },15_000);
  let scheduled:number|undefined;
  const channel=supabase.channel("communications-contact-activity")
   .on("postgres_changes",{event:"*",schema:"public",table:"applications"},()=>{
    if(scheduled)window.clearTimeout(scheduled);
    scheduled=window.setTimeout(()=>void load(0,false),1200);
   })
   .on("postgres_changes",{event:"*",schema:"public",table:"adminos_whatsapp_messages"},()=>{
    if(scheduled)window.clearTimeout(scheduled);
    scheduled=window.setTimeout(()=>void load(0,false),1200);
   }).subscribe();
  const visibility=()=>{if(document.visibilityState==="visible")void load(0,false);};
  document.addEventListener("visibilitychange",visibility);
  return ()=>{
   window.clearInterval(timer);
   if(scheduled)window.clearTimeout(scheduled);
   document.removeEventListener("visibilitychange",visibility);
   void supabase.removeChannel(channel);
  };
 },[load]);
 const people=useMemo(()=>joinPages(pages),[pages]);
 const lastPage=pages.get(maxPage.current);
 const more=lastPage?.has_more??false;
 const visible=useMemo(()=>people.filter(p=>{
  if(query.trim()&&!([p.student_name,p.property,p.status,p.case_kind||"",p.next_action].join(" ")).toLowerCase().includes(query.trim().toLowerCase()))return false;
  if(filter==="email")return p.email_count>0;
  if(filter==="whatsapp")return p.whatsapp_count>0;
  if(filter==="status")return p.status_count>0;
  if(filter==="unlinked")return !p.linked;
  if(filter==="action")return !/review placement and decision follow-up/i.test(p.next_action);
  return true;
 }),[people,query,filter]);
 const totalEmail=people.filter(p=>p.email_count>0).length;
 const totalWhatsapp=people.filter(p=>p.whatsapp_count>0).length;
 const totalStatus=people.filter(p=>p.status_count>0).length;
 const tab=(key:Filter,text:string)=><Button key={key} variant={filter===key?"default":"outline"} size="sm" className="h-8 text-xs" onClick={()=>setFilter(key)}>{text}</Button>;
 return <section className="border-b bg-gradient-to-b from-blue-950/[0.04] to-background px-4 py-5 sm:px-5" aria-label="Live student contact activity">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-blue-600"/>Live contact tracker
     <Badge variant="secondary">{people.length} contacts loaded</Badge></p>
    <p className="mt-1 text-xs text-muted-foreground">{mode==="admin"?"All operators · student and linked contacts":"Contacts for your assigned residences"} · Email, WhatsApp and recorded status changes</p>
    <p className="mt-1 text-[11px] text-muted-foreground">Foreground refresh every 15 seconds, plus subscribed change events · Last synced {lastSync?time(lastSync):"not yet"}</p>
   </div>
   <div className="flex gap-2">
    <Button size="sm" variant="outline" disabled={loading} onClick={()=>void load(0,false)}><RefreshCw className={"mr-1.5 h-3.5 w-3.5 "+(loading?"animate-spin":"")}/>Refresh</Button>
    <Button size="sm" variant="ghost" onClick={()=>setExpanded(v=>!v)}>{expanded?"Collapse":"Expand"} activity</Button>
   </div>
  </div>
  {error&&<div role="alert" className="mt-3 rounded-lg border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-950">
   <p className="flex items-center gap-1 font-semibold"><ShieldAlert className="h-4 w-4"/>Contact activity temporarily unavailable</p><p className="mt-1 text-xs">{error} · Previously loaded records remain visible.</p>
   <Button variant="outline" size="sm" className="mt-2" onClick={()=>void load(0,false)}>Retry activity</Button>
  </div>}
  {expanded&&<>
   <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
    {[
     {icon:Users,label:"People loaded",value:people.length},
     {icon:Mail,label:"Email recorded",value:totalEmail},
     {icon:MessageCircle,label:"WhatsApp recorded",value:totalWhatsapp},
     {icon:CheckCircle2,label:"Status updated",value:totalStatus},
    ].map(({icon:Icon,label,value})=><div key={label} className="rounded-xl border bg-card p-3">
     <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5"/>{label}</p>
     <p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>)}
   </div>
   <div className="mt-3 flex flex-wrap items-center gap-2">
    <div className="relative min-w-[190px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
     <Input aria-label="Search contacted students" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a student, status or residence…" className="pl-8"/></div>
    {tab("all","All")}{tab("action","Next actions")}{tab("email","Email")}{tab("whatsapp","WhatsApp")}{tab("status","Status changes")}
    {mode==="admin"&&tab("unlinked","Unlinked")}
   </div>
   <ScrollArea className="mt-3 h-[420px] rounded-xl border bg-card">
    {loading&&people.length===0?<p className="p-8 text-center text-sm text-muted-foreground">Loading contact activity…</p>:
     visible.length===0?<p className="p-8 text-center text-sm text-muted-foreground">No matching contacts in loaded activity. Load older activity or change the filter.</p>:
    <div className="grid gap-2 p-3 lg:grid-cols-2">
     {visible.map(person=><article key={person.key} className="min-w-0 rounded-xl border p-3.5">
      <div className="flex items-start justify-between gap-3">
       <div className="min-w-0"><p className="truncate text-sm font-bold">{person.student_name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{person.property} · {person.case_kind?friendly(person.case_kind):"Unlinked contact"}</p></div>
       <Badge variant={person.linked?"secondary":"outline"}>{person.linked?friendly(person.status):"Needs linking"}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
       {person.email_count>0&&<Badge variant="outline" className="text-[10px]"><Mail className="mr-1 h-3 w-3"/>Email {person.email_count}</Badge>}
       {person.whatsapp_count>0&&<Badge variant="outline" className="text-[10px]"><MessageCircle className="mr-1 h-3 w-3"/>WhatsApp {person.whatsapp_count}</Badge>}
       {person.status_count>0&&<Badge variant="outline" className="text-[10px]"><CheckCircle2 className="mr-1 h-3 w-3"/>Status {person.status_count}</Badge>}
      </div>
      <p className="mt-2 text-xs"><strong>Next action:</strong> {person.next_action}</p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3"/>Last activity {time(person.last_at)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
       {person.case_kind&&person.case_id&&<Button size="sm" className="h-8 text-xs" onClick={()=>onOpenCase(person.case_kind!,person.case_id!)}>Open case <ArrowRight className="ml-1 h-3.5 w-3.5"/></Button>}
       <Button size="sm" variant="outline" className="h-8 text-xs" onClick={()=>setDetails(prev=>{const n=new Set(prev);n.has(person.key)?n.delete(person.key):n.add(person.key);return n;})}>
        {details.has(person.key)?"Hide timeline":"View timeline"}
       </Button>
      </div>
      {details.has(person.key)&&<div className="mt-3 space-y-2 border-t pt-3">
       {person.events.map(e=><div key={e.source+":"+e.id} className="rounded-lg bg-muted/40 p-2 text-[11px]">
        <span className="font-semibold">{evidence(e)}</span><span className="ml-2 text-muted-foreground">{time(e.at)}</span>
       </div>)}
      </div>}
     </article>)}
    </div>}
   </ScrollArea>
   <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
    <p>Counts reflect loaded history, not guaranteed delivery. Unlinked WhatsApp contacts are not assumed to be students.</p>
    {more&&<Button variant="outline" size="sm" disabled={loading} onClick={()=>void load(maxPage.current+1,false)}>Load older activity</Button>}
   </div>
  </>}
 </section>;
}
