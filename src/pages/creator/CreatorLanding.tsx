import { useEffect, useState } from "react";
import { Building2, CalendarDays, FileCheck2, HandHelping, Sparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import SEO from "@/components/SEO";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/referrals/referralStorage";

const CreatorLanding = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [creator, setCreator] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_creator_public", { _slug: slug });
      const row = Array.isArray(data) ? data[0] : data;
      if (active) { setCreator(error ? null : row || null); setLoading(false); }
      if (!error && row?.id) await (supabase as any).from("creator_referral_events").insert({ creator_id: row.id, session_id: getVisitorId(), event_type: "click", entity_type: "landing", metadata: { path: window.location.pathname } });
    })();
    return () => { active = false; };
  }, [slug]);

  const go = async (path: string, eventType: string, trackRef = true) => {
    if (!creator) return navigate(path);
    try { await (supabase as any).from("creator_referral_events").insert({ creator_id: creator.id, session_id: getVisitorId(), event_type: eventType, entity_type: "cta", metadata: { destination: path } }); } catch {}
    if (!trackRef) return navigate(path);
    const separator = path.includes("?") ? "&" : "?";
    navigate(`${path}${separator}ref=${encodeURIComponent(creator.referral_code)}&creator=${encodeURIComponent(creator.id)}`);
  };

  return <div className="flex min-h-screen flex-col bg-background"><SEO title={`${creator?.display_name || "Creator Partner"} × ResKonnect | Accommodation & Applications`} description="Find 2027 student accommodation and get consent-based application assistance through a ResKonnect Creator Partner." /><SiteHeader/><main className="flex-1">
    <section className="relative overflow-hidden border-b bg-[#071326] text-white"><div className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-[#2563EB]/30 blur-3xl"/><div className="container mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24 lg:px-8"><div className="max-w-3xl">{loading ? <p className="text-sm text-white/60">Loading partner page…</p> : creator ? <><Badge className="gap-1 bg-[#F5B32F] text-[#071326] hover:bg-[#F5B32F]"><Sparkles className="h-3 w-3"/>RESKONNECT CREATOR PARTNER</Badge><h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">{creator.display_name} <span className="text-[#F5B32F]">× ResKonnect</span></h1><p className="mt-4 text-lg leading-8 text-white/70">Find 2027 accommodation, prepare for university or TVET applications, or ask {creator.display_name} to assist you through a secure, consent-based application workspace.</p><p className="mt-3 text-sm font-semibold text-white/55">{creator.handle || creator.platform} · Partner code {creator.referral_code}</p></> : <><h1 className="text-4xl font-black">Creator Partner page unavailable</h1><p className="mt-3 text-white/60">This campaign may be paused or the link may be incorrect.</p></>}</div></div></section>
    {creator && <section className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="group cursor-pointer border-primary/20 transition hover:-translate-y-1 hover:shadow-lg" onClick={()=>void go("/find?reserve=2027","accommodation_search")}><CardContent className="p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-6 w-6"/></div><h2 className="mt-5 text-xl font-black">Reserve accommodation for 2027</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Browse residences, images, maps, availability and separate private/NSFAS-funded pricing.</p><Button className="mt-5 w-full">Find accommodation</Button></CardContent></Card>
      <Card className="group cursor-pointer border-[#F5B32F]/30 transition hover:-translate-y-1 hover:shadow-lg" onClick={()=>void go(`/creator-assist/${creator.slug}`,"application_assistance_requested",false)}><CardContent className="p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5B32F]/15 text-[#C98300]"><HandHelping className="h-6 w-6"/></div><h2 className="mt-5 text-xl font-black">Get help from {creator.display_name}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in, add your application information, upload the required documents and grant this creator access to assist your case.</p><Button className="mt-5 w-full bg-[#071326] text-white hover:bg-[#071326]/90">Start assisted application</Button></CardContent></Card>
      <Card className="group cursor-pointer transition hover:-translate-y-1 hover:shadow-lg" onClick={()=>void go("/apply","application_started")}><CardContent className="p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet/10 text-violet"><FileCheck2 className="h-6 w-6"/></div><h2 className="mt-5 text-xl font-black">Explore application options</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Check APS, explore programmes and prepare before submitting to official institution channels.</p><Button variant="outline" className="mt-5 w-full">Application journey</Button></CardContent></Card>
      <Card className="group cursor-pointer transition hover:-translate-y-1 hover:shadow-lg" onClick={()=>void go("/auth?mode=signup","signup")}><CardContent className="p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint/10 text-mint"><Building2 className="h-6 w-6"/></div><h2 className="mt-5 text-xl font-black">Create your ResKonnect account</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Save contact details, application activity, documents and accommodation journey in one portal.</p><Button variant="outline" className="mt-5 w-full">Create account</Button></CardContent></Card>
    </div></section>}
  </main><SiteFooter/></div>;
};
export default CreatorLanding;
