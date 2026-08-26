import { ExternalLink, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResidenceMapPreviewProps {
  name: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  compact?: boolean;
}

const googleMapsUrl = (name: string, address?: string | null, latitude?: number | string | null, longitude?: number | string | null) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const query = Number.isFinite(lat) && Number.isFinite(lng) && latitude !== null && longitude !== null
    ? `${lat},${lng}`
    : `${name} ${address || ""}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export function ResidenceMapPreview({ name, address, latitude, longitude, compact = true }: ResidenceMapPreviewProps) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoordinates = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined && Number.isFinite(lat) && Number.isFinite(lng);
  const href = googleMapsUrl(name, address, latitude, longitude);

  if (!hasCoordinates) {
    return (
      <div className="overflow-hidden rounded-xl border bg-muted/30">
        <div className="flex min-h-20 items-center justify-between gap-3 bg-[radial-gradient(circle_at_20%_30%,hsl(var(--primary)/0.14),transparent_35%),linear-gradient(135deg,hsl(var(--muted)),hsl(var(--background)))] p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><MapPin className="h-4 w-4 text-primary" /> Map location</div>
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{address || "Open the listing map to view this location."}</p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
            <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              Map <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>
    );
  }

  const delta = compact ? 0.006 : 0.012;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/20">
      <div className="relative h-24">
        <iframe
          title={`${name} map`}
          src={mapSrc}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg border bg-background/95 px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur hover:bg-background"
        >
          Open map <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export default ResidenceMapPreview;