import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Users, Bed, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import FavoriteButton from "@/components/FavoriteButton";
import CompareButton from "@/components/CompareButton";
import ResidenceBrandStudioCard from "@/components/findmyres/ResidenceBrandStudioCard";
import { useResidenceSections } from "@/hooks/useResidenceSections";

interface Residence {
  id: string;
  name: string;
  address: string;
  price: number;
  campus: string | null;
  section_category: string | null;
  room_type: string | null;
  available_spots: number;
  image_url: string | null;
  is_trusted: boolean | null;
  verification_level: string | null;
  distance_from_campus: number | null;
  cover_image_url?: string | null;
  studio_image_url?: string | null;
  brand_primary_color?: string | null;
  brand_accent_color?: string | null;
  brand_headline?: string | null;
  brand_subheadline?: string | null;
  brand_badge?: string | null;
  place_label?: string | null;
  city?: string | null;
  private_price?: number | null;
  nsfas_price?: number | null;
  promo_price?: number | null;
  reservations_2027_open?: boolean | null;
}

interface ResidenceSectionGridProps {
  residences: Residence[];
  compareList: Residence[];
  onToggleCompare: (residence: Residence, e: React.MouseEvent) => void;
  onApply: (residence: Residence) => void;
  onViewDetails: (residence: Residence) => void;
  maxCompare: number;
}

export default function ResidenceSectionGrid({
  residences,
  compareList,
  onToggleCompare,
  onApply,
  onViewDetails,
  maxCompare,
}: ResidenceSectionGridProps) {
  const { sections, loading: sectionsLoading } = useResidenceSections("findmyres");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (sections.length > 0 && openSections.size === 0) {
      setOpenSections(new Set(sections.slice(0, 3).map((section) => section.slug)));
    }
  }, [sections, openSections.size]);

  function deriveSection(residence: Residence): string {
    if (residence.section_category) return residence.section_category.toUpperCase();
    const campus = residence.campus?.toLowerCase() || "";
    if (campus.includes("soshanguve")) return "RENTALS";
    if (campus.includes("pretoria west") || campus.includes("pretoria-west")) return "FLATS";
    if (campus.includes("arcadia") || campus.includes("arts")) return "FLATS";
    return sections.length > 0 ? sections[0].slug : "OTHER";
  }

  const groupedResidences: Record<string, Residence[]> = {};
  for (const section of sections) groupedResidences[section.slug] = [];
  for (const residence of residences) {
    const slug = deriveSection(residence);
    if (!groupedResidences[slug]) groupedResidences[slug] = [];
    groupedResidences[slug].push(residence);
  }

  const toggleSection = (section: string) => {
    setOpenSections((previous) => {
      const next = new Set(previous);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const ResidenceCard = ({ residence }: { residence: Residence }) => {
    const isInCompare = compareList.some((item) => item.id === residence.id);
    return (
      <Card className="group min-w-0 overflow-hidden rounded-[22px] transition-all duration-300 hover:-translate-y-1 hover:shadow-premium">
        <div className="relative isolate bg-[#000F2F]">
          <ResidenceBrandStudioCard residence={residence} className="rounded-none shadow-none" />
          {residence.is_trusted && (
            <Badge className="absolute left-2 top-2 z-30 bg-green-600 text-white shadow-lg">
              <ShieldCheck className="mr-1 h-3 w-3" />Trusted
            </Badge>
          )}
          <div className="absolute right-2 top-2 z-30 flex gap-1" onClick={(event) => event.stopPropagation()}>
            <FavoriteButton residenceId={residence.id} />
            <CompareButton
              isSelected={isInCompare}
              disabled={!isInCompare && compareList.length >= maxCompare}
              onClick={(event) => onToggleCompare(residence, event)}
            />
          </div>
        </div>
        <CardContent className="min-w-0 space-y-3 p-4">
          <div className="min-w-0">
            <h3 className="line-clamp-1 font-semibold text-foreground">{residence.name}</h3>
            <p className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{residence.place_label || residence.address || residence.campus}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{residence.room_type || "Standard"}</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{residence.available_spots} spots</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => onViewDetails(residence)}>View</Button>
            <Button size="sm" onClick={() => onApply(residence)} disabled={(residence.available_spots || 0) === 0}>
              {(residence.available_spots || 0) === 0 ? "Full" : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (sectionsLoading) return <div className="py-12 text-center text-muted-foreground">Loading sections...</div>;

  const activeSections = sections.filter((section) => (groupedResidences[section.slug]?.length || 0) > 0);
  if (activeSections.length === 0) return <div className="py-12 text-center text-muted-foreground">No residences found matching your criteria.</div>;

  return (
    <div className="min-w-0 space-y-6">
      {activeSections.map((section) => {
        const sectionResidences = groupedResidences[section.slug];
        const isOpen = openSections.has(section.slug);
        return (
          <Collapsible key={section.id} open={isOpen} onOpenChange={() => toggleSection(section.slug)}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="h-auto w-full min-w-0 justify-between p-4 hover:bg-muted/50">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`h-3 w-3 shrink-0 rounded-full ${section.color}`} />
                  <span className="truncate text-lg font-semibold">{section.name}</span>
                  {section.subtitle && <span className="hidden truncate text-sm text-muted-foreground sm:inline">— {section.subtitle}</span>}
                  <Badge variant="secondary" className="shrink-0">{sectionResidences.length}</Badge>
                </div>
                {isOpen ? <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid min-w-0 grid-cols-1 gap-4 pb-2 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sectionResidences.map((residence) => <ResidenceCard key={residence.id} residence={residence} />)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
