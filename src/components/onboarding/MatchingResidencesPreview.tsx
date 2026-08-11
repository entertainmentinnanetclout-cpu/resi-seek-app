import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Bed, ShieldCheck, ArrowRight, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserIntent } from "@/contexts/UserIntentContext";
import { isMockResidence } from "@/hooks/useResidenceFilters";
import { residenceMatchesCampus } from "@/constants/institutionOptions";
import { deriveFiltersFromIntent } from "@/lib/intent/intentFilters";
import { BRAND } from "@/constants/brand";

interface MatchingResidencesPreviewProps {
  /** Continue into the assisted request form ("Request help without choosing") */
  onRequestHelp: () => void;
  onBack?: () => void;
}

/**
 * Image-first results preview shown straight after the guide answers, so people
 * browse real places before ever meeting a form.
 */
const MatchingResidencesPreview = ({ onRequestHelp, onBack }: MatchingResidencesPreviewProps) => {
  const navigate = useNavigate();
  const { intent } = useUserIntent();
  const { patch, note, privateRentalUnavailable } = useMemo(
    () => deriveFiltersFromIntent({ ...intent, completed_guide: true }),
    [intent]
  );

  const chips = useMemo(() => {
    const list: string[] = [];
    if (patch.audience && patch.audience !== "all") list.push(`${patch.audience.toUpperCase()} accommodation`);
    if (patch.campus) list.push(patch.campus);
    if (patch.nsfasOnly) list.push("NSFAS accommodation context");
    if (patch.priceMax) list.push(`Up to R${Number(patch.priceMax).toLocaleString("en-ZA")}`);
    (patch.roomTypes || []).forEach((r) => list.push(r));
    return list;
  }, [patch]);

  const { data: result, isLoading } = useQuery({
    queryKey: ["guide-matches", patch, privateRentalUnavailable],
    enabled: !privateRentalUnavailable,
    queryFn: async () => {
      const columns =
        "id, slug, name, address, campus, image_url, images, price, available_spots, room_types, is_trusted, is_tut_accredited, accepts_university, accepts_tvet, accepts_private, accepts_nsfas, institution_tags, verification_level";

      // Audience/NSFAS constraints are hard. Budget is soft so we can offer
      // clearly-labelled closest matches instead of an empty screen.
      const base = () => {
        let q = supabase.from("residences").select(columns);
        if (patch.audience === "tvet") q = q.eq("accepts_tvet", true);
        if (patch.audience === "university") q = q.eq("accepts_university", true);
        if (patch.privatePayingOnly || patch.audience === "private") q = q.eq("accepts_private", true);
        if (patch.nsfasOnly) q = q.or("accepts_nsfas.eq.true,is_tut_accredited.eq.true");
        return q;
      };

      const applyCampus = (rows: any[]) =>
        patch.campus
          ? rows.filter((r) => residenceMatchesCampus(r, patch.campus, patch.institutionType))
          : rows;

      const { data, error } = await base().order("price", { ascending: true }).limit(60);
      if (error) throw error;

      const scoped = applyCampus((data ?? []).filter((r: any) => !isMockResidence(r)));
      const budget = Number(patch.priceMax) || 0;
      const exact = budget ? scoped.filter((r: any) => Number(r.price || 0) <= budget) : scoped;

      return {
        exact: exact.slice(0, 6),
        closest: exact.length === 0 ? scoped.slice(0, 6) : [],
      };
    },
  });

  const residences = result?.exact ?? [];
  const closest = result?.closest ?? [];
  const showingClosest = residences.length === 0 && closest.length > 0;
  const cards = showingClosest ? closest : residences;

  if (privateRentalUnavailable) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h3 className="text-xl font-bold">Private rental support is active</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us your area and budget so ResKonnect can assist. We never present student
          residences as private rentals.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button onClick={onRequestHelp} className="bg-cta font-semibold text-cta-foreground hover:bg-cta/90">
            Tell us what you need
          </Button>
          <Button asChild variant="outline">
            <Link to="/living/private-rentals">Browse private rentals</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {note && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
          {note}
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Badge key={c} variant="secondary" className="capitalize">
              {c}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : cards.length > 0 ? (
        <>
        {showingClosest && (
          <div className="rounded-xl border border-amber/30 bg-amber/10 p-4 text-sm">
            <p className="font-semibold">No exact matches found</p>
            <p className="text-muted-foreground">
              These are the closest matches above your selected budget.
            </p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((r: any) => (
            <Link
              key={r.id}
              to={`/find-my-res/${r.slug || r.id}`}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                <img
                  src={r.image_url || r.images?.[0] || "/placeholder.svg"}
                  alt={r.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/placeholder.svg")}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy/85 to-transparent p-3">
                  <p className="line-clamp-1 text-sm font-semibold text-white">{r.name}</p>
                  <p className="flex items-center gap-1 text-xs text-white/75">
                    <MapPin className="h-3 w-3" /> <span className="line-clamp-1">{r.address}</span>
                  </p>
                </div>
                {r.is_trusted && (
                  <Badge className="absolute left-3 top-3 border-0 bg-brand-green text-white">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-primary">
                    R{Number(r.price || 0).toLocaleString("en-ZA")}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Number(r.available_spots) > 0 ? `${r.available_spots} spots` : "Fully booked"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(r.room_types || []).slice(0, 2).map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[10px] capitalize">
                      <Bed className="mr-1 h-3 w-3" />
                      {t}
                    </Badge>
                  ))}
                  {r.is_tut_accredited && (
                    <Badge variant="outline" className="text-[10px]">NSFAS accommodation</Badge>
                  )}
                  {r.accepts_private && (
                    <Badge variant="outline" className="text-[10px]">Accepts private-paying</Badge>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No exact matches found for these answers. Browse all verified places or let us
          source options for you directly.
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => navigate("/find")}
          className="bg-cta font-semibold text-cta-foreground hover:bg-cta/90"
        >
          Show me matching places <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onRequestHelp}>
          Request help without choosing
        </Button>
        <Button asChild variant="ghost" className="sm:ml-auto">
          <a
            href={`https://wa.me/${BRAND.contact.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp {BRAND.contact.phone}
          </a>
        </Button>
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back
        </button>
      )}
    </div>
  );
};

export default MatchingResidencesPreview;
