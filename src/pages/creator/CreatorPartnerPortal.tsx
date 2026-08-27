import { useEffect, useMemo, useState } from "react";
import { BarChart3, ClipboardCheck, Copy, ExternalLink, FileCheck2, Instagram, MousePointerClick, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import CreatorMarketingStudio from "@/components/creator/CreatorMarketingStudio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const tierLabel: Record<string,string> = { creator_partner:"Creator Partner", growth_partner:"Growth Partner", campus_creator:"Campus Creator", strategic_creator:"Strategic Creator Partner" };
const statusLabel = (value:string) => value.replaceAll("_"," ").replace(/\b\w/g,(c)=>c.toUpperCase());

const CreatorPartnerPortal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ display_name:"", platform:"tiktok", handle:"", follower_count:"", bio:"" });

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const db = supabase as any;
    const { data } = await db.from("creator_partners").select("*").eq("user_id", user.id).maybeSingle();
    setPartner(data || null);
    if (data?.id) {
      const [eventRes, caseRes] = await Promise.all([
        db.from("creator_referral_events").select("event_type,value,created_at").eq("creator_id", data.id).order("created_at", { ascending:false }).limit(500),
        db.from("creator_assistance_cases").select("id,applicant_name,applicant_stage,target_institutions,status,consent_status,intake_year,updated_at,funding_type").eq("creator_id", data.id).order("updated_at", { ascending:false }).limit(100),
      ]);
      setEvents(eventRes.data || []);
      setCases(caseRes.data || []);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const metrics = useMemo(() => ({
    clicks: events.filter((e)=>e.event_type==="click").length,
    signups: events.filter((e)=>e.event_type==="signup").length,
    reservations: events.filter((e)=>e.event_type==="reservation").length,
    applications: events.filter((e)=>["application_started","application_assisted","application_assistance_completed"].includes(e.event_type)).length,
    placements: events.filter((e)=>e.event_type==="placement").length,
    assistance: cases.filter((c)=>c.consent_status==="granted" && c.status!=="closed").length,
  }), [events,cases]);

  const assistanceFunnel = useMemo(() => ({
    waiting: cases.filter((c)=>["requested","documents_pending"].includes(c.status)).length,
    ready: cases.filter((c)=>c.status==="ready_to_apply").length,
    working: cases.filter((c)=>c.status==="in_progress").length,
    submitted: cases.filter((c)=>["submitted","awaiting_response"].includes(c.status)).length,
    completed: cases.filter((c)=>c.status==="completed").length,
  }),[cases]);

  const apply = async () => {
    if (!user) return navigate("/auth?returnTo=/creator-partners");
    const followers = Number(form.follower_count || 0);
    if (!form.display_name.trim() || !form.handle.trim()) return toast.error("Add your name and creator handle");
    if (followers < 10000) return toast.error("The current Creator Partner intake starts at 10,000 followers.");
    const base = form.handle.replace(/^@/,"").replace(/[^a-z0-9]/gi,"").toUpperCase().slice(0,10) || "CREATOR";
    const code = `${base}${Math.floor(100 + Math.random()*900)}`;
    const slug = `${form.handle.replace(/^@/,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${user.id.slice(0,5)}`;
    const { error } = await (supabase as any).from("creator_partners").insert({ user_id:user.id, slug, display_name:form.display_name.trim(), platform:form.platform, handle:form.handle.trim(), follower_count:followers, referral_code:code, bio:form.bio || null, status:"pending" });
    if (error) return toast.error(error.message || "Could not submit creator application");
    toast.success("Creator Partner application submitted"); void load();
  };

  const copy = async (text:string) => { await navigator.clipboard.writeText(text); toast.success("Copied"); };
  const referralUrl = partner ? `${window.location.origin}/r/${partner.referral_code}` : "";
  const assistanceUrl = partner ? `${window.location.origin}/creator-assist/${partner.slug}` : "";

  return <DashboardLayout>
    <SEO title="ResKonnect Creator Partner Programme" description="Creator partnership, application assistance and conversion workspace for ResKonnect partners." />
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl bg-[#071326] p-6 text-white shadow-xl md:p-10"><div className="max-w-4xl"><div className="inline-flex items-center gap-2 rounded-full bg-[#F5B32F] px-3 py-1 text-xs font-black text-[#071326]"><Sparkles className="h-3.5 w-3.5" />CREATOR PARTNER OS</div><h1 className="mt-4 text-3xl font-black md:text-5xl">Audience → assistance → measurable student outcomes.</h1><p className="mt-4 max-w-3xl text-base leading-7 text-white/70">Create co-branded campaigns, refer accommodation demand and—when a student explicitly chooses you—work inside a secure ResKonnect application assistance case with their application brief and documents.</p>{!user && <Button className="mt-6 bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]/90" onClick={()=>navigate("/auth?returnTo=/creator-partners")}>Sign in to apply</Button>}</div></section>

      {!user ? <div className="grid gap-4 md:grid-cols-3">{[[Users,"10K+ creator intake","TikTok, Instagram, YouTube and campus creators with a relevant student audience."],[MousePointerClick,"Outcome tracking","Track clicks, accounts, reservations, application assistance and placements."],[FileCheck2,"Secure application assistance","Students explicitly consent before a creator can access an assistance case or its documents."]].map(([Icon,title,text]:any)=><Card key={title}><CardContent className="p-6"><Icon className="h-7 w-7 text-primary"/><h2 className="mt-4 font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>)}</div> : loading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading Creator Partner OS…</CardContent></Card> : !partner ? <Card><CardHeader><CardTitle>Apply to become a Creator Partner</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label>Display name</Label><Input value={form.display_name} onChange={(e)=>setForm({...form,display_name:e.target.value})} placeholder="Your creator / brand name"/></div><div className="space-y-1.5"><Label>Platform</Label><Select value={form.platform} onValueChange={(v)=>setForm({...form,platform:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="tiktok">TikTok</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="youtube">YouTube</SelectItem><SelectItem value="multi">Multi-platform</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Handle</Label><Input value={form.handle} onChange={(e)=>setForm({...form,handle:e.target.value})} placeholder="@yourhandle"/></div><div className="space-y-1.5"><Label>Follower count</Label><Input type="number" value={form.follower_count} onChange={(e)=>setForm({...form,follower_count:e.target.value})} placeholder="10000"/></div><div className="space-y-1.5 md:col-span-2"><Label>Audience / content focus</Label><Textarea value={form.bio} onChange={(e)=>setForm({...form,bio:e.target.value})} placeholder="Tell us about your student, accommodation, applications or career content."/></div><div className="md:col-span-2"><Button onClick={()=>void apply()}>Submit Creator Partner application</Button></div></CardContent></Card> : <>
        <Card className="border-primary/20"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">{partner.display_name}</h2><Badge>{tierLabel[partner.tier] || partner.tier}</Badge><Badge variant={partner.status === "active" ? "default" : "secondary"}>{partner.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{partner.handle} · {Number(partner.follower_count).toLocaleString("en-ZA")} followers</p></div>{partner.status === "active" && <Button variant="outline" onClick={()=>window.open(`/creator/${partner.slug}`,"_blank")}><ExternalLink className="mr-2 h-4 w-4"/>Public partner page</Button>}</CardContent></Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{[["Clicks",metrics.clicks],["Signups",metrics.signups],["Reservations",metrics.reservations],["Assistance cases",metrics.assistance],["Applications",metrics.applications],["Placements",metrics.placements]].map(([label,value])=><Card key={label}><CardContent className="p-4"><p className="text-2xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>)}</div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Instagram className="h-5 w-5 text-primary"/>Tracked marketing route</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><Input value={referralUrl} readOnly/><Button variant="outline" onClick={()=>void copy(referralUrl)}><Copy className="mr-2 h-4 w-4"/>Copy</Button></div><p className="text-xs text-muted-foreground">Use for general accommodation, application and opportunity attribution.</p></CardContent></Card>
          <Card className="border-[#F5B32F]/30"><CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-[#E09008]"/>Application assistance route</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><Input value={assistanceUrl} readOnly/><Button variant="outline" onClick={()=>void copy(assistanceUrl)}><Copy className="mr-2 h-4 w-4"/>Copy</Button></div><p className="text-xs text-muted-foreground">Share this only with students you are willing to assist. They sign in, consent, add their application brief and upload their own documents.</p></CardContent></Card>
        </div>

        {partner.status === "active" && <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary"/>Application Assistance Workspace</CardTitle><p className="mt-1 text-sm text-muted-foreground">Only cases where the student explicitly granted you access appear here.</p></div><div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline">Waiting {assistanceFunnel.waiting}</Badge><Badge variant="outline">Ready {assistanceFunnel.ready}</Badge><Badge variant="outline">Working {assistanceFunnel.working}</Badge><Badge variant="outline">Submitted {assistanceFunnel.submitted}</Badge><Badge variant="outline">Completed {assistanceFunnel.completed}</Badge></div></div></CardHeader><CardContent>{cases.length===0?<div className="rounded-2xl border border-dashed p-9 text-center"><FileCheck2 className="mx-auto h-9 w-9 text-muted-foreground"/><p className="mt-3 font-bold">No assistance cases yet</p><p className="mt-1 text-sm text-muted-foreground">Share your application assistance route with a student to start a consented case.</p></div>:<div className="divide-y">{cases.map((item)=><button key={item.id} type="button" disabled={item.consent_status!=="granted"} onClick={()=>navigate(`/creator-partners/assist/${item.id}`)} className="flex w-full items-center gap-3 py-4 text-left disabled:cursor-not-allowed disabled:opacity-50"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">{String(item.applicant_name||"A").charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{item.applicant_name}</p><p className="truncate text-xs text-muted-foreground">{(item.target_institutions||[]).join(", ") || "No institution selected"} · Intake {item.intake_year}</p></div><Badge variant={item.status==="completed"?"default":"secondary"}>{statusLabel(item.status)}</Badge></button>)}</div>}</CardContent></Card>}

        <CreatorMarketingStudio creatorName={partner.display_name} referralCode={partner.referral_code}/>
      </>}
    </div>
  </DashboardLayout>;
};

export default CreatorPartnerPortal;
