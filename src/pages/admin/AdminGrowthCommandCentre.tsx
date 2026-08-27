import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, CalendarDays, CheckCircle2, MousePointerClick, RefreshCw, Target, TrendingUp, UserPlus, Users } from "lucide-react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminGrowthCommandCentre = () => {
  const [days, setDays] = useState("7");
  const [data, setData] = useState<any>(null);
  const [creators, setCreators] = useState<any[]>([]);
  const [demands, setDemands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    const [growth, creatorRows, demandRows] = await Promise.all([
      db.rpc("admin_growth_command_centre", { _days:Number(days) }),
      db.from("creator_partners").select("*").order("created_at", { ascending:false }).limit(100),
      db.from("accommodation_demands").select("id,campus,area,academic_year,funding_type,monthly_budget,room_type,status,created_at").order("created_at", { ascending:false }).limit(100),
    ]);
    if (!growth.error) setData(growth.data || null);
    if (!creatorRows.error) setCreators(creatorRows.data || []);
    if (!demandRows.error) setDemands(demandRows.data || []);
    setLoading(false);
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const updateCreator = async (creator:any, patch:Record<string,any>) => {
    const { error } = await (supabase as any).from("creator_partners").update(patch).eq("id", creator.id);
    if (error) return toast.error(error.message || "Could not update creator");
    toast.success("Creator Partner updated"); void load();
  };

  const demandSummary = useMemo(() => {
    const campuses = new Map<string,number>(); let nsfas=0, priv=0, year2027=0;
    demands.forEach((d)=>{ campuses.set(d.campus,(campuses.get(d.campus)||0)+1); if(d.funding_type==="nsfas")nsfas++; if(d.funding_type==="private")priv++; if(Number(d.academic_year)===2027)year2027++; });
    return { campuses:[...campuses.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8), nsfas, priv, year2027 };
  }, [demands]);

  const today = data?.today || {}; const period = data?.period || {}; const funnel = data?.funnel || {};
  const metric=(label:string,value:any,note:string,Icon:any)=><Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{loading?"—":Number(value||0).toLocaleString("en-ZA")}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div><Icon className="h-5 w-5 text-primary"/></div></CardContent></Card>;

  return <AdminLayout><SEO noIndex title="Growth Command Centre | ResKonnect Admin" description="Daily acquisition, reservations, applications, demand and creator partner intelligence." />
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-black tracking-tight">Daily Growth Command Centre</h1><Badge className="gap-1"><TrendingUp className="h-3 w-3"/>LIVE GROWTH</Badge></div><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Follow the journey from traffic and accounts to accommodation demand, 2027 reservations, applications, creator referrals and placements.</p></div><div className="flex gap-2"><Select value={days} onValueChange={setDays}><SelectTrigger className="w-36"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="1">Last 24h</SelectItem><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select><Button variant="outline" onClick={()=>void load()}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button></div></div>

      <section><h2 className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Today</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{metric("Page views",today.pageViews,"Today",MousePointerClick)}{metric("New accounts",today.newAccounts,"Today",UserPlus)}{metric("Reservations",today.reservations,"2027 + current",CalendarDays)}{metric("Applications",today.applications,"Started today",Building2)}{metric("Demand requests",today.demands,"Student needs",Target)}{metric("Creator events",today.creatorEvents,"Tracked today",Users)}</div></section>

      <section><h2 className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Period performance</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{metric("Page views",period.pageViews,`${days}-day period`,MousePointerClick)}{metric("New accounts",period.newAccounts,`${days}-day period`,UserPlus)}{metric("Reservations",period.reservations,"Accommodation intent",CalendarDays)}{metric("Applications",period.applications,"Study + res journey",Building2)}{metric("Demand",period.demands,"Demand Network",Target)}{metric("Placements",period.placements,"CRM placed stage",CheckCircle2)}</div></section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary"/>Acquisition funnel</CardTitle></CardHeader><CardContent className="space-y-3">{[["Visitors",funnel.visitors],["Accounts",funnel.accounts],["Accommodation searches",funnel.searches],["Reservations",funnel.reservations],["Placed",funnel.placed]].map(([label,value],index,all)=>{const max=Number(all[0][1]||1);const pct=Math.min(100,Math.round(Number(value||0)/max*100));return <div key={String(label)}><div className="mb-1 flex items-center justify-between text-sm"><span className="font-semibold">{label}</span><span>{Number(value||0).toLocaleString("en-ZA")}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${pct}%`}}/></div></div>;})}</CardContent></Card>

        <Card><CardHeader><CardTitle>Accommodation demand pulse</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-3"><div className="rounded-xl bg-muted/40 p-3"><p className="text-2xl font-black">{demandSummary.year2027}</p><p className="text-xs text-muted-foreground">2027 requests</p></div><div className="rounded-xl bg-muted/40 p-3"><p className="text-2xl font-black">{demandSummary.nsfas}</p><p className="text-xs text-muted-foreground">NSFAS</p></div><div className="rounded-xl bg-muted/40 p-3"><p className="text-2xl font-black">{demandSummary.priv}</p><p className="text-xs text-muted-foreground">Private</p></div></div><div className="space-y-2">{demandSummary.campuses.map(([campus,count])=><div key={campus} className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm font-semibold">{campus}</span><Badge variant="secondary">{count}</Badge></div>)}</div></CardContent></Card>
      </div>

      <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Creator Partner programme</CardTitle><Badge variant="outline">{creators.length} partners/applications</Badge></div></CardHeader><CardContent>{creators.length===0?<p className="py-8 text-center text-sm text-muted-foreground">Creator Partner applications will appear here.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="p-3">Creator</th><th className="p-3">Platform</th><th className="p-3">Followers</th><th className="p-3">Code</th><th className="p-3">Tier</th><th className="p-3">Status</th></tr></thead><tbody>{creators.map((creator)=><tr key={creator.id} className="border-b last:border-0"><td className="p-3"><p className="font-bold">{creator.display_name}</p><p className="text-xs text-muted-foreground">{creator.handle}</p></td><td className="p-3 capitalize">{creator.platform}</td><td className="p-3">{Number(creator.follower_count).toLocaleString("en-ZA")}</td><td className="p-3 font-mono text-xs">{creator.referral_code}</td><td className="p-3"><Select value={creator.tier} onValueChange={(v)=>void updateCreator(creator,{tier:v})}><SelectTrigger className="w-44"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="creator_partner">Creator Partner</SelectItem><SelectItem value="growth_partner">Growth Partner</SelectItem><SelectItem value="campus_creator">Campus Creator</SelectItem><SelectItem value="strategic_creator">Strategic Creator</SelectItem></SelectContent></Select></td><td className="p-3"><Select value={creator.status} onValueChange={(v)=>void updateCreator(creator,{status:v})}><SelectTrigger className="w-32"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></td></tr>)}</tbody></table></div>}</CardContent></Card>
    </div>
  </AdminLayout>;
};
export default AdminGrowthCommandCentre;
