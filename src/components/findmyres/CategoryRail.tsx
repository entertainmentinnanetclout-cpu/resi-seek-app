import { useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface CategoryRailProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
  count?: number;
}

export function CategoryRail({ title, subtitle, viewAllHref, viewAllLabel, children, count }: CategoryRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const w = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -w : w, behavior: "smooth" });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-baseline gap-2">
            {title}
            {typeof count === "number" && (
              <span className="text-sm font-normal text-muted-foreground">({count})</span>
            )}
          </h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:inline-flex" onClick={() => scroll("left")} aria-label="Scroll left">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:inline-flex" onClick={() => scroll("right")} aria-label="Scroll right">
            <ChevronRight className="w-4 h-4" />
          </Button>
          {viewAllHref && (
            <Button asChild variant="link" size="sm" className="text-primary">
              <Link to={viewAllHref}>
                {viewAllLabel ?? "View All"} <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 px-4 sm:px-6 lg:px-8"
        style={{ scrollbarWidth: "none" }}
      >
        {children}
      </div>
    </section>
  );
}
