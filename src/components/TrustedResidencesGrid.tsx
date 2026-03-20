import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Shield, Star, Building2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import ResidenceImageSlideshow from './ResidenceImageSlideshow';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Residence {
  id: string;
  name: string;
  address: string;
  image_url: string | null;
  images: string[] | null;
  campus: string | null;
  verification_level: string | null;
  available_spots: number;
  province: string | null;
  section_category: string | null;
  room_types: string[] | null;
}

interface SectionConfig {
  key: string;
  label: string;
  subtitle: string;
}

const SECTIONS: SectionConfig[] = [
  { key: 'FLATS', label: 'FLATS', subtitle: 'PRETORIA WEST, CBD, ETC' },
  { key: 'COMMUNES', label: 'COMMUNES', subtitle: 'PRETORIA WEST, ETC' },
  { key: 'RENTALS', label: 'RENTALS', subtitle: 'SUNNYSIDE, SOSHA, E1' },
];

const TrustedResidencesGrid = () => {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ FLATS: true, COMMUNES: true, RENTALS: true });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTopResidences = async () => {
      try {
        const { data, error } = await supabase
          .from('residences')
          .select('id, name, address, image_url, images, campus, available_spots, verification_level, province, display_order, section_category, room_types')
          .eq('is_trusted', true)
          .order('display_order', { ascending: true })
          .limit(30);

        if (error) throw error;

        setResidences((data || []).map(r => ({
          ...r,
          verification_level: r.verification_level || 'basic',
          province: r.province || 'Gauteng',
          images: r.images || [],
          section_category: r.section_category || 'FLATS',
          room_types: r.room_types || [],
        })));
      } catch (err) {
        console.error('[TrustedResidencesGrid] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopResidences();

    const channel = supabase
      .channel('trusted-residences')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residences' }, () => {
        fetchTopResidences();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getVerificationBadge = (level: string | null) => {
    switch (level) {
      case 'trusted_partner':
        return <Badge className="bg-success text-success-foreground gap-1 text-xs"><Shield className="w-3 h-3" /> Trusted Partner</Badge>;
      case 'premium':
        return <Badge className="bg-primary text-primary-foreground gap-1 text-xs"><Star className="w-3 h-3" /> Premium</Badge>;
      case 'verified':
        return <Badge variant="secondary" className="gap-1 text-xs"><Shield className="w-3 h-3" /> Verified</Badge>;
      default:
        return null;
    }
  };

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="mb-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Top 30 Trusted Residences</h2>
            <p className="text-sm text-muted-foreground">Handpicked verified accommodations</p>
          </div>
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-10 bg-muted rounded-lg mb-3" />
            <div className="flex gap-4 overflow-hidden">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="min-w-[260px] h-48 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (residences.length === 0) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Top 30 Trusted Residences</h2>
            <p className="text-sm text-muted-foreground">Coming soon...</p>
          </div>
        </div>
        <Card className="p-8 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Trusted residences will appear here once configured.</p>
        </Card>
      </div>
    );
  }

  // Group residences by section_category
  const grouped: Record<string, Residence[]> = {};
  for (const section of SECTIONS) {
    grouped[section.key] = residences.filter(r => (r.section_category || 'FLATS').toUpperCase() === section.key);
  }
  // Uncategorized go into FLATS
  const categorized = new Set(Object.values(grouped).flat().map(r => r.id));
  const uncategorized = residences.filter(r => !categorized.has(r.id));
  if (uncategorized.length > 0) {
    grouped['FLATS'] = [...(grouped['FLATS'] || []), ...uncategorized];
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Top 30 Trusted Residences</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Handpicked & verified by ResKonnect</p>
          </div>
        </div>
        <Badge variant="outline" className="hidden sm:flex gap-1 px-3 py-1">
          <Shield className="w-3.5 h-3.5" />
          {residences.length} Verified
        </Badge>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const sectionResidences = grouped[section.key] || [];
          if (sectionResidences.length === 0) return null;
          const isOpen = openSections[section.key];

          return (
            <Collapsible key={section.key} open={isOpen} onOpenChange={() => toggleSection(section.key)}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base tracking-wide">
                      {section.label} — {section.subtitle}
                    </span>
                    <Badge variant="secondary" className="text-xs bg-primary-foreground/20 text-primary-foreground border-0">
                      {sectionResidences.length}
                    </Badge>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-destructive" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-destructive" />
                  )}
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="flex gap-4 overflow-x-auto py-4 pb-2 scrollbar-thin scrollbar-thumb-muted">
                  {sectionResidences.map((residence, index) => (
                    <Card
                      key={residence.id}
                      className="group min-w-[260px] max-w-[280px] flex-shrink-0 overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border-border/50 hover:border-primary/40 relative"
                      onClick={() => navigate(`/res/${residence.id}`)}
                    >
                      {/* Rank Badge for top 3 overall */}
                      {residences.indexOf(residence) < 3 && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${
                            residences.indexOf(residence) === 0 ? 'bg-yellow-500 text-yellow-950' :
                            residences.indexOf(residence) === 1 ? 'bg-gray-300 text-gray-800' :
                            'bg-amber-600 text-amber-50'
                          }`}>
                            #{residences.indexOf(residence) + 1}
                          </div>
                        </div>
                      )}

                      {/* Image */}
                      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                        <ResidenceImageSlideshow
                          mainImage={residence.image_url}
                          images={residence.images}
                          alt={residence.name}
                          autoPlay={true}
                          interval={3000}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

                        {/* Verification badge */}
                        <div className="absolute top-3 left-3 z-10 pointer-events-none">
                          {getVerificationBadge(residence.verification_level)}
                        </div>

                        {/* FULL badge */}
                        {residence.available_spots === 0 && (
                          <div className="absolute top-3 left-3 z-20 pointer-events-none" style={{ top: residence.verification_level && residence.verification_level !== 'basic' ? '40px' : '12px' }}>
                            <Badge variant="destructive" className="animate-pulse text-xs font-bold">
                              FULL
                            </Badge>
                          </div>
                        )}

                        {/* Bottom overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white pointer-events-none">
                          <h3 className="font-bold text-sm sm:text-base truncate mb-0.5 drop-shadow-lg">
                            {residence.name}
                          </h3>
                          <p className="text-xs flex items-center gap-1 text-white/90 drop-shadow-md">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{(residence.address ?? '').split(',')[0] || 'Location TBA'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Footer */}
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <div className="flex gap-1.5 flex-wrap">
                          {residence.campus && (
                            <Badge variant="secondary" className="text-[10px]">
                              {residence.campus}
                            </Badge>
                          )}
                          {residence.room_types?.some((t: string) => t.toLowerCase().includes('single')) && (
                            <Badge variant="outline" className="text-[10px] border-success text-success">
                              Singles
                            </Badge>
                          )}
                        </div>
                        {residence.available_spots > 0 ? (
                          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 whitespace-nowrap">
                            {residence.available_spots} spots
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">View →</span>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};

export default TrustedResidencesGrid;
