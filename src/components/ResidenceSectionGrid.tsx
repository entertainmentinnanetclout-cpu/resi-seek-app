import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, MapPin, Users, Bed, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import FavoriteButton from "@/components/FavoriteButton";
import CompareButton from "@/components/CompareButton";
import { useResidenceSections, type ResidenceSection } from "@/hooks/useResidenceSections";

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
  maxCompare
}: ResidenceSectionGridProps) {
  const { sections, loading: sectionsLoading } = useResidenceSections("findmyres");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Auto-open first 3 sections once loaded
  useEffect(() => {
    if (sections.length > 0 && openSections.size === 0) {
      setOpenSections(new Set(sections.slice(0, 3).map(s => s.slug)));
    }
  }, [sections]);

  // Derive section from section_category or campus fallback
  function deriveSection(residence: Residence): string {
    if (residence.section_category) return residence.section_category.toUpperCase();
    
    const campus = residence.campus?.toLowerCase() || '';
    if (campus.includes('soshanguve')) return 'RENTALS';
    if (campus.includes('pretoria west') || campus.includes('pretoria-west')) return 'FLATS';
    if (campus.includes('arcadia') || campus.includes('arts')) return 'FLATS';
    
    return sections.length > 0 ? sections[0].slug : 'OTHER';
  }

  // Group residences by section
  const groupedResidences: Record<string, Residence[]> = {};
  for (const section of sections) {
    groupedResidences[section.slug] = [];
  }
  for (const residence of residences) {
    const slug = deriveSection(residence);
    if (!groupedResidences[slug]) {
      groupedResidences[slug] = [];
    }
    groupedResidences[slug].push(residence);
  }

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const ResidenceCard = ({ residence }: { residence: Residence }) => {
    const isInCompare = compareList.some(r => r.id === residence.id);
    
    return (
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
        <div className="relative">
          <img
            src={residence.image_url || '/placeholder.svg'}
            alt={residence.name}
            className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {residence.is_trusted && (
            <Badge className="absolute top-2 left-2 bg-green-600 text-white">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Trusted
            </Badge>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            <FavoriteButton residenceId={residence.id} />
            <CompareButton
              isSelected={isInCompare}
              disabled={!isInCompare && compareList.length >= maxCompare}
              onClick={(e) => onToggleCompare(residence, e)}
            />
          </div>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground line-clamp-1">{residence.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1 flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {residence.address}
          </p>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Bed className="w-3 h-3" />
              {residence.room_type || 'Standard'}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {residence.available_spots} spots
            </span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-lg font-bold text-primary">
              R{residence.price?.toLocaleString()}/mo
            </span>
            <Button size="sm" asChild>
              <Link to={`/res/${residence.id}`}>View</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (sectionsLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading sections...</div>;
  }

  const activeSections = sections.filter(s => (groupedResidences[s.slug]?.length || 0) > 0);

  if (activeSections.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No residences found matching your criteria.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeSections.map(section => {
        const sectionResidences = groupedResidences[section.slug];
        const isOpen = openSections.has(section.slug);
        
        return (
          <Collapsible key={section.id} open={isOpen} onOpenChange={() => toggleSection(section.slug)}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-4 h-auto hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${section.color}`} />
                  <span className="text-lg font-semibold">{section.name}</span>
                  {section.subtitle && (
                    <span className="text-sm text-muted-foreground hidden sm:inline">— {section.subtitle}</span>
                  )}
                  <Badge variant="secondary">{sectionResidences.length}</Badge>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4 pb-2">
                {sectionResidences.map(residence => (
                  <ResidenceCard key={residence.id} residence={residence} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
