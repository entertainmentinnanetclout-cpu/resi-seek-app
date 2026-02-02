import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, MapPin, Users, Bed, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import FavoriteButton from "@/components/FavoriteButton";
import CompareButton from "@/components/CompareButton";

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

// Derive section from campus or section_category
function deriveSection(residence: Residence): string {
  // Manual override takes priority
  if (residence.section_category) {
    return residence.section_category;
  }
  
  const campus = residence.campus?.toLowerCase() || '';
  
  if (campus.includes('soshanguve')) return 'Soshanguve';
  if (campus.includes('arts')) return 'Arts';
  if (campus.includes('arcadia')) return 'Arcadia';
  if (campus.includes('pretoria west') || campus.includes('pretoria-west')) return 'Pretoria West';
  if (campus.includes('ga-rankuwa') || campus.includes('garankuwa')) return 'Ga-Rankuwa';
  if (campus.includes('polokwane')) return 'Polokwane';
  if (campus.includes('mbombela') || campus.includes('nelspruit')) return 'Mbombela';
  if (campus.includes('emalahleni') || campus.includes('witbank')) return 'eMalahleni';
  
  return 'Other';
}

// Section order for display
const SECTION_ORDER = [
  'Soshanguve',
  'Pretoria West',
  'Arcadia',
  'Arts',
  'Ga-Rankuwa',
  'ARLC',
  'Polokwane',
  'Mbombela',
  'eMalahleni',
  'Other'
];

// Section colors
const SECTION_COLORS: Record<string, string> = {
  'Soshanguve': 'bg-blue-500',
  'Pretoria West': 'bg-emerald-500',
  'Arcadia': 'bg-purple-500',
  'Arts': 'bg-pink-500',
  'Ga-Rankuwa': 'bg-amber-500',
  'ARLC': 'bg-red-500',
  'Polokwane': 'bg-cyan-500',
  'Mbombela': 'bg-lime-500',
  'eMalahleni': 'bg-orange-500',
  'Other': 'bg-gray-500'
};

export default function ResidenceSectionGrid({
  residences,
  compareList,
  onToggleCompare,
  onApply,
  onViewDetails,
  maxCompare
}: ResidenceSectionGridProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(SECTION_ORDER.slice(0, 3)));

  // Group residences by section
  const groupedResidences = residences.reduce((acc, residence) => {
    const section = deriveSection(residence);
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(residence);
    return acc;
  }, {} as Record<string, Residence[]>);

  // Sort sections by predefined order
  const sortedSections = SECTION_ORDER.filter(section => groupedResidences[section]?.length > 0);

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

  if (sortedSections.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No residences found matching your criteria.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedSections.map(section => {
        const sectionResidences = groupedResidences[section];
        const isOpen = openSections.has(section);
        const sectionColor = SECTION_COLORS[section] || 'bg-gray-500';
        
        return (
          <Collapsible key={section} open={isOpen} onOpenChange={() => toggleSection(section)}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-4 h-auto hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${sectionColor}`} />
                  <span className="text-lg font-semibold">{section}</span>
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
