import {useCallback,useEffect,useState} from "react";
import type {FormEvent} from "react";
import {Link,useNavigate} from "react-router-dom";
import {Activity,ArrowRight,BookOpenCheck,ClipboardCheck,FileCheck2,
 GraduationCap,HeartHandshake,Home,Mail,RefreshCw,Search,ShieldCheck,Sparkles,UsersRound,Workflow} from "lucide-react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import {supabase} from "@/integrations/supabase/client";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

type Metrics={open:number;overdue:number;unanswered:number;recent_open:number;recent_unanswered:number;
 pending_documents:number;pending_application_documents:number;delegated_residence_open:number;
 residence_recommendations_pending:number;wil_open:number;partner_open:number;post_service:number;needs_recovery:number};
type StudentHit={user_id:string;full_name:string|null;student_number:string|null;email:string|null;
 campus:string|null;student_stage:string|null;course:string|null};
type QueueItem={id:string;kind:string;customer:string;status:string;step:string;next_action:string;
 priority:string;next_action_due_at:string|null;needs_reply:boolean;overdue:boolean};
const human=(text:string)=>String(text||"Unspecified").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
const work=[
 {id:"journeys",title:"People & Journeys",tag:"ONE PERSON",desc:"Locate a student and see the entire school-to-career relationship.",
  Icon:UsersRound,to:"/admin/users",small:"Student directory"},
 {id:"service",title:"Needs My Decision",tag:"EXCEPTION QUEUE",desc:"Act on overdue service, missing replies, recovery and time-sensitive requests.",
  Icon:Workflow,to:"/admin/golden-cycle?filter=overdue",small:"Golden Service Cycle"},
 {id:"applications",title:"Applications & Housing",tag:"BULK WORK",desc:"Update multiple applications safely, review room eligibility and manage handover.",
  Icon:Home,to:"/admin/applications",small:"Application operations"},
 {id:"communications",title:"Communication Centre",tag:"ONE INBOX",desc:"Work from linked case context; review actual delivery, not just composed drafts.",
  Icon:Mail,to:"/admin/communications?tab=email",small:"Mail Dock & WhatsApp"},
 {id:"verification",title:"Evidence & Approvals",tag:"HUMAN GATES",desc:"Review real documents, funding evidence and decisions before final sign-off.",
  Icon:FileCheck2,to:"/admin/documents",small:"Document review"},
 {id:"opportunities",title:"Education → Employment",tag:"LIFETIME VALUE",desc:"Coordinate admission support, WIL, placements, partners and aftercare.",
  Icon:GraduationCap,to:"/admin/wil",small:"WIL & student opportunities"}
] as const;
export default function AdminBrain(){
 const navigate=useNavigate();
 const [metrics,setMetrics]=useState<Partial<Metrics>|null>(null);
 const [cases,setCases]=useState<QueueItem[]>([]);
 const [search,setSearch]=useState(""),[matches,setMatches]=useState<StudentHit[]>([]);
 const [loading,setLoading]=useState(true),[searching,setSearching]=useState(false);
 const [error,setError]=useState(""),[searchError,setSearchError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const [queue,attention]=await Promise.all([
    (supabase as any).rpc("rk_golden_service_queue",{p_filter:"recent",p_kind:null,p_limit:10,p_offset:0}),
    (supabase as any).rpc("rk_golden_service_queue",{p_filter:"overdue",p_kind:null,p_limit:10,p_offset:0})
   ]);
   if(queue.error||attention.error)throw new Error(queue.error?.message||attention.error?.message||"Secure workflow snapshot failed");
   const q=typeof queue.data==="string"?JSON.parse(queue.data):queue.data;
   const a=typeof attention.data==="string"?JSON.parse(attention.data):attention.data;
   setMetrics(q.metrics||null);
   setCases(Array.isArray(a.items)?a.items:[]);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load secured mission data");setMetrics(null);setCases([]);}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const searchPeople=async(e:FormEvent)=>{
  e.preventDefault();
  if(search.trim().length<2){setMatches([]);setSearchError("Enter at least two letters or numbers.");return;}
  setSearching(true);setSearchError("");
  try{
   const {data,error:failed}=await (supabase as any).rpc("rk_student_360_search",{p_query:search.trim(),p_limit:15});
   if(failed)throw failed;
   const rows=typeof data==="string"?JSON.parse(data):data;
   setMatches(Array.isArray(rows)?rows:[]);
  }catch(e){setMatches([]);setSearchError(e instanceof Error?e.message:"Student directory search failed");}
  finally{setSearching(false);}
 };
 const count=(id:string):number|null=>{
  if(!metrics)return null;
  switch(id){
   case "journeys":return null;
   case "service":return metrics.overdue??null;
   case "applications":return null; // A global open-case count is not an application count.
   case "communications":return metrics.recent_unanswered??null;
   case "verification":return (metrics.pending_documents??0)+(metrics.pending_application_documents??0);
   case "opportunities":return (metrics.wil_open??0)+(metrics.partner_open??0);
   default:return null;
  }
 };
 return <AdminLayout>
  <SEO noIndex title="ResKonnect Brain | Student 360" description="Unified and private solo-operator student lifecycle mission control"/>
  <div className="rk-motion mx-auto max-w-[1600px] space-y-5 p-3 sm:p-6">
   <header className="rk-skeuo-frame rounded-[28px] bg-[linear-gradient(125deg,#071326,#123468,#1d4986)] p-5 text-white sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
     <div className="max-w-3xl">
      <Badge className="border-0 bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]"><Sparkles className="mr-1 h-3.5 w-3.5"/>STUDENT 360 · RESKONNECT BRAIN</Badge>
      <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">One company. One brain.</h1>
      <p className="mt-3 text-sm leading-7 text-white/80 sm:text-base">A person is never just an application. All incoming requests, document checks, residence decisions, verified communications and lifelong milestones connect back to one student journey.</p>
     </div>
     <Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading} className="border-white/30 bg-white/10 text-white hover:text-white"><RefreshCw className="mr-2 h-4 w-4"/>Refresh live pulse</Button>
    </div>
    <form onSubmit={searchPeople} className="mt-6 rounded-2xl border border-white/20 bg-white/10 p-3 sm:p-4">
     <label htmlFor="rk-brain-search" className="mb-2 block text-xs font-black uppercase tracking-wider text-[#F5B32F]">Find a person, not a record</label>
     <div className="flex gap-2">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-white/60"/><Input id="rk-brain-search" value={search} onChange={e=>setSearch(e.target.value)} className="border-white/25 bg-white/90 pl-9 text-[#071326] placeholder:text-[#536985]" placeholder="Student name, email or student number…"/></div>
      <Button type="submit" disabled={searching||search.trim().length<2} className="bg-[#F5B32F] font-black text-[#071326] hover:bg-[#ffca55]">{searching?"Finding…":"Find 360"}</Button>
     </div>
     <p className="mt-2 text-xs text-white/70">Protected search: God Mode MFA required. Profiles are not exposed to residents or other students.</p>
     {searchError&&<p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800" role="alert">{searchError}</p>}
     {matches.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">
      {matches.map(person=><button type="button" key={person.user_id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/20 bg-white p-3 text-left text-[#071326] hover:bg-[#edf4ff]" onClick={()=>navigate("/admin/students/"+person.user_id)}>
       <div className="min-w-0"><p className="truncate text-sm font-black">{person.full_name||"Student profile"}</p><p className="truncate text-xs text-[#536985]">{person.student_number||"No student number"} · {person.campus||"Campus pending"}</p><p className="truncate text-[11px] text-[#536985]">{person.email||"Email pending"}</p></div>
       <ArrowRight className="h-4 w-4 shrink-0 text-[#2563eb]"/>
      </button>)}
     </div>}
     {!searching&&!searchError&&search.trim().length>=2&&matches.length===0&&<p className="mt-2 text-xs text-white/70">Submit a search to load matching student profiles. A lack of results may mean this student is not yet linked to an account.</p>}
    </form>
   </header>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Executive exception pulse">
    {([
     ["Open service journeys",metrics?.open,UsersRound],
     ["Overdue actions",metrics?.overdue,Activity],
     ["New without proven reply",metrics?.recent_unanswered,Mail],
     ["Pending general files",metrics?.pending_documents,FileCheck2],
    ] as const).map(([name,value,Icon])=><div key={name} className="rk-neo-panel rounded-2xl p-4">
     <div className="flex items-center justify-between gap-2"><p className="text-xs font-black">{name}</p><Icon className="h-5 w-5 text-primary"/></div>
     <p className="mt-2 text-3xl font-black tabular-nums">{loading||value===undefined?"—":Number(value).toLocaleString("en-ZA")}</p>
    </div>)}
   </div>
   {error&&<div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
    Live workload could not be verified: {error}. Counts are unavailable, not zero. <Button variant="link" onClick={()=>void load()}>Retry</Button>
   </div>}
   <section aria-label="One connected command dashboard">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
     <div><h2 className="text-xl font-black">Six interconnected command actions</h2>
      <p className="mt-1 text-xs text-muted-foreground">Choose an outcome, not a department. The underlying specialist tools retain their secure business checks.</p></div>
     <Badge variant="outline"><ShieldCheck className="mr-1 h-3.5 w-3.5"/>No silent approvals or sends</Badge>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
     {work.map(item=><Link to={item.to} key={item.id} className="rk-neo-panel group flex min-h-[210px] flex-col justify-between rounded-[22px] border p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <div><div className="flex items-start justify-between gap-3">
       <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f0ff] text-[#174c93]"><item.Icon className="h-6 w-6"/></div>
       <span className="text-[10px] font-black uppercase tracking-wider text-[#536985]">{item.tag}</span>
      </div>
       <h3 className="mt-4 text-lg font-black">{item.title}</h3>
       <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.desc}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs font-bold text-primary">
       <span>{item.small}</span>
       <span className="flex items-center gap-1">{count(item.id)!==null&&!loading?Number(count(item.id)).toLocaleString("en-ZA")+" flagged · ":""}Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></span>
      </div>
     </Link>)}
    </div>
   </section>
   <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
    <section className="rk-neo-panel rounded-2xl p-4 sm:p-5">
     <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-black">The exception queue</h2>
      <Button variant="outline" size="sm" asChild><Link to="/admin/golden-cycle?filter=overdue">Review all overdue<ArrowRight className="ml-1.5 h-4 w-4"/></Link></Button></div>
     <p className="mt-1 text-xs text-muted-foreground">You should only personally handle what needs judgment, consent, evidence or an actual human reply.</p>
     <div className="mt-3 space-y-2">{!loading&&!error&&cases.length===0?<p className="rounded-xl border p-3 text-sm text-muted-foreground">No overdue cases returned by the verified queue.</p>:
      cases.map(c=><div key={c.kind+":"+c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
       <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black">{c.customer||"Unlinked profile"}</p><Badge variant="outline">{human(c.kind)}</Badge></div>
        <p className="mt-1 text-xs text-muted-foreground">{human(c.step)} · {c.next_action||"Investigate next step"}</p></div>
       <Button asChild size="sm" variant="outline"><Link to="/admin/golden-cycle?filter=overdue">Handle case</Link></Button>
      </div>)}
     </div>
    </section>
    <section className="rk-neo-panel rounded-2xl p-4 sm:p-5">
     <h2 className="text-base font-black">Automation operating policy</h2>
     <p className="mt-1 text-xs leading-5 text-muted-foreground">Target 95% automated coordination; reserve human work for real verification, approvals, disputes and exceptional customers.</p>
     <div className="mt-4 space-y-3">
      {([
       [BookOpenCheck,"Auto-capture & link","Reuse the same student ID across service submissions."],
       [Clock3,"Auto-queue & remind","Deadlines and follow-up candidates are calculated; actual outreach is separately recorded."],
       [ClipboardCheck,"Human verification","Never treat a draft, upload or recommendation as an approved outcome."],
       [HeartHandshake,"Aftercare","A service ends when its real outcome and satisfaction are confirmed, not at submission."]
      ] as const).map(([Icon,label,description])=><div key={label} className="flex gap-3 rounded-xl border p-3">
       <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><div><p className="text-sm font-black">{label}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div></div>)}
     </div>
     <div className="mt-4 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" asChild><Link to="/admin/partnerships">Partners</Link></Button>
      <Button size="sm" variant="outline" asChild><Link to="/admin/studio">Visual Studio</Link></Button>
      <Button size="sm" variant="outline" asChild><Link to="/admin/executive">Executive office</Link></Button>
     </div>
    </section>
   </div>
  </div>
 </AdminLayout>;
}
