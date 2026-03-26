import { Link } from "react-router-dom";
import { MapPin, Bed, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import FavoriteButton from "@/components/FavoriteButton";
import WhatsAppButton from "@/components/WhatsAppButton";
import { RESKONNECT_WHATSAPP } from "@/lib/constants";

interface ResidencePropertyCardProps {
  residence: any;
  onApply: (residence: any) => void;
  matchScore?: number;
}

export function ResidencePropertyCard({ residence, onApply, matchScore }: ResidencePropertyCardProps) {
  const spots = residence.available_spots || 0;
  const isFull = spots === 0;
  const isFewSpots = spots > 0 && spots <= 5;
  const hasSingles = residence.room_types?.some((t: string) => t.toLowerCase().includes("single"));
  const price = Number(residence.price) || 0;
  const distance = Number(residence.distance_from_campus) || 0;

  return (
    <Link to={`/res/${residence.id}`} className="block group">
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={residence.image_url || "/placeholder.svg"}
            alt={residence.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
            }}
          />

          {/* Availability badge */}
          <div className="absolute top-3 right-3">
            {isFull ? (
              <Badge className="bg-destructive text-destructive-foreground animate-pulse font-bold text-xs">
                FULL
              </Badge>
            ) : isFewSpots ? (
              <Badge className="bg-yellow-500 text-yellow-950 font-semibold text-xs">
                {spots} Spots Left
              </Badge>
            ) : (
              <Badge className="bg-green-500 text-white font-semibold text-xs">
                Available
              </Badge>
            )}
          </div>

          {/* Match score */}
          {matchScore !== undefined && matchScore > 0 && (
            <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-md">
              {matchScore}%
            </div>
          )}

          {/* Action overlay */}
          <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <FavoriteButton residenceId={residence.id} variant="icon" className="bg-background/80 backdrop-blur-sm h-8 w-8" />
            <WhatsAppButton phone={RESKONNECT_WHATSAPP} residenceName={residence.name} variant="icon" className="bg-background/80 backdrop-blur-sm h-8 w-8" />
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Price */}
          <div className="flex items-start justify-between">
            <p className="text-xl font-bold text-primary">
              R{price.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
            {residence.is_trusted && (
              <Badge variant="outline" className="text-xs border-green-500 text-green-600 shrink-0">
                NSFAS ✓
              </Badge>
            )}
          </div>

          {/* Name */}
          <h3 className="font-semibold text-base line-clamp-1">{residence.name}</h3>

          {/* Location + Distance */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="line-clamp-1">{residence.address}</span>
            {distance > 0 && (
              <span className="shrink-0 ml-auto text-xs font-medium">{distance}km</span>
            )}
          </div>

          {/* Room types + Singles */}
          <div className="flex flex-wrap gap-1.5">
            {(residence.room_types || [residence.room_type]).filter(Boolean).slice(0, 3).map((type: string) => (
              <Badge key={type} variant="secondary" className="text-xs capitalize">
                <Bed className="w-3 h-3 mr-1" />
                {type}
              </Badge>
            ))}
            {hasSingles && (
              <Badge variant="outline" className="text-xs border-green-500/50 text-green-600">
                Singles Available
              </Badge>
            )}
          </div>

          {/* Spots info */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{spots} / {residence.capacity || "—"} spots</span>
          </div>

          {/* CTA */}
          <Button
            className="w-full mt-1"
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
        </CardContent>
      </Card>
    </Link>
  );
}
