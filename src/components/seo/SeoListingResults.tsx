import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Bed, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ResidencePosterDownloadButton from "@/components/findmyres/ResidencePosterDownloadButton";
import { supabase } from "@/integrations/supabase/client";
import { publicPrivateMonthlyRent, hasVerifiedPrivateRent } from "@/lib/residenceListingEvidence";

export interface ListingQuery {
  audience?: "university" | "tvet" | "private";
  nsfasOnly?: boolean;
  areaTerms?: string[];
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  singlesOnly?: boolean;
  category?: string;
  limit?: number;
}

interface Residence {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  campus: string | null;
  province: string | null;
  city: string | null;
  place_label: string | null;
  price: number;
  private_price: number | null;
  nsfas_price: number | null;
  promo_price: number | null;
  promo_active: boolean | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  price_verified_at: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  images: string[] | null;
  available_spots: number;
  capacity: number | null;
  accepts_nsfas: boolean;
  accepts_private: boolean;
  accepts_tvet: boolean;
  accepts_university: boolean;
  room_type: string | null;
  room_types: string[] | null;
  singles_available: number | null;
  amenities: unknown;
  has_wifi: boolean | null;
  has_parking: boolean | null;
  is_furnished: boolean | null;
  utilities_included: boolean | null;
  reservations_2027_open: boolean | null;
}

interface Props {
  heading: string;
  query: ListingQuery;
  emptyText: string;
  fallbackTo?: string;
}

const AUDIENCE_COLUMN = {
  university: "accepts_university",
  tvet: "accepts_tvet",
  private: "accepts_private",
} as const;

const SeoListingResults = ({ heading, query, emptyText, fallbackTo = "/find" }: Props) => {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!cancelled) { setLoading(true); setError(false); }
      try {
        // Keep the large generated Supabase relation type from recursively
        // expanding during the public listing query. Results are narrowed to
        // the Residence display contract below, and RLS stays enforced.
        let req = (supabase as any)
          .from("residences")
          .select(
            "id, slug, name, address, campus, province, city, place_label, price, private_price, nsfas_price, promo_price, promo_active, promo_starts_at, promo_ends_at, price_verified_at, image_url, cover_image_url, images, available_spots, capacity, accepts_nsfas, accepts_private, accepts_tvet, accepts_university, room_type, room_types, singles_available, amenities, has_wifi, has_parking, is_furnished, utilities_included, reservations_2027_open",
          )
          .eq("is_visible", true)
          .order("display_order", { ascending: true })
          .limit(query.city ? 200 : 500);

        if (query.city) req = req.eq("city", query.city);
        if (query.audience) req = req.eq(AUDIENCE_COLUMN[query.audience], true);
        if (query.nsfasOnly) req = req.eq("accepts_nsfas", true);
        if (query.category) req = req.eq("category", query.category);

        const { data, error } = await req;
        if (error) throw error;

        let rows = (data || []) as Residence[];

        if (query.areaTerms?.length) {
          const terms = query.areaTerms.map((t) => t.toLowerCase());
          rows = rows.filter((r) => {
            const haystack = `${r.address || ""} ${r.campus || ""} ${r.province || ""}`.toLowerCase();
            return terms.some((t) => haystack.includes(t));
          });
        }

        // Do not turn a missing price or unknown room category into a budget offer.
        // The price comparison uses the same property price displayed in the card.
        if (query.minPrice !== undefined || query.maxPrice !== undefined) {
          rows = rows.filter((r) => {
            const monthly = publicPrivateMonthlyRent(r);
            return monthly !== null && monthly >= (query.minPrice ?? 0) && monthly <= (query.maxPrice ?? Number.POSITIVE_INFINITY);
          });
        }
        if (query.singlesOnly) {
          rows = rows.filter((r) => (r.singles_available ?? 0) > 0 ||
            [r.room_type, ...(r.room_types || [])].some((v) => /\\bsingle\\b/i.test(String(v || ""))));
        }

        if (!cancelled) setResidences(rows.slice(0, query.limit ?? 6));
      } catch (err) {
        console.error("[SeoListingResults]", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [query.audience, query.nsfasOnly, query.category, query.city, query.minPrice, query.maxPrice, query.singlesOnly, query.limit, refreshKey, JSON.stringify(query.areaTerms)]);

  return (
    <section aria-labelledby="listings-heading" className="mt-14">
      <h2 id="listings-heading" className="text-2xl font-bold tracking-tight md:text-3xl">{heading}</h2>

      {loading ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : error ? (
        <Card className="mt-6"><CardContent className="space-y-3 p-8 text-center">
          <p role="alert" className="text-sm text-muted-foreground">Live listings could not be retrieved. This does not mean accommodation is unavailable in this area.</p>
          <Button type="button" variant="outline" onClick={() => setRefreshKey(n => n + 1)}>Retry listings</Button>
        </CardContent></Card>
      ) : residences.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">{emptyText}</p>
            <Button asChild className="mt-4">
              <Link to={fallbackTo}>Search all listings</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {residences.map((r) => {
            const image = r.cover_image_url || r.images?.[0] || r.image_url || "/placeholder.svg";
            const area = r.campus || r.province || "South Africa";
            const displayPrice = publicPrivateMonthlyRent(r);
            const isVerified = hasVerifiedPrivateRent(r);
            return (
              <li key={r.id}>
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="relative">
                    <Link to={`/find-my-res/${r.slug || r.id}`} className="block">
                      <img
                        src={image}
                        alt={`${r.name} student accommodation in ${area}`}
                        width={640}
                        height={400}
                        loading="lazy"
                        decoding="async"
                        className="aspect-[16/10] w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </Link>
                    <div className="absolute right-3 top-3 z-20">
                      <ResidencePosterDownloadButton residence={r} compact />
                    </div>
                  </div>
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold leading-snug">
                        <Link to={`/find-my-res/${r.slug || r.id}`} className="hover:text-primary">{r.name}</Link>
                      </h3>
                      {r.accepts_nsfas && (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Accepts NSFAS
                        </Badge>
                      )}
                    </div>
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{[r.place_label, r.campus, r.city].filter(Boolean).join(" · ") || "Area not provided"}</span>
                    </p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Bed className="h-4 w-4" aria-hidden="true" />
                      <span>{r.available_spots > 0 ? `${r.available_spots} landlord-reported spaces · confirm` : "Ask the residence for current availability"}</span>
                    </p>
                    {displayPrice !== null ? (
                      <p className="text-sm font-semibold text-foreground">
                        Reported from R{displayPrice.toLocaleString("en-ZA")}/month · {isVerified ? "base price verification on file; confirm current quote" : "landlord-reported; confirm current quote"}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-muted-foreground">Price on request · no confirmed monthly rate supplied</p>
                    )}
                    <Button asChild variant="outline" className="mt-2 w-full">
                      <Link to={`/find-my-res/${r.slug || r.id}`}>View residence</Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default SeoListingResults;
