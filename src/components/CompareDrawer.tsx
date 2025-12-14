import { useState, useEffect } from "react";
import { Scale, X, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Residence {
  id: string;
  name: string;
  price: number;
  distance_from_campus?: number;
  room_type?: string;
  amenities?: string[];
  image_url?: string;
  campus?: string;
  available_spots?: number;
}

interface CompareDrawerProps {
  compareList: Residence[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

const CompareDrawer = ({ compareList, onRemove, onClear }: CompareDrawerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get all unique amenities across all residences
  const allAmenities = Array.from(
    new Set(compareList.flatMap((r) => r.amenities || []))
  );

  if (compareList.length === 0) return null;

  return (
    <>
      {/* Floating Compare Bar */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-background border border-border rounded-full shadow-premium px-4 py-2 flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in">
        <Scale className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium">
          {compareList.length}/3 selected
        </span>
        <div className="flex gap-1">
          {compareList.map((res) => (
            <div
              key={res.id}
              className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-primary"
            >
              <img
                src={res.image_url || "/placeholder.svg"}
                alt={res.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg";
                }}
              />
              <button
                onClick={() => onRemove(res.id)}
                className="absolute inset-0 bg-foreground/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <X className="w-4 h-4 text-background" />
              </button>
            </div>
          ))}
        </div>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="rounded-full">
              Compare
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
            <SheetHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" />
                  Compare Residences
                </SheetTitle>
                <Button variant="ghost" size="sm" onClick={onClear}>
                  Clear all
                </Button>
              </div>
            </SheetHeader>

            <ScrollArea className="h-full py-4">
              <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${compareList.length}, 1fr)` }}>
                {/* Headers with images */}
                <div className="sticky top-0 bg-background" />
                {compareList.map((res) => (
                  <div key={res.id} className="sticky top-0 bg-background pb-2">
                    <div className="relative rounded-xl overflow-hidden aspect-video mb-2">
                      <img
                        src={res.image_url || "/placeholder.svg"}
                        alt={res.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                      <button
                        onClick={() => onRemove(res.id)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-semibold text-sm truncate">{res.name}</h3>
                    <p className="text-xs text-muted-foreground">{res.campus}</p>
                  </div>
                ))}

                {/* Price Row */}
                <CompareRow label="Price/month">
                  {compareList.map((res) => (
                    <div key={res.id} className="font-bold text-lg text-primary">
                      R{res.price?.toLocaleString()}
                    </div>
                  ))}
                </CompareRow>

                {/* Distance Row */}
                <CompareRow label="Distance">
                  {compareList.map((res) => (
                    <div key={res.id}>
                      {res.distance_from_campus
                        ? `${res.distance_from_campus}km from campus`
                        : "-"}
                    </div>
                  ))}
                </CompareRow>

                {/* Room Type Row */}
                <CompareRow label="Room Type">
                  {compareList.map((res) => (
                    <div key={res.id}>
                      <Badge variant="secondary">{res.room_type || "N/A"}</Badge>
                    </div>
                  ))}
                </CompareRow>

                {/* Available Spots Row */}
                <CompareRow label="Availability">
                  {compareList.map((res) => (
                    <div key={res.id}>
                      {res.available_spots !== undefined ? (
                        <Badge variant={res.available_spots > 0 ? "default" : "destructive"}>
                          {res.available_spots > 0 ? `${res.available_spots} spots` : "Full"}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </div>
                  ))}
                </CompareRow>

                {/* Amenities Section */}
                <div className="col-span-full pt-4 pb-2 border-t border-border mt-4">
                  <h4 className="font-semibold text-muted-foreground">Amenities</h4>
                </div>

                {allAmenities.map((amenity) => (
                  <CompareRow key={amenity} label={amenity}>
                    {compareList.map((res) => (
                      <div key={res.id}>
                        {res.amenities?.includes(amenity) ? (
                          <Check className="w-5 h-5 text-success" />
                        ) : (
                          <Minus className="w-5 h-5 text-muted-foreground/30" />
                        )}
                      </div>
                    ))}
                  </CompareRow>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full"
          onClick={onClear}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </>
  );
};

const CompareRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <>
    <div className="py-3 text-sm font-medium text-muted-foreground border-b border-border/50">
      {label}
    </div>
    {Array.isArray(children)
      ? children.map((child, i) => (
          <div key={i} className="py-3 text-sm border-b border-border/50">
            {child}
          </div>
        ))
      : children}
  </>
);

export default CompareDrawer;
