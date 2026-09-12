import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Gauge, RefreshCw, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Snapshot={operating_score:number;open_department_tasks:number;urgent_department_tasks:number;pending_approvals:number;executive_priorities:number;red_priorities:number;platform_health_score:number;finance_high_anomalies:number;reputation_red_briefs:number;seo_high_signals:number;student_attention_cases:number;partnerships_attention:number;application_attention:number;occupancy_attention:number;metrics:Record<string,any>;release_gates:Record<string,any>;snapshot_at:string};
type Priority={id:string;area:string;department_key:string|null;priority:number;risk_level:string;title:string;rationale:string;current_count:number;requires_executive_approval:boolean;action_url:string|null;evidence:Record<string,any>;last_seen_at:string};
type Policy={action_key:string;action_group:string;authority_level:string;autonomous_allowed:boolean;requires_executive_approval:boolean;description:string};
type Approval={id:string;request_type:string;title:string;summary:string|null;risk_level:string;status:string;requested_action:Record<string,any>;created_at:string};

const label=(v:string)=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
export default function AdminExecutiveOperatingLayer(){
  const[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const[priorities,setPriorities]=useState<Priority[]>([]);
  const[policies,setPolicies]=useState<Policy[]>([]);
  const[approvals,setApprovals]=useState<Approval[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);
  const[working,setWorking]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const[s,p,pol,a]=await Promise.all([
      (supabase as any).from("adminos_company_operating_snapshots").select("*").order("snapshot_at",{ascending:false}).limit(1).maybeSingle(),
      (supabase as any).from("adminos_executive_priorities").select("*").eq("status","open").order("priority",{ascending:false}).limit(100),
      (supabase as any).from("adminos_executive_authority_policy").select("*").order("authority_level",{ascending:true}).order("action_group",{ascending:true}),
      (supabase as any).from("adminos_approval_requests").select("id,request_type,title,summary,risk_level,status,requested_action,created_at").eq("status","pending").order("created_at",{ascending:false}).limit(100),
    ]);
    if(s.error)console.warn(s.error);if(p.error)toast.error(p.error.message);if(pol.error)console.warn(pol.error);if(a.error)toast.error(a.error.message);
    setSnapshot(s.data||null);setPriorities(p.data||[]);setPolicies(pol.data||[]);setApprovals(a.data||[]);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const run=async()=>{
    setRunning(true);const{data,error}=await(supabase as any).rpc("adminos_run_rg15_now");setRunning(false);
    if(error)return toast.error(error.message||"RG15 cycle failed");
    toast.success(`Luna Executive cycle complete · company score ${Number(data?.operating_score||0)}/100`);await load();
  };

  const decide=async(item:Approval,approve:boolean)=>{
    setWorking(item.id);
    const rpc=item.request_type==="seller_payout"?"adminos_rg13_decide_payout_approval":"adminos_decide_approval";
    const args=item.request_type==="seller_payout"
      ?{p_approval_id:item.id,p_approve:approve,p_note:"Decision recorded from RG15 Executive Office"}
      :{p_approval_id:item.id,p_decision:approve?"approved":"rejected",p_note:"Decision recorded from RG15 Executive Office"};
    const{error}=await(supabase as any).rpc(rpc,args);setWorking(null);
    if(error)return toast.error(error.message||"Approval decision failed");
    toast.success(approve?"Approved":"Rejected");await load();
  };

  const score=snapshot?.operating_score??100;
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div>
      <div className="flex flex-wrap gap-2"><Badge>RG15</Badge><Badge variant="outline">Luna Executive Operating Agent</Badge><Badge variant="outline">Exception-based founder control</Badge></div>
      <h2 className="mt-3 text-2xl font-black">Executive Operating Layer</h2>
      <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Luna consolidates RG0–RG14 into one company operating score, cross-department priorities, approvals and exception routing. Routine monitoring/delegation is autonomous; contracts, banking, ownership/legal admissions, money movement, public crisis statements and production deployment remain controlled.</p>
    </div><div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button><Button onClick={()=>void run()} disabled={running}><Sparkles className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG15</Button></div></div>

    <Card className="rounded-[24px]"><CardContent className="p-6"><div className="grid gap-5 lg:grid-cols-[240px_1fr] lg:items-center">
      <div><p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Company operating score</p><p className="mt-2 text-5xl font-black">{score}/100</p><Badge className="mt-3" variant={score>=85?"default":"outline"}>{score>=90?"Strong":score>=75?"Attention":"Executive intervention"}</Badge></div>
      <div><Progress value={score} className="h-4"/><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Tiny label="Platform health" value={snapshot?.platform_health_score??100}/><Tiny label="Open tasks" value={snapshot?.open_department_tasks||0}/><Tiny label="Urgent tasks" value={snapshot?.urgent_department_tasks||0}/><Tiny label="Pending approvals" value={snapshot?.pending_approvals||0}/></div></div>
    </div></CardContent></Card>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric icon={Target} label="Exec priorities" value={snapshot?.executive_priorities||priorities.length}/>
      <Metric icon={AlertTriangle} label="Red priorities" value={snapshot?.red_priorities||priorities.filter(x=>x.risk_level==="red").length}/>
      <Metric icon={AlertTriangle} label="Finance high" value={snapshot?.finance_high_anomalies||0}/>
      <Metric icon={AlertTriangle} label="Reputation RED" value={snapshot?.reputation_red_briefs||0}/>
      <Metric icon={Gauge} label="SEO high" value={snapshot?.seo_high_signals||0}/>
      <Metric icon={Bot} label="Student attention" value={snapshot?.student_attention_cases||0}/>
      <Metric icon={Target} label="Partner attention" value={snapshot?.partnerships_attention||0}/>
      <Metric icon={Target} label="Application attention" value={snapshot?.application_attention||0}/>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="rounded-[22px]"><CardHeader><CardTitle>Luna executive priorities</CardTitle></CardHeader><CardContent className="space-y-3">
        {priorities.length===0?<Empty text="No company-wide material priorities are open."/>:priorities.map(p=><div key={p.id} className="rounded-2xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><Badge variant={p.risk_level==="red"?"destructive":"outline"}>{label(p.risk_level)}</Badge><Badge variant="secondary">{label(p.area)}</Badge>{p.department_key&&<Badge variant="outline">{label(p.department_key)}</Badge>}{p.requires_executive_approval&&<Badge variant="outline">Decision required</Badge>}</div><strong>{p.priority}/100</strong></div>
          <p className="mt-3 font-black">{p.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{p.rationale}</p>
        </div>)}
      </CardContent></Card>

      <Card className="rounded-[22px]"><CardHeader><CardTitle>Executive approval queue</CardTitle></CardHeader><CardContent className="space-y-3">
        {approvals.length===0?<Empty text="No AdminOS approvals are waiting for an Executive decision."/>:approvals.map(a=><div key={a.id} className="rounded-2xl border p-4"><div className="flex flex-wrap gap-2"><Badge variant={a.risk_level==="red"?"destructive":"outline"}>{label(a.risk_level)}</Badge><Badge variant="secondary">{label(a.request_type)}</Badge></div><p className="mt-2 font-black">{a.title}</p><p className="mt-1 text-xs text-muted-foreground">{a.summary}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={()=>void decide(a,false)} disabled={working===a.id}>Reject</Button><Button size="sm" onClick={()=>void decide(a,true)} disabled={working===a.id}><ShieldCheck className="mr-2 h-4 w-4"/>Approve</Button></div></div>)}
      </CardContent></Card>
    </div>

    <Card className="rounded-[22px]"><CardHeader><CardTitle>Authority constitution</CardTitle></CardHeader><CardContent>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{policies.map(p=><div key={p.action_key} className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-2"><Badge variant={p.authority_level==="red"?"destructive":"outline"}>{p.authority_level.toUpperCase()}</Badge><Badge variant="secondary">{p.autonomous_allowed?"Autonomous":"Human controlled"}</Badge></div><p className="mt-3 text-sm font-black">{label(p.action_key)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{p.description}</p></div>)}</div>
    </CardContent></Card>
  </div>;
}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Tiny({label,value}:{label:string;value:number}){return <div className="rounded-xl bg-muted/40 p-3 text-center"><p className="text-lg font-black">{Number(value||0).toLocaleString("en-ZA")}</p><p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p></div>;}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-5 w-5"/>{text}</div>;}
