import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Building2, Camera, CheckCircle2, RefreshCw, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CityCoverage = {
  city_key: string; city: string; published_residences: number;
  published_private_rent_references: number; accepts_nsfas_count: number;
  reservation_interest_2027_count: number; reported_spots_listings: number;
  photo_reference_listings: number; verified_price_listings: number;
  verified_location_listings: number; review_ready_listings: number;
};
const paths: Record<string, string> = {
  pretoria: "/student-accommodation/pretoria",
  soshanguve: "/student-accommodation/soshanguve",
  "ga-rankuwa": "/student-accommodation/ga-rankuwa",
  mbombela: "/student-accommodation/mbombela",
  polokwane: "/student-accommodation/polokwane",
};
export default function CityEvidenceSnapshot({ city }: { city?: string }) {
  const [rows, setRows] = useState<CityCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Live supply data is unavailable offline. Published city links remain accessible.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Grouped public evidence only. No student records or full street addresses.
      let req = (supabase as any).from("reskonnect_city_coverage_v")
        .select("city_key,city,published_residences,published_private_rent_references,accepts_nsfas_count,reservation_interest_2027_count,reported_spots_listings,photo_reference_listings,verified_price_listings,verified_location_listings,review_ready_listings")
        .order("published_residences", { ascending: false }).limit(20);
      if (city) req = req.eq("city_key", city.toLowerCase().trim());
      const { data, error: queryError } = await req;
      if (queryError) throw queryError;
      setRows((data || []) as CityCoverage[]);
    } catch {
      setError("Live listing counts could not be retrieved. This does not mean there are no residences in the area.");
    } finally {
      setLoading(false);
    }
  }, [city]);
  useEffect(() => {
    // Nonessential SEO stats must not compete with authentication.
    const timer = window.setTimeout(() => { void load(); }, 900);
    return () => window.clearTimeout(timer);
  }, [load]);

  const total = rows.reduce((sum, row) => sum + Number(row.published_residences || 0), 0);
  return <section className="mt-14 space-y-4" aria-labelledby="city-evidence-heading">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 id="city-evidence-heading" className="text-2xl font-bold tracking-tight">Live accommodation coverage</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          A published listing is not a verified property, guaranteed vacancy or approved NSFAS accommodation.
          Pricing, evidence and room availability are separate facts.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
        <RefreshCw className="mr-2 h-4 w-4"/>Refresh counts
      </Button>
    </div>
    {error && <div role="status" className="flex gap-2 rounded-xl border border-amber-500/30 p-3 text-sm text-muted-foreground">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"/>{error}
    </div>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">Checking currently published records…</p>
      : rows.length > 0 ? <>
        <p className="text-sm font-semibold">
          {total.toLocaleString("en-ZA")} published records {city ? "in this city" : "across our listed cities"} · not a count of verified or bookable rooms
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(row => <Card key={row.city_key}><CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary"/><h3 className="text-lg font-bold">{row.city}</h3></div>
            <p className="text-2xl font-black">{row.published_residences} <span className="text-sm font-medium text-muted-foreground">published records</span></p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="flex gap-2"><WalletCards className="h-3.5 w-3.5 shrink-0"/>{row.published_private_rent_references} with a reported positive private monthly rate</p>
              <p className="flex gap-2"><Camera className="h-3.5 w-3.5 shrink-0"/>{row.photo_reference_listings} with photo references</p>
              <p className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0"/>{row.verified_price_listings} with price verification recorded</p>
              <p>{row.accepts_nsfas_count} report accepting NSFAS · this is not official accreditation</p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to={paths[row.city_key] || "/find"}>Explore {row.city} listings</Link>
            </Button>
          </CardContent></Card>)}
        </div>
      </> : !error && <p className="text-sm text-muted-foreground">No published city evidence returned. Browse the full search or request a provider quote.</p>}
    <p className="text-xs text-muted-foreground">
      Counts describe visible records, not individually allocated beds. Always confirm current availability and a complete written quote.
      Are you a property owner? <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/partners/landlords">List your property with ResKonnect</Link>.
    </p>
  </section>;
}
