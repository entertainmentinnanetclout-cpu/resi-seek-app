import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, MapPin, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ResidencePosterDownloadButton from "@/components/findmyres/ResidencePosterDownloadButton";
import { cn } from "@/lib/utils";

interface ResidenceSpotlightSliderProps {
  residences: any[];
  loading?: boolean;
}

export function ResidenceSpotlightSlider({ residences, loading }: ResidenceSpotlightSliderProps) {
  const items = (() => {
    const spot = residences.filter((r) => r.is_spotlight === true);
    if (spot.length > 0) return spot.slice(0, 8);
    return residences.filter((r) => r.is_featured || r.featured).slice(0, 8);
  })();

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || items.length < 2) return;
    const id = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => clearInterval(id);
  }, [emblaApi, items.length]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="h-64 sm:h-80 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-spotlight text-white shadow-glow">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-lg sm:text-xl font-bold bg-gradient-spotlight bg-clip-text text-transparent">
              Spotlight Accommodation
            </h2>
            <p className="text-xs text-muted-foreground">Handpicked residences shining this week</p>
          </div>
        </div>
      </div>

      <div className="relative group">
        <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
          <div className="flex">
            {items.map((r) => {
              const slug = r.slug || r.id;
              const price = Number(r.private_price || r.price) || 0;
              const preview = r.cover_image_url || r.images?.[0] || r.image_url || "/placeholder.svg";
              return (
                <div key={r.id} className="relative min-w-0 flex-[0_0_100%]">
                  <Link to={`/find-my-res/${slug}`} className="block">
                    <div className="relative h-64 sm:h-80 md:h-96 overflow-hidden">
                      <img
                        src={preview}
                        alt={r.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                      <div className="absolute top-4 left-4 flex gap-2 pr-28">
                        <Badge className="bg-gradient-spotlight border-0 text-white shadow-md">
                          <Sparkles className="w-3 h-3 mr-1" /> Spotlight
                        </Badge>
                        {r.is_tut_accredited && (
                          <Badge className="bg-sky text-white border-0">TUT ✓</Badge>
                        )}
                        {r.accepts_nsfas && (
                          <Badge className="bg-mint text-white border-0">NSFAS</Badge>
                        )}
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 text-white">
                        <div className="flex items-end justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <h3 className="text-2xl sm:text-3xl font-bold leading-tight drop-shadow-md">
                              {r.name}
                            </h3>
                            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/90">
                              <MapPin className="w-4 h-4 shrink-0" />
                              <span className="line-clamp-1">{r.address || r.campus}</span>
                            </p>
                            {r.rating && (
                              <p className="mt-1 flex items-center gap-1 text-sm">
                                <Star className="w-4 h-4 fill-amber text-amber" />
                                <span className="font-medium">{Number(r.rating).toFixed(1)}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {price > 0 && (
                              <span className="inline-flex items-baseline gap-1 rounded-full bg-gradient-price px-4 py-2 text-white shadow-lg">
                                <span className="text-xl font-bold">R{price.toLocaleString()}</span>
                                <span className="text-xs opacity-90">/mo</span>
                              </span>
                            )}
                            <Button size="sm" className="bg-white text-foreground hover:bg-white/90 shadow-md">
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="absolute right-4 top-4 z-30">
                    <ResidencePosterDownloadButton residence={r} compact />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {items.length > 1 && (
          <>
            <button
              onClick={scrollPrev}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background text-foreground shadow-xl border border-border transition hover:bg-accent flex items-center justify-center z-40"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={scrollNext}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background text-foreground shadow-xl border border-border transition hover:bg-accent flex items-center justify-center z-40"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-40">
              {scrollSnaps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    selectedIndex === i ? "w-8 bg-white" : "w-1.5 bg-white/60",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default ResidenceSpotlightSlider;