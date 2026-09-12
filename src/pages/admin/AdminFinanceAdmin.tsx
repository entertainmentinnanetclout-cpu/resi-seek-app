import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banknote, Bot, ShoppingBag, Users, Sparkles } from "lucide-react";
import { AdminCommerceContent } from "./AdminCommerceHub";
import { AdminUsersContent } from "./AdminUsers";
import { supabase } from "@/integrations/supabase/client";
import { AdminSettingsContent } from "./AdminSettings";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck } from "lucide-react";
import AdminFinanceAutomation from "@/components/admin/AdminFinanceAutomation";
import AdminDepartmentTaskQueue from "@/components/admin/AdminDepartmentTaskQueue";

export default function AdminFinanceAdmin(){
  const { isGodMode } = useAuth();
  return <AdminLayout>
    <SEO noIndex title="Finance & Administration | ResKonnect Admin" description="Revenue administration, commercial operations, AI costs and account administration."/>
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap gap-2"><Badge>Finance & Administration</Badge><Badge variant="outline">Revenue · Costs · Records</Badge></div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Finance & Administration</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Commercial administration, attributed revenue, AI operating costs, marketplace records and platform user administration. Payment authority and banking changes remain founder-controlled.</p>
      </header>
      <FinancePulse/>
      <Tabs defaultValue="commercial">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="automation" className="gap-2"><Sparkles className="h-4 w-4"/>RG13 Finance Automation</TabsTrigger>
          <TabsTrigger value="commercial" className="gap-2"><ShoppingBag className="h-4 w-4"/>Commercial Administration</TabsTrigger>
          <TabsTrigger value="costs" className="gap-2"><Bot className="h-4 w-4"/>AI & API Cost Ledger</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2"><Users className="h-4 w-4"/>User Administration</TabsTrigger>
          {isGodMode&&<TabsTrigger value="financial-settings" className="gap-2"><ShieldCheck className="h-4 w-4"/>Restricted Financial Settings</TabsTrigger>}
        </TabsList>
        <TabsContent value="automation" className="space-y-4"><AdminFinanceAutomation/><AdminDepartmentTaskQueue departmentKey="finance_admin" title="Finance automation queue"/></TabsContent>
        <TabsContent value="commercial"><AdminCommerceContent/></TabsContent>
        <TabsContent value="costs"><AgentCostLedger/></TabsContent>
        <TabsContent value="accounts"><AdminUsersContent/></TabsContent>
        {isGodMode&&<TabsContent value="financial-settings"><div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"><p className="font-black">God Mode restricted</p><p className="mt-1 text-xs text-muted-foreground">Banking and payment configuration is intentionally excluded from department delegation and autonomous agents.</p></div><AdminSettingsContent/></TabsContent>}
      </Tabs>
    </div>
  </AdminLayout>;
}

function FinancePulse(){
  const[data,setData]=useState({revenue:0,conversions:0,aiCost:0});
  useEffect(()=>{void(async()=>{const since=new Date(Date.now()-30*86400000).toISOString();const[revenueR,costR]=await Promise.all([(supabase as any).from("adminos_campaign_attributions").select("value_zar,event_type").gte("attributed_at",since),(supabase as any).from("adminos_agent_usage").select("estimated_cost_usd").gte("created_at",since)]);setData({revenue:(revenueR.data||[]).reduce((s:number,r:any)=>s+Number(r.value_zar||0),0),conversions:(revenueR.data||[]).filter((r:any)=>["placement","conversion"].includes(r.event_type)).length,aiCost:(costR.data||[]).reduce((s:number,r:any)=>s+Number(r.estimated_cost_usd||0),0)});})();},[]);
  return <div className="grid grid-cols-3 gap-3"><Metric icon={Banknote} label="Attributed value · 30d" value={`R${data.revenue.toLocaleString("en-ZA",{maximumFractionDigits:0})}`}/><Metric icon={Banknote} label="Attributed conversions" value={String(data.conversions)}/><Metric icon={Bot} label="AI model cost · 30d" value={`$${data.aiCost.toFixed(2)}`}/></div>;
}

function AgentCostLedger(){
  const[rows,setRows]=useState<any[]>([]);const[loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);const{data}=await(supabase as any).from("adminos_agent_usage").select("id,agent_key,provider,model,input_tokens,output_tokens,estimated_cost_usd,latency_ms,created_at").order("created_at",{ascending:false}).limit(250);setRows(data||[]);setLoading(false);},[]);
  useEffect(()=>{void load();},[load]);
  return <Card><CardContent className="p-4">{loading?<p className="py-8 text-center text-sm text-muted-foreground">Loading AI cost ledger…</p>:rows.length===0?<p className="py-8 text-center text-sm text-muted-foreground">No metered agent usage yet.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="p-3">Agent</th><th className="p-3">Provider / model</th><th className="p-3">Input</th><th className="p-3">Output</th><th className="p-3">Cost USD</th><th className="p-3">Latency</th><th className="p-3">Time</th></tr></thead><tbody>{rows.map((row)=><tr key={row.id} className="border-b last:border-0"><td className="p-3 font-bold">{row.agent_key}</td><td className="p-3">{row.provider} · {row.model}</td><td className="p-3">{Number(row.input_tokens||0).toLocaleString("en-ZA")}</td><td className="p-3">{Number(row.output_tokens||0).toLocaleString("en-ZA")}</td><td className="p-3 font-mono">{"$"}{Number(row.estimated_cost_usd||0).toFixed(5)}</td><td className="p-3">{Number(row.latency_ms||0).toLocaleString("en-ZA")} ms</td><td className="p-3 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("en-ZA")}</td></tr>)}</tbody></table></div>}</CardContent></Card>;
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-xl font-black">{value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></CardContent></Card>;}
