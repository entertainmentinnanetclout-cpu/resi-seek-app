import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Banknote, Bot, CheckCircle2, RefreshCw, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Snapshot={attributed_value_30d:number;platform_fee_30d:number;paid_payment_value_30d:number;pending_payments:number;pending_payment_value:number;pending_eft:number;high_risk_eft:number;pending_seller_payouts:number;pending_seller_payout_value:number;seller_liability:number;referral_liability:number;ai_cost_usd_24h:number;ai_cost_usd_7d:number;ai_cost_usd_30d:number;ai_tokens_30d:number;open_anomalies:number;high_anomalies:number;generated_at:string};
type Anomaly={id:string;anomaly_type:string;severity:string;amount_zar:number|null;amount_usd:number|null;requires_executive_approval:boolean;evidence:Record<string,any>;recommended_action:string;last_seen_at:string};
type Approval={id:string;title:string;summary:string|null;risk_level:string;status:string;created_at:string;requested_action:Record<string,any>};

const label=(v:string)=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
const zar=(v:any)=>"R"+Number(v||0).toLocaleString("en-ZA",{maximumFractionDigits:2});
export default function AdminFinanceAutomation(){
  const[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const[anomalies,setAnomalies]=useState<Anomaly[]>([]);
  const[approvals,setApprovals]=useState<Approval[]>([]);
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    const[s,a,p]=await Promise.all([
      (supabase as any).from("adminos_finance_snapshots").select("*").order("generated_at",{ascending:false}).limit(1).maybeSingle(),
      (supabase as any).from("adminos_finance_anomalies").select("*").eq("status","open").order("last_seen_at",{ascending:false}).limit(100),
      (supabase as any).from("adminos_approval_requests").select("id,title,summary,risk_level,status,created_at,requested_action").eq("request_type","seller_payout").eq("status","pending").order("created_at",{ascending:false}).limit(50),
    ]);
    if(s.error)console.warn(s.error);if(a.error)toast.error(a.error.message);if(p.error)console.warn(p.error);
    setSnapshot(s.data||null);setAnomalies(a.data||[]);setApprovals(p.data||[]);setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const run=async()=>{
    setRunning(true);const{data,error}=await(supabase as any).rpc("adminos_run_rg13_now");setRunning(false);
    if(error)return toast.error(error.message||"RG13 cycle failed");
    toast.success(`RG13 complete · ${Number(data?.open_anomalies||0)} finance exception(s)`);await load();
  };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div>
      <div className="flex flex-wrap gap-2"><Badge>RG13</Badge><Badge variant="outline">Finance & Administration Agent</Badge><Badge variant="outline">No autonomous money movement</Badge></div>
      <h2 className="mt-3 text-2xl font-black">Finance Control Automation</h2>
      <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Continuously reconciles payment state, payout liabilities, seller/referral liabilities and AI operating cost. It may surface and route exceptions, but cannot transfer money, change banking, execute refunds or pay sellers.</p>
    </div><div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button><Button onClick={()=>void run()} disabled={running}><Sparkles className={"mr-2 h-4 w-4 "+(running?"animate-pulse":"")}/>Run RG13</Button></div></div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric icon={Banknote} label="Attributed value 30d" value={zar(snapshot?.attributed_value_30d)}/>
      <Metric icon={Banknote} label="Platform fees 30d" value={zar(snapshot?.platform_fee_30d)}/>
      <Metric icon={WalletCards} label="Pending payments" value={String(snapshot?.pending_payments||0)}/>
      <Metric icon={WalletCards} label="Pending payouts" value={String(snapshot?.pending_seller_payouts||0)}/>
      <Metric icon={Banknote} label="Payout value" value={zar(snapshot?.pending_seller_payout_value)}/>
      <Metric icon={Bot} label="AI cost 30d" value={"$"+Number(snapshot?.ai_cost_usd_30d||0).toFixed(3)}/>
      <Metric icon={AlertTriangle} label="Open anomalies" value={String(snapshot?.open_anomalies||anomalies.length)}/>
      <Metric icon={ShieldCheck} label="Executive approvals" value={String(approvals.length)}/>
    </div>

    <Card className="rounded-[22px]"><CardHeader><CardTitle>Financial control exceptions</CardTitle></CardHeader><CardContent className="space-y-3">
      {anomalies.length===0?<Empty text="No active RG13 financial anomalies."/>:anomalies.map(a=><div key={a.id} className="rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><Badge variant={a.severity==="critical"?"destructive":"outline"}>{label(a.severity)}</Badge><Badge variant="secondary">{label(a.anomaly_type)}</Badge>{a.requires_executive_approval&&<Badge variant="outline">Executive approval</Badge>}</div>{a.amount_zar!=null&&<strong>{zar(a.amount_zar)}</strong>}</div>
        <p className="mt-3 text-sm font-semibold">{a.recommended_action}</p><p className="mt-2 text-xs text-muted-foreground">Last observed {new Date(a.last_seen_at).toLocaleString("en-ZA")}</p>
      </div>)}
    </CardContent></Card>

    <Card className="rounded-[22px]"><CardHeader><CardTitle>Seller payout approval queue</CardTitle></CardHeader><CardContent>
      <div className="mb-4 rounded-2xl border bg-muted/30 p-3 text-xs text-muted-foreground"><strong className="text-foreground">Control:</strong> approving a payout record only changes its internal approval state. It never executes a bank transfer. Final money movement remains outside autonomous AgentOS authority.</div>
      {approvals.length===0?<Empty text="No seller payout records are awaiting Executive approval."/>:<div className="space-y-3">{approvals.map(p=><div key={p.id} className="rounded-2xl border p-4"><div className="flex flex-wrap gap-2"><Badge>{label(p.risk_level)}</Badge><Badge variant="outline">{label(p.status)}</Badge></div><p className="mt-2 font-black">{p.title}</p><p className="mt-1 text-xs text-muted-foreground">{p.summary}</p></div>)}</div>}
    </CardContent></Card>
  </div>;
}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-lg font-black">{value}</p><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-5 w-5"/>{text}</div>;}
