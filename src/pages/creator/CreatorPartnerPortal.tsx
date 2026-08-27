import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Copy, ExternalLink, Instagram, MousePointerClick, Sparkles, Users } from "lucide-react";
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

const CreatorPartnerPortal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ display_name:"", platform:"tiktok", handle:"", follower_count:"", bio:"" });

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const db = supabase as any;
    const { data } = await db.from("creator_partners").select("*").eq("user_id", user.id).maybeSingle();
    setPartner(data || null);
    if (data?.id) {
      const { data: ev } = await db.from("creator_referral_events").select("event_type,value,created_at").eq("creator_id", data.id).order("created_at", { ascending:false }).limit(500);
      setEvents(ev || []);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const metrics = useMemo(() => ({
    clicks: events.filter((e)=>e.event_type==="click").length,
    signups: events.filter((e)=>e.event_type==="signup").length,
    reservations: events.filter((e)=>e.event_type==="reservation").length,
    applications: events.filter((e)=>["application_started","application_assisted"].includes(e.event_type)).length,
    placements: events.filter((e)=>e.event_type==="placement").length,
  }), [events]);

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

  return <DashboardLayout>
    <SEO title="ResKonnect Creator Partner Programme" description="Partner with ResKonnect as a TikTok, Instagram or campus creator and track accommodation reservations, applications and placements." />
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-pink/10 p-6 md:p-10"><div className="max-w-3xl"><div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-bold text-primary"><Sparkles className="h-3.5 w-3.5" />CREATOR PARTNER PROGRAMME</div><h1 className="mt-4 text-3xl font-black md:text-5xl">Turn your audience into measurable student outcomes.</h1><p className="mt-4 text-base leading-7 text-muted-foreground">Create co-branded accommodation and application campaigns, send students through your tracked route, and see the journey from click to reservation, application and placement.</p>{!user && <Button className="mt-6" onClick={()=>navigate("/auth?returnTo=/creator-partners")}>Sign in to apply</Button>}</div></section>

      {!user ? <div className="grid gap-4 md:grid-cols-3">{[[Users,"10K+ creator intake","TikTok, Instagram, YouTube and campus creators with a relevant student audience."],[MousePointerClick,"Outcome tracking","Track clicks, accounts, reservations, application starts and successful placements."],[BarChart3,"Conversion-led partnerships","Reward models can focus on verified outcomes instead of paying only for views."]].map(([Icon,title,text]:any)=><Card key={title}><CardContent className="p-6"><Icon className="h-7 w-7 text-primary"/><h2 className="mt-4 font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>)}</div> : loading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading Creator Partner workspace…</CardContent></Card> : !partner ? <Card><CardHeader><CardTitle>Apply to become a Creator Partner</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label>Display name</Label><Input value={form.display_name} onChange={(e)=>setForm({...form,display_name:e.target.value})} placeholder="Your creator / brand name"/></div><div className="space-y-1.5"><Label>Platform</Label><Select value={form.platform} onValueChange={(v)=>setForm({...form,platform:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="tiktok">TikTok</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="youtube">YouTube</SelectItem><SelectItem value="multi">Multi-platform</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Handle</Label><Input value={form.handle} onChange={(e)=>setForm({...form,handle:e.target.value})} placeholder="@yourhandle"/></div><div className="space-y-1.5"><Label>Follower count</Label><Input type="number" value={form.follower_count} onChange={(e)=>setForm({...form,follower_count:e.target.value})} placeholder="10000"/></div><div className="space-y-1.5 md:col-span-2"><Label>Audience / content focus</Label><Textarea value={form.bio} onChange={(e)=>setForm({...form,bio:e.target.value})} placeholder="Tell us about your student, accommodation, applications or career content."/></div><div className="md:col-span-2"><Button onClick={()=>void apply()}>Submit Creator Partner application</Button></div></CardContent></Card> : <>
        <Card className="border-primary/20"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">{partner.display_name}</h2><Badge>{tierLabel[partner.tier] || partner.tier}</Badge><Badge variant={partner.status === "active" ? "default" : "secondary"}>{partner.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{partner.handle} · {Number(partner.follower_count).toLocaleString("en-ZA")} followers</p></div>{partner.status === "active" && <Button variant="outline" onClick={()=>window.open(`/creator/${partner.slug}`,"_blank")}><ExternalLink className="mr-2 h-4 w-4"/>Public partner page</Button>}</CardContent></Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[["Clicks",metrics.clicks],["Signups",metrics.signups],["Reservations",metrics.reservations],["Applications",metrics.applications],["Placements",metrics.placements]].map(([label,value])=><Card key={label}><CardContent className="p-4"><p className="text-2xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>)}</div>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Instagram className="h-5 w-5 text-primary"/>Your tracked campaign route</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><Input value={referralUrl} readOnly/><Button variant="outline" onClick={()=>void copy(referralUrl)}><Copy className="mr-2 h-4 w-4"/>Copy</Button></div><p className="text-xs text-muted-foreground">Use this route in TikTok bio, Instagram stories, WhatsApp or YouTube descriptions. Your referral code is <strong>{partner.referral_code}</strong>.</p>{partner.status !== "active" && <div className="rounded-xl bg-amber-500/10 p-3 text-sm">Your account is currently <strong>{partner.status}</strong>. Tracking goes live after approval.</div>}</CardContent></Card>
        <CreatorMarketingStudio creatorName={partner.display_name} referralCode={partner.referral_code}/>
      </>}
    </div>
  </DashboardLayout>;
};

export default CreatorPartnerPortal;
