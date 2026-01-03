import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Shield, Star, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Residence {
  id: string;
  name: string;
  address: string;
  image_url: string | null;
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
          .select('id, name, address, image_url, campus, available_spots, verification_level, province, display_order')
          .eq('is_trusted', true)
          .order('display_order', { ascending: true })
          .limit(30);

        if (error) throw error;

        const safeData = (data || []).map(r => ({
          ...r,
          verification_level: r.verification_level || 'basic',
          province: r.province || 'Gauteng',
        }));

        setResidences(safeData);
      } catch (err) {
        console.error('[TrustedResidencesGrid] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopResidences();
  }, []);

  const getVerificationBadge = (level: string | null) => {
    switch (level) {
      case 'trusted_partner':
        return <Badge className="bg-success text-success-foreground gap-1 text-xs"><Shield className="w-3 h-3" /> Trusted</Badge>;
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
          <Building2 className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">Top 30 Trusted Residences</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {[...Array(30)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-square bg-muted rounded-t-lg" />
              <CardContent className="p-2">
                <div className="h-3 bg-muted rounded w-3/4 mb-1" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Split into 3 rows of 10
  const rows = [
    residences.slice(0, 10),
    residences.slice(10, 20),
    residences.slice(20, 30),
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Top 30 Trusted Residences</h2>
          <p className="text-sm text-muted-foreground">Handpicked verified accommodations across South Africa</p>
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
            {row.map((residence) => (
              <Card
                key={residence.id}
                className="group overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105"
                onClick={() => navigate(`/res/${residence.id}`)}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <img
                    src={residence.image_url || '/placeholder.svg'}
                    alt={residence.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  <div className="absolute top-1 left-1">
                    {getVerificationBadge(residence.verification_level)}
                  </div>
                </div>
                <CardContent className="p-2">
                  <h3 className="font-medium text-xs truncate group-hover:text-primary transition-colors">
                    {residence.name}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">{residence.address?.split(',')[0]}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustedResidencesGrid;
