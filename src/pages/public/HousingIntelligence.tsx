import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BarChart3, Building2, GraduationCap, MapPinned, Radar, RefreshCw, TrendingUp, UsersRound } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { loadMapLibre } from "@/lib/resmap/maplibre";

const OPENFREE_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const SA_CENTER: [number, number] = [28.20, -25.73];
const money = (value: unknown) => Number(value || 0).toLocaleString("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 });
const num = (value: unknown) => Number(value || 0).toLocaleString("en-ZA");
const asNum = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

type Layer = "supply" | "demand" | "institution" | "opportunity";

function HousingIntelMap({ rows, layer }: { rows: any[]; layer: Layer }) {
  const node = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!node.current || mapRef.current) return;
    let disposed = false;
    loadMapLibre().then((maplibregl) => {
      if (disposed || !node.current) return;
      const map = new maplibregl.Map({ container: node.current, style: OPENFREE_STYLE, center: SA_CENTER, zoom: 6.4, pitch: 38, bearing: -8, attributionControl: true });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.on("load", () => {
        if (disposed) return;
        map.addSource("housing-intel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "housing-intel-glow", type: "circle", source: "housing-intel",
          paint: { "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 14, 100, 44], "circle-color": ["interpolate", ["linear"], ["get", "score"], 0, "#16a34a", 55, "#f59e0b", 80, "#ef4444"], "circle-opacity": 0.18, "circle-blur": 0.42 }
        });
        map.addLayer({
          id: "housing-intel-points", type: "circle", source: "housing-intel",
          paint: { "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 7, 100, 22], "circle-color": ["interpolate", ["linear"], ["get", "score"], 0, "#16a34a", 55, "#f59e0b", 80, "#ef4444"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2, "circle-opacity": 0.9 }
        });
        map.addLayer({
          id: "housing-intel-labels", type: "symbol", source: "housing-intel", minzoom: 7,
          layout: { "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.7], "text-anchor": "top" },
          paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 2 }
        });
        map.on("click", "housing-intel-points", (event: any) => {
          const feature = event.features?.[0];
          if (!feature) return;
          new maplibregl.Popup({ offset: 16 }).setLngLat(feature.geometry.coordinates).setHTML(`<strong>${feature.properties.label}</strong><br/>${feature.properties.detail}`).addTo(map);
        });
        map.on("mouseenter", "housing-intel-points", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "housing-intel-points", () => { map.getCanvas().style.cursor = ""; });
        setReady(true);
      });
    }).catch(() => setReady(false));
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const features = rows.filter((r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))).map((r) => {
      const score = layer === "supply" ? Math.min(100, asNum(r.residence_count) * 1.2) : layer === "demand" ? asNum(r.demand_index) : layer === "institution" ? asNum(r.pressure_score) : asNum(r.opportunity_score);
      const detail = layer === "supply"
        ? `${num(r.residence_count)} residences · ${num(r.available_spots)} reported spaces`
        : layer === "demand"
          ? `${num(r.demand_count)} qualified demand signals · index ${num(r.demand_index)}`
          : layer === "institution"
            ? `${num(r.demand_count)} demand signals · ${num(r.available_spots)} reported spaces · pressure ${num(r.pressure_score)}`
            : `${r.signal?.replace(/-/g, " ") || "market signal"} · opportunity ${num(r.opportunity_score)}`;
      return { type: "Feature", properties: { score, label: r.campus_name, detail }, geometry: { type: "Point", coordinates: [Number(r.longitude), Number(r.latitude)] } };
    });
    mapRef.current.getSource("housing-intel")?.setData({ type: "FeatureCollection", features });
    if (features.length) {
      const lngs = features.map((f: any) => f.geometry.coordinates[0]);
      const lats = features.map((f: any) => f.geometry.coordinates[1]);
      mapRef.current.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 70, maxZoom: 9, duration: 600 });
    }
  }, [rows, layer, ready]);

  return <div className="relative overflow-hidden rounded-[28px] border bg-muted/20 shadow-sm"><div ref={node} className="h-[430px] w-full md:h-[520px]" />{!ready && <div className="absolute inset-0 grid place-items-center bg-background/80 text-sm text-muted-foreground">Loading intelligence map…</div>}<div className="pointer-events-none absolute left-4 top-4 rounded-2xl border bg-background/90 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur">Live aggregate layer · no student PII</div></div>;
}

