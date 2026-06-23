import { Link } from "react-router-dom";
import { MapPin, Bed, Users, Wifi, Car, Sofa } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import FavoriteButton from "@/components/FavoriteButton";
import WhatsAppButton from "@/components/WhatsAppButton";
import { RESKONNECT_WHATSAPP } from "@/lib/constants";
import { StatusBadge, residenceStatus } from "./StatusBadge";

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

  return (
    <Link to={`/find-my-res/${slug}`} className="block group">
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

          {/* Status badges (top right) */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
            <StatusBadge variant={status} label={status === "limited" ? `${spots} LEFT` : undefined} />
            {residence.is_featured && status !== "featured" && <StatusBadge variant="featured" />}
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
            <div className="flex gap-1 shrink-0">
              {residence.is_trusted && (
                <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">NSFAS ✓</Badge>
              )}
              {residence.is_tut_accredited && (
                <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600">TUT ✓</Badge>
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
              <span className="shrink-0 ml-auto text-xs font-medium">{distance}km</span>
            )}
          </div>

          {/* Room types + Singles + Gender */}
          <div className="flex flex-wrap gap-1.5">
            {(residence.room_types || [residence.room_type]).filter(Boolean).slice(0, 3).map((type: string) => (
              <Badge key={type} variant="secondary" className="text-xs capitalize">
                <Bed className="w-3 h-3 mr-1" />
                {type}
              </Badge>
            ))}
            {(singlesAvailable > 0 || hasSingles) && (
              <Badge variant="outline" className="text-xs border-green-500/50 text-green-600">
                {singlesAvailable > 0 ? `${singlesAvailable} Singles` : "Singles Available"}
              </Badge>
            )}
            {residence.gender && (
              <Badge variant="outline" className="text-xs capitalize">{residence.gender}</Badge>
            )}
          </div>

          {/* Amenities icons */}
          {(residence.is_furnished || residence.has_wifi || residence.has_parking) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {residence.is_furnished && <span className="flex items-center gap-1"><Sofa className="w-3.5 h-3.5" />Furnished</span>}
              {residence.has_wifi && <span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5" />WiFi</span>}
              {residence.has_parking && <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" />Parking</span>}
            </div>
          )}

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
