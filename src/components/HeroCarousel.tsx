import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Slide {
  image: string;
  title: string;
  description: string;
  cta?: {
    text: string;
    action: () => void;
  };
}

interface HeroCarouselProps {
  slides?: Slide[];
  autoPlay?: boolean;
  interval?: number;
  className?: string;
  useDatabase?: boolean;
  location?: string;
}

const HeroCarousel = ({ slides: propSlides, autoPlay = true, interval = 5000, className, useDatabase = false }: HeroCarouselProps) => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<Slide[]>(propSlides || []);
  const [isLoading, setIsLoading] = useState(useDatabase);

  useEffect(() => {
    if (useDatabase) {
      fetchSlides();
      
      // Realtime subscription
      const channel = supabase
        .channel('hero-slides-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hero_slides' }, () => fetchSlides())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else if (propSlides) {
      setSlides(propSlides);
    }
  }, [useDatabase, propSlides]);

  const fetchSlides = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("hero_slides")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!error && data && data.length > 0) {
      const formattedSlides: Slide[] = data.map(slide => ({
        image: slide.image_url,
        title: slide.title,
        description: slide.description || "",
        cta: slide.cta_text && slide.cta_link ? {
          text: slide.cta_text,
          action: () => {
            if (slide.cta_link?.startsWith('http')) {
              window.open(slide.cta_link, '_blank');
            } else {
              navigate(slide.cta_link || '/');
            }
          }
        } : undefined
      }));
      setSlides(formattedSlides);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!autoPlay || slides.length === 0) return;
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, interval, slides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  if (isLoading) {
    return (
      <div className={cn("relative w-full h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden rounded-2xl bg-muted flex items-center justify-center", className)}>
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative w-full h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden rounded-2xl group", className)}>
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={cn(
            "absolute inset-0 transition-all duration-700 ease-in-out",
            index === currentSlide
              ? "opacity-100 scale-100"
              : "opacity-0 scale-105"
          )}
        >
          {/* Background Image with Parallax Effect */}
          <div 
            className="absolute inset-0 bg-cover bg-center transform transition-transform duration-700"
            style={{ 
              backgroundImage: `url(${slide.image})`,
              transform: index === currentSlide ? 'scale(1.05)' : 'scale(1)'
            }}
          >
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative h-full flex items-end pb-16 px-6 md:px-12 lg:px-20">
            <div className="max-w-4xl">
              <h2 
                className={cn(
                  "text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-4 transform transition-all duration-700 delay-100",
                  index === currentSlide
                    ? "translate-y-0 opacity-100"
                    : "translate-y-8 opacity-0"
                )}
              >
                {slide.title}
              </h2>
              <p 
                className={cn(
                  "text-lg md:text-xl lg:text-2xl text-white/90 mb-6 transform transition-all duration-700 delay-200",
                  index === currentSlide
                    ? "translate-y-0 opacity-100"
                    : "translate-y-8 opacity-0"
                )}
              >
                {slide.description}
              </p>
              {slide.cta && (
                <Button
                  variant="hero"
                  size="lg"
                  onClick={slide.cta.action}
                  className={cn(
                    "transform transition-all duration-700 delay-300",
                    index === currentSlide
                      ? "translate-y-0 opacity-100"
                      : "translate-y-8 opacity-0"
                  )}
                >
                  {slide.cta.text}
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Navigation Arrows */}
      <div className="absolute inset-0 flex items-center justify-between px-4 md:px-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Button
          variant="outline"
          size="icon"
          onClick={prevSlide}
          className="w-12 h-12 rounded-full backdrop-blur-glass border-white/20 hover:bg-white/20"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={nextSlide}
          className="w-12 h-12 rounded-full backdrop-blur-glass border-white/20 hover:bg-white/20"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </Button>
      </div>

      {/* Dots Indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              index === currentSlide
                ? "w-8 bg-white"
                : "w-2 bg-white/50 hover:bg-white/75"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroCarousel;