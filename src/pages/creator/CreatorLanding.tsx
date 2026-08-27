import { useEffect, useState } from "react";
import { Building2, CalendarDays, FileCheck2, Sparkles } from "lucide-react";
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
      if (!error && row?.id) {
        await (supabase as any).from("creator_referral_events").insert({ creator_id: row.id, session_id: getVisitorId(), event_type: "click", entity_type: "landing", metadata: { path: window.location.pathname } });
      }
    })();
    return () => { active = false; };
  }, [slug]);

  const go = async (path: string, eventType: string) => {
    if (!creator) return navigate(path);
    try { await (supabase as any).from("creator_referral_events").insert({ creator_id: creator.id, session_id: getVisitorId(), event_type: eventType, entity_type: "cta", metadata: { destination: path } }); } catch {}
    const separator = path.includes("?") ? "&" : "?";
    navigate(`${path}${separator}ref=${encodeURIComponent(creator.referral_code)}&creator=${encodeURIComponent(creator.id)}`);
  };

  return <div className="flex min-h-screen flex-col bg-background"><SEO title={`${creator?.display_name || "Creator Partner"} × ResKonnect | Accommodation & Applications`} description="Find 2027 student accommodation and start your university or TVET application journey through a ResKonnect Creator Partner." /><SiteHeader/><main className="flex-1">
    <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-violet/10"><div className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-pink/15 blur-3xl"/><div className="container mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24 lg:px-8"><div className="max-w-3xl">{loading ? <p className="text-sm text-muted-foreground">Loading partner page…</p> : creator ? <><Badge className="gap-1"><Sparkles className="h-3 w-3"/>RESKONNECT CREATOR PARTNER</Badge><h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">{creator.display_name} <span className="text-primary">× ResKonnect</span></h1><p className="mt-4 text-lg leading-8 text-muted-foreground">Looking for 2027 accommodation or support preparing for university and TVET applications? Start here and keep the journey connected.</p><p className="mt-3 text-sm font-semibold text-muted-foreground">{creator.handle || creator.platform} · Partner code {creator.referral_code}</p></> : <><h1 className="text-4xl font-black">Creator Partner page unavailable</h1><p className="mt-3 text-muted-foreground">This campaign may be paused or the link may be incorrect.</p></>}</div></div></section>
    {creator && <section className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"><div className="grid gap-4 md:grid-cols-3">
      <Card className="group cursor-pointer border-primary/20 transition hover:-translate-y-1 hover:shadow-lg" onClick={()=>void go("/find?reserve=2027","accommodation_search")}><CardContent className="p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-6 w-6"/></div><h2 className="mt-5 text-xl font-black">Reserve accommodation for 2027</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Browse residences, maps, room availability and separate private/NSFAS-funded pricing.</p><Button className="mt-5 w-full">Find accommodation</Button></CardContent></Card>
      <Card className="group cursor-pointer transition hover:-translate-y-1 hover:shadow-lg" onClick={()=>void go("/apply","application_started")}><CardContent className="p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet/10 text-violet"><FileCheck2 className="h-6 w-6"/></div><h2 className="mt-5 text-xl font-black">Start your application journey</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Check APS, explore study options and prepare documents with ResKonnect. Tech-Up supports assisted applications.</p><Button variant="outline" className="mt-5 w-full">Application support</Button></CardContent></Card>
      <Card className="group cursor-pointer transition hover:-translate-y-1 hover:shadow-lg" onClick={()=>void go("/auth?mode=signup","signup")}><CardContent className="p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint/10 text-mint"><Building2 className="h-6 w-6"/></div><h2 className="mt-5 text-xl font-black">Create your ResKonnect account</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Save your contact details, documents, accommodation activity and application journey in one portal.</p><Button variant="outline" className="mt-5 w-full">Create account</Button></CardContent></Card>
    </div></section>}
  </main><SiteFooter/></div>;
};
export default CreatorLanding;
