import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import PublicQuickSearch from "@/components/PublicQuickSearch";
import inclusivePathwaysHero from "@/assets/hero-inclusive-pathways.jpg";
import applicationsFundingHero from "@/assets/hero-applications-funding.jpg";

interface Slide {
  image: string;
  title: string;
  description: string;
  cta?: { text: string; action: () => void };
}

interface HeroCarouselProps {
  slides?: Slide[];
  autoPlay?: boolean;
  interval?: number;
  className?: string;
  useDatabase?: boolean;
  location?: string;
}

const HeroCarousel = ({ slides: propSlides, autoPlay = true, interval = 5000, className, useDatabase = false, location }: HeroCarouselProps) => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<Slide[]>(propSlides || []);
  const [isLoading, setIsLoading] = useState(useDatabase);

  useEffect(() => {
    if (useDatabase) {
      fetchSlides();
      const channel = supabase.channel('hero-slides-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'hero_slides' }, () => fetchSlides()).subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (propSlides) setSlides(propSlides);
  }, [useDatabase, propSlides]);

  const fetchSlides = async () => {
    setIsLoading(true);
    let query = supabase.from("hero_slides").select("*").eq("is_active", true);
    if (location) query = query.in("slide_location", [location, "all"]);
    const { data, error } = await query.order("display_order", { ascending: true });
    if (!error && data && data.length > 0) {
      const filteredData = data.filter((slide) => {
        if (!location || !["landing", "dashboard", "all"].includes(location)) return true;
        const title = String(slide.title || "").toLowerCase();
        const link = String(slide.cta_link || "").toLowerCase();
        const description = String(slide.description || "").toLowerCase();
        const marketplaceSignals = ["marketplace", "my store", "shop now", "student shop", "products"];
        return !marketplaceSignals.some((signal) => title.includes(signal) || description.includes(signal) || link.includes(signal));
      });
      const formattedSlides: Slide[] = filteredData.map(slide => ({
        image: resolveSlideImage(slide.title, slide.description, slide.image_url),
        title: slide.title,
        description: slide.description || "",
        cta: slide.cta_text && slide.cta_link ? { text: slide.cta_text, action: () => slide.cta_link?.startsWith('http') ? window.open(slide.cta_link, '_blank') : navigate(slide.cta_link || '/') } : undefined
      }));
      if (formattedSlides.length > 0) setSlides(formattedSlides); else if (propSlides) setSlides(propSlides);
    }
    setIsLoading(false);
  };

  const resolveSlideImage = (title?: string | null, description?: string | null, imageUrl?: string | null) => {
    const copy = `${title ?? ""} ${description ?? ""}`.toLowerCase();
    const isPlaceholder = !imageUrl || imageUrl.includes("placehold.co") || imageUrl.includes("placeholder");
    if (copy.includes("nsfas") || copy.includes("application") || copy.includes("funding") || copy.includes("document")) return isPlaceholder ? applicationsFundingHero : imageUrl;
    if (copy.includes("tvet") || copy.includes("college") || copy.includes("private") || copy.includes("university") || copy.includes("accommodation")) return isPlaceholder ? inclusivePathwaysHero : imageUrl;
    return imageUrl || inclusivePathwaysHero;
  };

  useEffect(() => {
    if (!autoPlay || slides.length === 0) return;
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % slides.length), interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, slides.length]);

  const goToSlide = (index: number) => setCurrentSlide(index);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  if (isLoading) return <div className={cn("relative flex h-[500px] w-full items-center justify-center overflow-hidden rounded-2xl bg-muted md:h-[600px] lg:h-[700px]", className)}><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (slides.length === 0) return null;

  return (
    <div className={cn("group relative h-[520px] w-full overflow-hidden rounded-2xl bg-muted md:h-[640px] lg:h-[720px]", className)}>
      {slides.map((slide, index) => (
        <div key={index} className={cn("absolute inset-0 transition-all duration-700 ease-in-out", index === currentSlide ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-105 opacity-0")}>
          <div className="absolute inset-0 transform bg-cover bg-center transition-transform duration-700" style={{ backgroundImage: `url(${slide.image})`, transform: index === currentSlide ? 'scale(1.05)' : 'scale(1)' }}>
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/25" />
          </div>
          <div className="relative flex h-full items-end px-6 pb-20 md:px-12 lg:px-20">
            <div className="max-w-4xl border-l-4 border-[#F5B32F] pl-5 md:pl-7">
              <div className="mb-3 inline-flex rounded-full border border-white/40 bg-[#071326]/75 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm">ResKonnect</div>
              <h2 className={cn("mb-4 text-4xl font-black leading-[0.95] text-white drop-shadow-2xl transition-all duration-700 delay-100 md:text-5xl lg:text-7xl", index === currentSlide ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")}>{slide.title}</h2>
              <p className={cn("mb-6 max-w-3xl text-base leading-relaxed text-white/95 drop-shadow transition-all duration-700 delay-200 md:text-xl lg:text-2xl", index === currentSlide ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")}>{slide.description}</p>
              <div className={cn("flex flex-wrap items-center gap-3 transition-all duration-700 delay-300", index === currentSlide ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")}>
                {slide.cta && <Button variant="hero" size="lg" onClick={slide.cta.action}>{slide.cta.text}</Button>}
                {location === "landing" && <PublicQuickSearch />}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 opacity-100 transition-opacity duration-300 md:px-8 md:opacity-0 md:group-hover:opacity-100">
        <Button variant="outline" size="icon" onClick={prevSlide} aria-label="Previous slide" className="pointer-events-auto h-12 w-12 rounded-full border-2 border-white bg-white text-[#071326] shadow-2xl hover:border-[#F5B32F] hover:bg-[#F5B32F] hover:text-[#071326]"><ChevronLeft className="h-6 w-6 text-current" /></Button>
        <Button variant="outline" size="icon" onClick={nextSlide} aria-label="Next slide" className="pointer-events-auto h-12 w-12 rounded-full border-2 border-white bg-white text-[#071326] shadow-2xl hover:border-[#F5B32F] hover:bg-[#F5B32F] hover:text-[#071326]"><ChevronRight className="h-6 w-6 text-current" /></Button>
      </div>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-[#071326]/55 px-3 py-2 backdrop-blur-sm">
        {slides.map((_, index) => <button key={index} onClick={() => goToSlide(index)} className={cn("h-2 rounded-full border border-white/70 transition-all duration-300", index === currentSlide ? "w-8 bg-[#F5B32F]" : "w-2 bg-white hover:bg-[#F5B32F]")} aria-label={`Go to slide ${index + 1}`} />)}
      </div>
    </div>
  );
};

export default HeroCarousel;
