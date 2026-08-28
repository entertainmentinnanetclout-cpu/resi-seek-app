import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Bed, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ResidencePosterDownloadButton from "@/components/findmyres/ResidencePosterDownloadButton";
import { supabase } from "@/integrations/supabase/client";

export interface ListingQuery {
  audience?: "university" | "tvet" | "private";
  nsfasOnly?: boolean;
  areaTerms?: string[];
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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        let req = supabase
          .from("residences")
          .select(
            "id, slug, name, address, campus, province, city, place_label, price, private_price, nsfas_price, promo_price, image_url, cover_image_url, images, available_spots, capacity, accepts_nsfas, accepts_private, accepts_tvet, accepts_university, room_type, room_types, amenities, has_wifi, has_parking, is_furnished, utilities_included, reservations_2027_open",
          )
          .order("display_order", { ascending: true })
          .limit(60);

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

        if (!cancelled) setResidences(rows.slice(0, query.limit ?? 6));
      } catch (err) {
        console.error("[SeoListingResults]", err);
        if (!cancelled) setResidences([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [query.audience, query.nsfasOnly, query.category, query.limit, JSON.stringify(query.areaTerms)]);

  return (
    <section aria-labelledby="listings-heading" className="mt-14">
      <h2 id="listings-heading" className="text-2xl font-bold tracking-tight md:text-3xl">{heading}</h2>

      {loading ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
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
            const displayPrice = Number(r.promo_price || r.private_price || r.price || 0);
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
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" /> NSFAS
                        </Badge>
                      )}
                    </div>
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{r.address}</span>
                    </p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Bed className="h-4 w-4" aria-hidden="true" />
                      <span>{r.available_spots > 0 ? `${r.available_spots} spots available` : "Check live availability"}</span>
                    </p>
                    {displayPrice > 0 ? (
                      <p className="text-sm font-semibold text-foreground">
                        From R{displayPrice.toLocaleString("en-ZA")} per month
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-muted-foreground">Rate available on listing</p>
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
