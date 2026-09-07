import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, BedDouble, Building2, CalendarDays, CheckCircle2, ExternalLink, Footprints, Layers3, MapPin, Sparkles, View, Wifi } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ResidenceDigitalTwin from "@/components/resmap/ResidenceDigitalTwin";
import Residence360Viewer from "@/components/resmap/Residence360Viewer";

const money = (value: unknown) => Number(value) > 0 ? `R${Number(value).toLocaleString("en-ZA")}` : "Ask residence";
type Mode = "twin" | "tour" | "rooms";

export default function ImmersiveResidence() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [residence, setResidence] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [twin, setTwin] = useState<any>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [mode, setMode] = useState<Mode>("twin");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("all");
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const db = supabase as any;
      let res = await db.from("residences").select("*").eq("slug", slug).maybeSingle();
      if (!res.data) res = await db.from("residences").select("*").eq("id", slug).maybeSingle();
      if (!active) return;
      if (!res.data) { setLoading(false); return; }
      setResidence(res.data);
      const id = res.data.id;
      const [m, d, f, r] = await Promise.all([
        db.from("resmap_residence_media").select("*").eq("residence_id", id).eq("is_published", true).order("sort_order"),
        db.from("resmap_digital_twins").select("*").eq("residence_id", id).eq("is_published", true).maybeSingle(),
        db.from("resmap_floors").select("*").eq("residence_id", id).eq("is_published", true).order("sort_order"),
        db.from("resmap_rooms").select("*").eq("residence_id", id).eq("is_published", true).order("name"),
      ]);
      if (!active) return;
      setMedia(m.data || []); setTwin(d.data || null); setFloors(f.data || []); setRooms(r.data || []); setLoading(false);
    })();
    return () => { active = false; };
  }, [slug]);

  const tour = useMemo(() => media.find((m) => m.media_type === "tour_360")?.url || residence?.virtual_tour_url || null, [media, residence]);
  const images = useMemo(() => media.filter((m) => m.media_type === "photo").map((m) => m.url), [media]);
  const visibleRooms = useMemo(() => selectedFloorId === "all" ? rooms : rooms.filter((r) => r.floor_id === selectedFloorId), [rooms, selectedFloorId]);
  const exactLocation = residence?.location_verification_status && residence.location_verification_status !== "approximate";

  const holdRoom = async (room: any) => {
    if (!user) { navigate(`/auth?returnTo=${encodeURIComponent(`/find-my-res/${slug}/immersive`)}`); return; }
    if (!room.reservable) { toast.info("This listing is available for enquiry, but direct room holding has not been verified by the residence yet."); navigate(`/find-my-res/${slug}?intent=secure`); return; }
    setHoldingId(room.id);
    try {
      const { data, error } = await (supabase as any).rpc("resmap_hold_room", { p_room_id: room.id, p_academic_year: 2027, p_funding_type: "undecided" });
      if (error) throw error;
      toast.success(`${data?.room || room.name} held for 20 minutes. Complete your reservation to keep it.`);
      navigate("/my-applications");
    } catch (error: any) { toast.error(error?.message || "Could not hold this room."); }
    finally { setHoldingId(null); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /><p className="mt-3 text-sm text-muted-foreground">Building your immersive residence view…</p></div></div>;
  if (!residence) return <div className="grid min-h-screen place-items-center p-6"><div className="text-center"><Building2 className="mx-auto h-12 w-12 text-muted-foreground" /><h1 className="mt-4 text-2xl font-black">Residence not found</h1><Button asChild className="mt-4"><Link to="/findmyres">Back to Find My Res</Link></Button></div></div>;

  const price = residence.private_price || residence.price || residence.nsfas_price;
  return <main className="min-h-screen bg-background pb-24">
    <SEO title={`${residence.name} Immersive 3D Tour | ResKonnect`} description={`Explore ${residence.name} in ResKonnect Immersive Living: 3D residence view, 360 tours, room inventory and interactive reservation.`} />
    <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <div className="min-w-0 text-center"><p className="truncate text-sm font-black">{residence.name}</p><p className="text-[10px] uppercase tracking-[.18em] text-muted-foreground">ResKonnect Immersive Living</p></div>
        <Button size="sm" onClick={() => navigate(`/find-my-res/${residence.slug || residence.id}?intent=secure`)}>Secure</Button>
      </div>
    </header>

    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <section className="overflow-hidden rounded-[30px] border bg-card shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.35fr_.65fr]">
          <div className="min-w-0 p-3 sm:p-5">
            {mode === "twin" && <ResidenceDigitalTwin residence={{ ...residence, digitalTwinFloors: twin?.scene_json?.floors }} twin={twin} roomCount={rooms.length} />}
            {mode === "tour" && <Residence360Viewer tourUrl={tour} title={`${residence.name} 360 tour`} />}
            {mode === "rooms" && <div className="min-h-[46vh] rounded-[28px] border bg-muted/20 p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Rooms & inventory</h2><p className="text-sm text-muted-foreground">Verified physical rooms can be held directly. Overview inventory is clearly labelled.</p></div><div className="flex max-w-full gap-2 overflow-x-auto pb-1"><button onClick={() => setSelectedFloorId("all")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${selectedFloorId === "all" ? "bg-primary text-primary-foreground" : "bg-background"}`}>All</button>{floors.map((floor) => <button key={floor.id} onClick={() => setSelectedFloorId(floor.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${selectedFloorId === floor.id ? "bg-primary text-primary-foreground" : "bg-background"}`}>{floor.label}</button>)}</div></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleRooms.map((room) => <Card key={room.id} className="overflow-hidden rounded-2xl"><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-black">{room.room_code && room.room_code !== "OVERVIEW" ? room.room_code : room.name}</p><p className="text-xs text-muted-foreground">{room.inventory_kind === "physical_room" ? "Physical room" : room.inventory_kind === "room_type" ? "Room type inventory" : "Residence inventory overview"}</p></div><Badge variant={room.status === "available" ? "default" : "outline"}>{room.status}</Badge></div><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-muted/50 p-2"><p className="text-muted-foreground">Available</p><p className="mt-1 font-black">{room.available_beds} beds</p></div><div className="rounded-xl bg-muted/50 p-2"><p className="text-muted-foreground">From</p><p className="mt-1 font-black">{money(room.private_price || room.nsfas_price)}</p></div></div>{room.is_verified ? <p className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><BadgeCheck className="h-3.5 w-3.5" />Residence-confirmed inventory</p> : <p className="text-xs text-muted-foreground">Published inventory — exact room assignment is confirmed by the residence.</p>}<Button className="w-full" disabled={holdingId === room.id || room.available_beds <= 0} variant={room.reservable ? "default" : "outline"} onClick={() => holdRoom(room)}>{holdingId === room.id ? "Holding…" : room.reservable ? "Hold for 20 minutes" : "Continue to secure"}</Button></CardContent></Card>)}</div>
            </div>}
          </div>

          <aside className="space-y-5 border-t p-5 lg:border-l lg:border-t-0">
            <div><div className="flex flex-wrap gap-2">{residence.accepts_nsfas && <Badge className="bg-emerald-600">NSFAS</Badge>}{residence.is_tut_accredited && <Badge className="bg-blue-600">TUT verified</Badge>}{residence.has_wifi && <Badge variant="outline"><Wifi className="mr-1 h-3 w-3" />Wi-Fi</Badge>}{residence.reservations_2027_open && <Badge variant="outline"><CalendarDays className="mr-1 h-3 w-3" />2027 open</Badge>}</div><h1 className="mt-3 text-3xl font-black tracking-tight">{residence.name}</h1><p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{residence.canonical_address || residence.address || residence.campus}</p>{!exactLocation && <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">Approximate area pin. Use the Google Maps check below for the exact entrance while ResKonnect verifies this residence.</p>}</div>
            <div className="rounded-2xl border bg-muted/30 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Published price</p><p className="mt-1 text-3xl font-black">{money(price)}<span className="text-sm font-medium text-muted-foreground">/mo</span></p><p className="mt-2 text-sm">{Number(residence.available_spots || 0)} published spaces available</p></div>
            <div className="grid grid-cols-3 gap-2">{([['twin',Layers3,'3D Twin'],['tour',View,'360 Tour'],['rooms',BedDouble,'Rooms']] as const).map(([key,Icon,label]) => <button key={key} onClick={() => setMode(key)} className={`rounded-2xl border p-3 text-center text-xs font-bold transition ${mode === key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}><Icon className="mx-auto mb-1.5 h-5 w-5" />{label}</button>)}</div>
            <div className="space-y-2"><Button className="w-full" onClick={() => setMode("rooms")}><CheckCircle2 className="mr-2 h-4 w-4" />Choose room / secure</Button>{residence.google_maps_url && <Button variant="outline" className="w-full" asChild><a href={residence.google_maps_url} target="_blank" rel="noreferrer"><MapPin className="mr-2 h-4 w-4" />Check on Google Maps<ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>}<Button variant="secondary" className="w-full" onClick={() => navigate(`/findmyres?view=map&residence=${residence.id}`)}><Footprints className="mr-2 h-4 w-4" />Open in ResMap</Button></div>
          </aside>
        </div>
      </section>

      {images.length > 0 && <section><div className="mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-xl font-black">Residence gallery</h2></div><div className="flex snap-x gap-3 overflow-x-auto pb-2">{images.map((src, index) => <img key={`${src}-${index}`} src={src} alt={`${residence.name} ${index + 1}`} loading="lazy" className="h-56 min-w-[82vw] snap-center rounded-[24px] object-cover sm:min-w-[360px]" />)}</div></section>}
    </div>
  </main>;
}
