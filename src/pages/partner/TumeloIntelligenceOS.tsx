import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CheckCircle2, Eye, FileCheck2, Link2, RefreshCw, ShieldCheck, Sparkles, UserCheck, Users, Video } from "lucide-react";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND } from "@/constants/brand";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TumeloIntelligenceOS = () => {
  const { isGodMode, staffRole } = useAuth();
  const [days, setDays] = useState("30");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("owner");
  const [assigning, setAssigning] = useState(false);
  const adminAccess = isGodMode || ["admin","super_admin","developer","owner","growth_lead"].includes(String(staffRole || ""));

  const load = async () => {
    setLoading(true); setAccessDenied(false);
    const { data: summary, error } = await (supabase as any).rpc("tumelo_intelligence_summary", { p_days:Number(days) });
    if (error) { setData(null); setAccessDenied(true); setLoading(false); return; }
    setData(summary); setLoading(false);
  };
  useEffect(() => { void load(); }, [days]);

  const conversions = useMemo(() => Object.entries(data?.conversions || {}).sort((a:any,b:any)=>Number(b[1])-Number(a[1])), [data]);
  const totalConversions = useMemo(() => conversions.reduce((sum,[,value])=>sum+Number(value||0),0), [conversions]);
  const conversionRate = data?.attributed_users ? Math.round((totalConversions / Math.max(1,Number(data.attributed_users))) * 100) : 0;

  const assignAccess = async () => {
    if (!memberEmail.trim()) return toast.error("Enter the ResKonnect account email to assign.");
    setAssigning(true);
    const { error } = await (supabase as any).rpc("admin_assign_partnership_member_by_email", { p_partner_slug:"tumelo-career-education", p_email:memberEmail.trim(), p_role:memberRole });
    setAssigning(false);
    if (error) return toast.error(error.message || "Could not assign Tumelo OS access");
    toast.success("Tumelo Intelligence OS access assigned"); setMemberEmail("");
  };

  if (accessDenied) return <DashboardLayout><SEO noIndex title="Tumelo Intelligence OS | ResKonnect" description="Protected Tumelo × ResKonnect partnership intelligence."/><div className="mx-auto max-w-xl px-4 py-24 text-center"><ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground"/><h1 className="mt-5 text-3xl font-black">Tumelo Intelligence OS</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">This dashboard is restricted to authorized Tumelo partnership members and ResKonnect growth administrators.</p></div></DashboardLayout>;

  return <DashboardLayout>
    <SEO noIndex title="Tumelo Intelligence OS | ResKonnect" description="Protected conversion, audience and partnership intelligence for Tumelo × ResKonnect." />
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl bg-[#071326] p-6 text-white shadow-2xl md:p-10"><div className="absolute -right-24 -top-16 h-72 w-72 rounded-full bg-[#2563EB]/30 blur-3xl"/><div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-3"><img src={BRAND.logos.icon} alt={BRAND.name} className="h-11 w-11 rounded-xl bg-white p-1"/><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F5B32F]">Strategic Partnership Intelligence</p><p className="text-sm font-bold text-white/60">Tumelo × ResKonnect</p></div></div><h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">Intelligence OS</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Live visibility into partnership reach, attributed users, conversion outcomes, published education content and the actions that move the partnership forward.</p></div><div className="flex items-center gap-2"><Select value={days} onValueChange={setDays}><SelectTrigger className="w-32 border-white/20 bg-white/10 text-white"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem><SelectItem value="365">Last year</SelectItem></SelectContent></Select><Button variant="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</Button></div></div></section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={Eye} label="Partner page views" value={data?.page_views || 0}/><Metric icon={Activity} label="Tracked interactions" value={data?.tracked_events || 0}/><Metric icon={Users} label="Attributed users" value={data?.attributed_users || 0}/><Metric icon={Link2} label="Attributed sessions" value={data?.attributed_sessions || 0}/><Metric icon={UserCheck} label="Conversions" value={totalConversions}/><Metric icon={BarChart3} label="Conversion / user" value={`${conversionRate}%`}/>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr,.75fr]">
        <Card><CardHeader><CardTitle>Conversion intelligence</CardTitle></CardHeader><CardContent>{conversions.length===0?<div className="rounded-2xl border border-dashed p-10 text-center"><BarChart3 className="mx-auto h-9 w-9 text-muted-foreground"/><p className="mt-3 font-bold">Conversion data is waiting for tracked traffic</p><p className="mt-1 text-sm text-muted-foreground">Use partnership-tagged routes and calls to action so applications, reservations and placements are attributed back to Tumelo.</p></div>:<div className="space-y-3">{conversions.map(([type,value]:any)=>{const width=Math.max(8,Math.round((Number(value)/Math.max(1,totalConversions))*100));return <div key={type}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-semibold">{String(type).replaceAll("_"," ")}</span><span className="font-black">{String(value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${width}%`}}/></div></div>;})}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Content footprint</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-2xl bg-primary/5 p-5"><Sparkles className="h-6 w-6 text-primary"/><p className="mt-3 text-3xl font-black">{data?.published_content || 0}</p><p className="text-xs text-muted-foreground">Published partnership content modules</p></div><div className="rounded-2xl bg-violet/5 p-5"><Video className="h-6 w-6 text-violet"/><p className="mt-3 text-3xl font-black">{data?.published_videos || 0}</p><p className="text-xs text-muted-foreground">Published Tumelo videos</p></div><Button asChild variant="outline" className="w-full"><a href="/career-education/tumelo" target="_blank" rel="noreferrer">Open public partnership experience</a></Button></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Recent partnership activity</CardTitle></CardHeader><CardContent>{(data?.recent_activity||[]).length===0?<p className="py-10 text-center text-sm text-muted-foreground">No conversion activity in this reporting window.</p>:<div className="divide-y">{(data.recent_activity||[]).map((item:any,index:number)=><div key={`${item.type}-${item.at}-${index}`} className="flex items-center gap-3 py-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Activity className="h-4 w-4"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{String(item.type||"activity").replaceAll("_"," ")}</p><p className="text-xs text-muted-foreground">{item.entity_type || "partnership"}</p></div><p className="shrink-0 text-xs text-muted-foreground">{item.at ? new Date(item.at).toLocaleDateString("en-ZA") : ""}</p></div>)}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary"/>Intelligence actions</CardTitle></CardHeader><CardContent className="space-y-3">{[
          data?.page_views===0 ? "Publish/share Tumelo partnership routes with partner attribution to establish measurable reach." : "Compare high-traffic Tumelo content with conversion events and reuse the strongest CTA format.",
          Number(data?.attributed_users||0)===0 ? "Use ?partner=tumelo-career-education on campaign entry links so signed-in journeys stay attributed." : "Follow attributed users through applications, accommodation and opportunity conversion paths.",
          totalConversions===0 ? "Push one measurable primary action per campaign: application readiness, assisted application, accommodation reservation or opportunity action." : "Prioritize the conversion types already showing traction and test new creatives against the same outcome.",
        ].map((text)=><div key={text} className="flex gap-3 rounded-xl border p-4 text-sm leading-6"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><span>{text}</span></div>)}</CardContent></Card>
      </div>

      {adminAccess && <Card className="border-[#F5B32F]/30"><CardHeader><CardTitle>Partnership access control</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Assign Tumelo or an authorized team member after they create/sign in to a ResKonnect account. This gives access to this Intelligence OS only through the partnership membership layer.</p><div className="grid gap-3 md:grid-cols-[1fr,180px,auto]"><div className="space-y-1.5"><Label>ResKonnect account email</Label><Input type="email" value={memberEmail} onChange={(e)=>setMemberEmail(e.target.value)} placeholder="partner@example.com"/></div><div className="space-y-1.5"><Label>Access role</Label><Select value={memberRole} onValueChange={setMemberRole}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="strategist">Strategist</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent></Select></div><Button className="self-end" disabled={assigning} onClick={()=>void assignAccess()}>{assigning?"Assigning...":"Assign access"}</Button></div></CardContent></Card>}
    </div>
  </DashboardLayout>;
};

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:any}) { return <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{label}</p></div><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4"/></div></div></CardContent></Card>; }

export default TumeloIntelligenceOS;
