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
}

const TrustedLandlordsSection = () => {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTopResidences = async () => {
      try {
        const { data, error } = await supabase
          .from('residences')
          .select('id, name, address, price, image_url, campus, verification_level, available_spots')
          .order('display_order', { ascending: true })
          .limit(30);

        if (error) throw error;
        setResidences(data || []);
      } catch (err) {
        console.error('Error fetching residences:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopResidences();
  }, []);

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

  const provinces = [
    { name: 'Gauteng', count: 0 },
    { name: 'Western Cape', count: 0 },
    { name: 'KwaZulu-Natal', count: 0 },
    { name: 'Eastern Cape', count: 0 },
    { name: 'Free State', count: 0 },
    { name: 'Limpopo', count: 0 },
    { name: 'Mpumalanga', count: 0 },
    { name: 'North West', count: 0 },
    { name: 'Northern Cape', count: 0 },
  ];

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

        {/* Province tags */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {provinces.map((province) => (
            <Badge
              key={province.name}
              variant="outline"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {province.name}
            </Badge>
          ))}
        </div>

        {/* Residences Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {residences.map((residence, index) => (
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
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                    #{index + 1}
                  </Badge>
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