export default function HousingIntelligence() {
  const [supply, setSupply] = useState<any[]>([]);
  const [demand, setDemand] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    const db = supabase as any;
    const [s, d, i, o] = await Promise.all([
      db.rpc("housing_intel_supply_live"),
      db.rpc("housing_intel_demand_heat", { p_days: 90 }),
      db.rpc("housing_intel_institution_snapshot", { p_days: 90 }),
      db.rpc("housing_intel_opportunities", { p_days: 90 }),
    ]);
    if (!s.error) setSupply(s.data || []);
    if (!d.error) setDemand(d.data || []);
    if (!i.error) setInstitutions(i.data || []);
    if (!o.error) setOpportunities(o.data || []);
    setUpdatedAt(new Date());
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase.channel("housing-intelligence-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "residences" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "accommodation_demands" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "accommodation_reservations" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const totals = useMemo(() => ({
    residences: supply.reduce((a, r) => a + asNum(r.residence_count), 0),
    capacity: supply.reduce((a, r) => a + asNum(r.total_capacity), 0),
    available: supply.reduce((a, r) => a + asNum(r.available_spots), 0),
    demand: demand.reduce((a, r) => a + asNum(r.demand_count), 0),
    hottest: opportunities[0]?.campus_name || "Building signal history",
  }), [supply, demand, opportunities]);

  const metric = (label: string, value: string, note: string, Icon: any) => <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black tracking-tight">{loading ? "—" : value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p></div><Icon className="h-5 w-5 text-primary" /></div></CardContent></Card>;

  return <PublicLayout>
    <SEO
      title="Student Housing Intelligence Network | ResKonnect"
      description="Live student accommodation supply, demand heat maps, property partner benchmarks, institution accommodation intelligence and development opportunity signals from ResKonnect."
      keywords="student housing intelligence South Africa, student accommodation demand data, accommodation supply map, student housing development opportunities, landlord analytics"
      canonicalPath="/housing-intelligence"
    />

    <main className="bg-gradient-to-b from-primary/[0.06] via-background to-background pb-20">
      <section className="container mx-auto px-4 pb-10 pt-16 sm:px-6 md:pt-24 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2"><Badge className="rounded-full px-4 py-1.5"><Activity className="mr-2 h-3.5 w-3.5" />LIVE NETWORK</Badge><Badge variant="outline" className="rounded-full px-4 py-1.5">Release 5 · Phases 20–24</Badge></div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">Student Housing Intelligence Network</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">ResKonnect now connects live accommodation supply with demand signals, property performance, institution pressure and development opportunity intelligence. Marketplace activity becomes infrastructure-level insight.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><Button asChild size="lg"><Link to="/find">Explore accommodation <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline"><Link to="/partners/institutions">Institution partnerships</Link></Button></div>
        </div>
      </section>

      <section className="container mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metric("Live residences", num(totals.residences), "Mapped public supply feeding the network", Building2)}
          {metric("Tracked bed capacity", num(totals.capacity), "Published capacity across mapped supply", MapPinned)}
          {metric("Reported open spaces", num(totals.available), "Availability is reported/estimated, not audited occupancy", Radar)}
          {metric("90-day demand signals", num(totals.demand), "Applications, reservations and explicit demand requests", UsersRound)}
          {metric("Highest current signal", totals.hottest, "Opportunity ranking strengthens as network activity grows", TrendingUp)}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Network intelligence is live</p><p className="text-sm text-muted-foreground">Supply updates in real time. Demand and opportunity indices use a rolling 90-day signal window.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>

        <Tabs defaultValue="supply" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl p-1 md:grid-cols-5">
            <TabsTrigger value="supply">Supply map</TabsTrigger><TabsTrigger value="demand">Demand heat</TabsTrigger><TabsTrigger value="partners">Partners</TabsTrigger><TabsTrigger value="institutions">Institutions</TabsTrigger><TabsTrigger value="investment">Investment</TabsTrigger>
          </TabsList>

          <TabsContent value="supply" className="space-y-6">
            <HousingIntelMap rows={supply} layer="supply" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{supply.map((r) => <Card key={r.campus_key}><CardHeader className="pb-3"><CardTitle className="text-lg">{r.campus_name}</CardTitle><CardDescription>Phase 20 · Live supply</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">Residences</p><p className="text-xl font-black">{num(r.residence_count)}</p></div><div><p className="text-muted-foreground">Capacity</p><p className="text-xl font-black">{num(r.total_capacity)}</p></div><div><p className="text-muted-foreground">Reported open</p><p className="font-bold">{num(r.available_spots)}</p></div><div><p className="text-muted-foreground">Published avg price</p><p className="font-bold">{asNum(r.average_price) > 0 ? money(r.average_price) : "Not enough verified pricing"}</p></div></CardContent></Card>)}</div>
          </TabsContent>

          <TabsContent value="demand" className="space-y-6">
            <HousingIntelMap rows={demand} layer="demand" />
            <Card><CardHeader><CardTitle>Demand heat ranking</CardTitle><CardDescription>Phase 21 · Qualified activity signals, not individual student profiles.</CardDescription></CardHeader><CardContent className="space-y-2">{demand.length ? demand.map((r, index) => <div key={r.campus_key} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[48px_1fr_auto_auto]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 font-black text-primary">{index + 1}</div><div><p className="font-bold">{r.campus_name}</p><p className="text-xs text-muted-foreground">{num(r.demand_2027)} 2027 signals · {num(r.nsfas_demand)} NSFAS-linked</p></div><div className="sm:text-right"><p className="text-xs text-muted-foreground">Demand signals</p><p className="font-black">{num(r.demand_count)}</p></div><div className="sm:text-right"><p className="text-xs text-muted-foreground">Heat index</p><p className="font-black">{num(r.demand_index)}/100</p></div></div>) : <p className="py-10 text-center text-sm text-muted-foreground">Demand heat strengthens automatically as applications, reservations and accommodation requests accumulate.</p>}</CardContent></Card>
          </TabsContent>

          <TabsContent value="partners" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2"><Card className="border-primary/20 bg-primary/[0.03]"><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Property Partner Analytics</CardTitle><CardDescription>Phase 22 · A private competitive-performance layer for each authorised residence.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><p>Partners can now benchmark applications, reservations, lead-to-placement conversion, listing views, saves and price position against the relevant campus market without exposing another property’s private CRM data.</p><div className="rounded-2xl border bg-background p-4"><p className="font-bold text-foreground">Inside the landlord portal</p><p className="mt-1">Open Growth & conversion analytics to see the new market benchmark and ResKonnect Demand Network layer for your own property.</p></div><Button asChild><Link to="/residence/login">Open property portal <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card><Card><CardHeader><CardTitle>What the benchmark measures</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{["Application performance index","Reservation performance index","Lead-to-placement conversion","Campus average pricing","Listing views and saves","Availability and quality readiness"].map((x) => <div key={x} className="rounded-xl bg-muted/40 p-3 text-sm font-semibold">{x}</div>)}</CardContent></Card></div>
          </TabsContent>

          <TabsContent value="institutions" className="space-y-6">
            <HousingIntelMap rows={institutions} layer="institution" />
            <div className="grid gap-4 lg:grid-cols-2">{institutions.map((r) => <Card key={r.campus_key}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{r.campus_name}</CardTitle><CardDescription>Phase 23 · Accommodation pressure snapshot</CardDescription></div><Badge variant={asNum(r.pressure_score) >= 60 ? "destructive" : "secondary"}>{num(r.pressure_score)}/100 pressure</Badge></div></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4"><div><p className="text-muted-foreground">Residences</p><p className="font-black">{num(r.residences)}</p></div><div><p className="text-muted-foreground">Demand</p><p className="font-black">{num(r.demand_count)}</p></div><div><p className="text-muted-foreground">Applications</p><p className="font-black">{num(r.application_count)}</p></div><div><p className="text-muted-foreground">Reservations</p><p className="font-black">{num(r.reservation_count)}</p></div></CardContent></Card>)}</div>
          </TabsContent>

          <TabsContent value="investment" className="space-y-6">
            <HousingIntelMap rows={opportunities} layer="opportunity" />
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Development Opportunity Intelligence</CardTitle><CardDescription>Phase 24 · Signals for research and feasibility screening. Not financial advice or a guarantee of investment returns.</CardDescription></CardHeader><CardContent className="space-y-3">{opportunities.map((r, index) => <div key={r.campus_key} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[48px_1.4fr_repeat(3,1fr)]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 font-black text-primary">{index + 1}</div><div><p className="font-bold">{r.campus_name}</p><p className="text-xs capitalize text-muted-foreground">{String(r.signal || "balanced").replace(/-/g, " ")}</p></div><div><p className="text-xs text-muted-foreground">Opportunity</p><p className="font-black">{num(r.opportunity_score)}/100</p></div><div><p className="text-xs text-muted-foreground">Pressure</p><p className="font-black">{num(r.pressure_score)}/100</p></div><div><p className="text-xs text-muted-foreground">Supply gap</p><p className="font-black">{num(r.supply_gap)}</p></div></div>)}</CardContent></Card>
          </TabsContent>
        </Tabs>

        <Card className="overflow-hidden border-primary/20"><CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex items-center gap-2 text-primary"><GraduationCap className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-wide">Infrastructure intelligence</span></div><h2 className="mt-2 text-2xl font-black">From accommodation marketplace to student living infrastructure</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">The same network that helps a student find a residence can now show landlords where demand is rising, institutions where supply is constrained, and development teams where further feasibility work may be justified.</p>{updatedAt && <p className="mt-3 text-xs text-muted-foreground">Last refreshed {updatedAt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</p>}</div><Button asChild size="lg"><Link to="/partners">Work with ResKonnect <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>
      </section>
    </main>
  </PublicLayout>;
}
