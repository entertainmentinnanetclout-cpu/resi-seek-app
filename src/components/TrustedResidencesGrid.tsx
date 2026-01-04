import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Shield, Star, Building2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import ResidenceImageSlideshow from './ResidenceImageSlideshow';

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
}

const TrustedResidencesGrid = () => {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTopResidences = async () => {
      try {
        const { data, error } = await supabase
          .from('residences')
          .select('id, name, address, image_url, images, campus, available_spots, verification_level, province, display_order')
          .eq('is_trusted', true)
          .order('display_order', { ascending: true })
          .limit(30);

        if (error) throw error;

        const safeData = (data || []).map(r => ({
          ...r,
          verification_level: r.verification_level || 'basic',
          province: r.province || 'Gauteng',
          images: r.images || [],
        }));

        setResidences(safeData);
      } catch (err) {
        console.error('[TrustedResidencesGrid] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopResidences();

    // Realtime subscription
    const channel = supabase
      .channel('trusted-residences')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residences' }, () => {
        fetchTopResidences();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Top 30 Trusted Residences</h2>
            <p className="text-sm text-muted-foreground">Handpicked verified accommodations</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse overflow-hidden">
              <div className="aspect-[16/10] bg-muted" />
              <CardContent className="p-4">
                <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
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

      {/* Cards Grid - Much larger cards for better visibility */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {residences.map((residence, index) => (
          <Card
            key={residence.id}
            className="group overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-border/50 hover:border-primary/40 relative"
            onClick={() => navigate(`/res/${residence.id}`)}
          >
            {/* Rank Badge */}
            {index < 3 && (
              <div className="absolute top-3 right-3 z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${
                  index === 0 ? 'bg-yellow-500 text-yellow-950' :
                  index === 1 ? 'bg-gray-300 text-gray-800' :
                  'bg-amber-600 text-amber-50'
                }`}>
                  #{index + 1}
                </div>
              </div>
            )}
            
            {/* Image Container with Slideshow */}
            <div className="relative aspect-[16/10] overflow-hidden bg-muted">
              <ResidenceImageSlideshow
                mainImage={residence.image_url}
                images={residence.images}
                alt={residence.name}
                autoPlay={true}
                interval={3000}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
              
              {/* Verification badge */}
              <div className="absolute top-3 left-3 z-10 pointer-events-none">
                {getVerificationBadge(residence.verification_level)}
              </div>
              
              {/* Bottom overlay info */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none">
                <h3 className="font-bold text-lg sm:text-xl truncate mb-1 drop-shadow-lg">
                  {residence.name}
                </h3>
                <p className="text-sm flex items-center gap-1.5 text-white/90 drop-shadow-md">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{(residence.address ?? '').split(',')[0] || 'Location TBA'}</span>
                </p>
              </div>
            </div>
            
            {/* Content footer */}
            <CardContent className="p-4 flex items-center justify-between gap-2">
              {residence.campus && (
                <Badge variant="secondary" className="text-xs">
                  {residence.campus}
                </Badge>
              )}
              {residence.available_spots > 0 && (
                <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                  {residence.available_spots} spots left
                </Badge>
              )}
              {!residence.campus && residence.available_spots <= 0 && (
                <span className="text-xs text-muted-foreground">View details →</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TrustedResidencesGrid;
