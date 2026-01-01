import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Star, Shield, ArrowRight, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Residence {
  id: string;
  name: string;
  address: string;
  price: number;
  image_url: string | null;
  campus: string | null;
  verification_level: string | null;
  available_spots: number;
  province: string | null;
}

const provinces = [
  { name: 'All Provinces', value: 'all' },
  { name: 'Gauteng', value: 'Gauteng' },
  { name: 'Western Cape', value: 'Western Cape' },
  { name: 'KwaZulu-Natal', value: 'KwaZulu-Natal' },
  { name: 'Eastern Cape', value: 'Eastern Cape' },
  { name: 'Free State', value: 'Free State' },
  { name: 'Limpopo', value: 'Limpopo' },
  { name: 'Mpumalanga', value: 'Mpumalanga' },
  { name: 'North West', value: 'North West' },
  { name: 'Northern Cape', value: 'Northern Cape' },
];

const TrustedLandlordsSection = () => {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [filteredResidences, setFilteredResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTopResidences = async () => {
      try {
        console.log('[TrustedLandlordsSection] Fetching top residences...');
        
        // Select only columns that are guaranteed to exist
        const { data, error } = await supabase
          .from('residences')
          .select('id, name, address, price, image_url, campus, available_spots, verification_level, province, display_order')
          .order('display_order', { ascending: true })
          .limit(30);

        if (error) {
          console.error('[TrustedLandlordsSection] Fetch error:', error);
          throw error;
        }
        
        console.log(`[TrustedLandlordsSection] Fetched ${data?.length || 0} residences`);
        
        // Map data with null-safe access for optional columns
        const safeData = (data || []).map(r => ({
          ...r,
          verification_level: r.verification_level || 'basic',
          province: r.province || 'Gauteng',
          display_order: r.display_order || 0,
        }));
        
        setResidences(safeData);
        setFilteredResidences(safeData);
      } catch (err) {
        console.error('[TrustedLandlordsSection] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopResidences();
  }, []);

  useEffect(() => {
    if (selectedProvince === 'all') {
      setFilteredResidences(residences);
    } else {
      setFilteredResidences(residences.filter(r => r.province === selectedProvince));
    }
  }, [selectedProvince, residences]);

  const getVerificationBadge = (level: string | null) => {
    switch (level) {
      case 'trusted_partner':
        return <Badge className="bg-success text-success-foreground gap-1"><Shield className="w-3 h-3" /> Trusted Partner</Badge>;
      case 'premium':
        return <Badge className="bg-primary text-primary-foreground gap-1"><Star className="w-3 h-3" /> Premium</Badge>;
      case 'verified':
        return <Badge variant="secondary" className="gap-1"><Shield className="w-3 h-3" /> Verified</Badge>;
      default:
        return null;
    }
  };

  const getProvinceCounts = () => {
    const counts: Record<string, number> = { all: residences.length };
    residences.forEach(r => {
      const prov = r.province || 'Gauteng';
      counts[prov] = (counts[prov] || 0) + 1;
    });
    return counts;
  };

  const provinceCounts = getProvinceCounts();

  if (loading) {
    return (
      <section className="py-16 md:py-24 bg-gradient-to-b from-card/30 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Top 30 Trusted Residences</h2>
            <p className="text-muted-foreground">Loading our best accommodations across South Africa...</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-40 bg-muted rounded-t-lg" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-6 bg-muted rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-card/30 to-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 px-4 py-1">
            <Building2 className="w-4 h-4 mr-2" />
            Nationwide Coverage
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Top 30 Trusted Residences
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Verified student accommodations across South Africa, handpicked for quality, safety, and affordability.
          </p>
        </div>

        {/* Province filter tags */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {provinces.map((province) => (
            <Badge
              key={province.value}
              variant={selectedProvince === province.value ? "default" : "outline"}
              className={`cursor-pointer transition-all ${
                selectedProvince === province.value 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-primary/10'
              }`}
              onClick={() => setSelectedProvince(province.value)}
            >
              {province.name}
              {provinceCounts[province.value] > 0 && (
                <span className="ml-1 text-xs opacity-70">({provinceCounts[province.value] || 0})</span>
              )}
            </Badge>
          ))}
        </div>

        {/* Residences Grid */}
        {filteredResidences.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No residences in this province yet</h3>
            <p className="text-muted-foreground">Check back soon as we expand our listings!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredResidences.map((residence, index) => (
              <Card
                key={residence.id}
                className="group overflow-hidden card-3d hover:shadow-hover transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/res/${residence.id}`)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Image */}
                <div className="relative h-40 overflow-hidden bg-muted">
                  <img
                    src={residence.image_url || '/placeholder.svg'}
                    alt={residence.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  <div className="absolute top-2 left-2">
                    {getVerificationBadge(residence.verification_level)}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    {residence.province && (
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs">
                        {residence.province}
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground truncate mb-1 group-hover:text-primary transition-colors">
                    {residence.name}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {residence.address}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">
                      R{residence.price.toLocaleString()}
                      <span className="text-xs text-muted-foreground font-normal">/mo</span>
                    </span>
                    {residence.available_spots > 0 && (
                      <Badge variant="outline" className="text-success border-success/30">
                        {residence.available_spots} spots
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <Button
            size="lg"
            onClick={() => navigate('/find')}
            className="gap-2"
          >
            View All Residences
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TrustedLandlordsSection;
