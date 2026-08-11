import { Link } from "react-router-dom";
import { MapPin, Bed, Users, Wifi, Car, Sofa, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import FavoriteButton from "@/components/FavoriteButton";
import WhatsAppButton from "@/components/WhatsAppButton";
import { RESKONNECT_WHATSAPP } from "@/lib/constants";
import { StatusBadge, residenceStatus } from "./StatusBadge";
import { cn } from "@/lib/utils";

const CATEGORY_ACCENT: Record<string, string> = {
  flats: "from-violet to-pink",
  communes: "from-coral to-amber",
  student_residences: "from-sky to-primary",
  private_rentals: "from-mint to-sky",
};

interface ResidencePropertyCardProps {
  residence: any;
  onApply: (residence: any) => void;
  matchScore?: number;
}

export function ResidencePropertyCard({ residence, onApply, matchScore }: ResidencePropertyCardProps) {
  const spots = residence.available_spots || 0;
  const isFull = spots === 0;
  const hasSingles = residence.room_types?.some((t: string) => t.toLowerCase().includes("single"));
  const singlesAvailable = Number(residence.singles_available) || 0;
  const price = Number(residence.price) || 0;
  const distance = Number(residence.distance_from_campus) || 0;
  const status = residenceStatus(residence);
  const slug = residence.slug || residence.id;
  const accent = CATEGORY_ACCENT[residence.category as string] || "from-primary to-violet";
  const isSpotlight = residence.is_spotlight === true;

  return (
    <Link to={`/find-my-res/${slug}`} className="block group">
      <Card className={cn(
        "overflow-hidden rounded-2xl border-border/50 hover:border-transparent transition-all duration-300",
        "hover:shadow-premium hover:-translate-y-1",
      )}>
        {/* Category accent strip */}
        <div className={cn("h-1.5 w-full bg-gradient-to-r", accent)} />
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={residence.image_url || "/placeholder.svg"}
            alt={`${residence.name} student accommodation${residence.area ? ` in ${residence.area}` : ""} listed on ResKonnect`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
            }}
          />

          {/* Status badges (top right) */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
            <StatusBadge variant={status} label={status === "limited" ? `${spots} LEFT` : undefined} />
            {isSpotlight && (
              <Badge className="bg-gradient-spotlight border-0 text-white shadow-md">
                <Sparkles className="w-3 h-3 mr-1" /> Spotlight
              </Badge>
            )}
            {residence.is_featured && status !== "featured" && !isSpotlight && <StatusBadge variant="featured" />}
          </div>

          {/* Match score */}
          {matchScore !== undefined && matchScore > 0 && (
            <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-gradient-vibrant text-white flex items-center justify-center text-xs font-bold shadow-lg">
              {matchScore}%
            </div>
          )}

          {/* Action overlay — always visible on touch, revealed on hover for pointer devices */}
          <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <FavoriteButton residenceId={residence.id} variant="icon" className="bg-background/80 backdrop-blur-sm h-8 w-8" />
            <WhatsAppButton phone={RESKONNECT_WHATSAPP} residenceName={residence.name} variant="icon" className="bg-background/80 backdrop-blur-sm h-8 w-8" />
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Price */}
          <div className="flex items-start justify-between">
            <span className="inline-flex items-baseline gap-0.5 rounded-full bg-gradient-price px-3 py-1 text-white shadow-sm">
              <span className="text-lg font-bold">R{price.toLocaleString()}</span>
              <span className="text-xs opacity-90">/mo</span>
            </span>
            <div className="flex gap-1 shrink-0">
              {residence.is_trusted && (
                <Badge className="text-[10px] bg-mint/15 text-mint border border-mint/40 hover:bg-mint/20">NSFAS ✓</Badge>
              )}
              {residence.is_tut_accredited && (
                <Badge className="text-[10px] bg-sky/15 text-sky border border-sky/40 hover:bg-sky/20">TUT ✓</Badge>
              )}
              {residence.accepts_tvet && (
                <Badge className="text-[10px] bg-amber/15 text-amber border border-amber/40 hover:bg-amber/20">TVET</Badge>
              )}
              {residence.accepts_private && (
                <Badge className="text-[10px] bg-violet/15 text-violet border border-violet/40 hover:bg-violet/20">Private</Badge>
              )}
            </div>
          </div>

          {/* Name */}
          <h3 className="font-semibold text-base line-clamp-1">{residence.name}</h3>

          {/* Location + Distance */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="line-clamp-1">{residence.address}</span>
            {distance > 0 && (
              <span className="shrink-0 ml-auto text-xs font-medium text-coral">{distance}km</span>
            )}
          </div>

          {/* Room types + Singles + Gender */}
          <div className="flex flex-wrap gap-1.5">
            {(residence.room_types || [residence.room_type]).filter(Boolean).slice(0, 3).map((type: string) => (
              <Badge key={type} className="text-xs capitalize bg-violet/10 text-violet border border-violet/30 hover:bg-violet/20">
                <Bed className="w-3 h-3 mr-1" />
                {type}
              </Badge>
            ))}
            {(singlesAvailable > 0 || hasSingles) && (
              <Badge className="text-xs bg-mint/15 text-mint border border-mint/40 hover:bg-mint/20">
                {singlesAvailable > 0 ? `${singlesAvailable} Singles` : "Singles Available"}
              </Badge>
            )}
            {residence.gender && (
              <Badge className="text-xs capitalize bg-pink/10 text-pink border border-pink/30 hover:bg-pink/20">{residence.gender}</Badge>
            )}
          </div>

          {/* Amenities icons */}
          {(residence.is_furnished || residence.has_wifi || residence.has_parking) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {residence.is_furnished && <span className="flex items-center gap-1 text-amber"><Sofa className="w-3.5 h-3.5" />Furnished</span>}
              {residence.has_wifi && <span className="flex items-center gap-1 text-sky"><Wifi className="w-3.5 h-3.5" />WiFi</span>}
              {residence.has_parking && <span className="flex items-center gap-1 text-mint"><Car className="w-3.5 h-3.5" />Parking</span>}
            </div>
          )}

          {/* Spots info */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{spots} / {residence.capacity || "—"} spots</span>
          </div>

          {/* CTA */}
          <div className="mt-1 space-y-2">
            <Button
              className={cn(
                "w-full",
                !isFull && "bg-gradient-vibrant hover:opacity-90 border-0 text-white shadow-md",
              )}
              variant={isFull ? "outline" : "default"}
              disabled={isFull}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isFull) onApply(residence);
              }}
            >
              {isFull ? "Fully Booked" : "Apply Now"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(
                  `https://wa.me/${RESKONNECT_WHATSAPP.replace(/\s/g, "").replace(/^0/, "27")}?text=${encodeURIComponent(
                    `Hi ResKonnect, I would like to request a viewing for ${residence.name}.`
                  )}`,
                  "_blank",
                  "noopener"
                );
              }}
            >
              Request Viewing
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
