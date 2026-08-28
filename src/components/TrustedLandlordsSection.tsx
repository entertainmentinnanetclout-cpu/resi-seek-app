import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Star, Shield, ArrowRight, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import ResidencePosterDownloadButton from '@/components/findmyres/ResidencePosterDownloadButton';

interface Residence {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  image_url: string | null;
  cover_image_url: string | null;
  images: string[] | null;
  campus: string | null;
  province: string | null;
  city: string | null;
  place_label: string | null;
  verification_level: string | null;
  available_spots: number;
  capacity: number | null;
  price: number | null;
  private_price: number | null;
  nsfas_price: number | null;
  promo_price: number | null;
  room_type: string | null;
  room_types: string[] | null;
  amenities: unknown;
  has_wifi: boolean | null;
  has_parking: boolean | null;
  is_furnished: boolean | null;
  utilities_included: boolean | null;
  accepts_nsfas: boolean | null;
  accepts_private: boolean | null;
  accepts_tvet: boolean | null;
  accepts_university: boolean | null;
  reservations_2027_open: boolean | null;
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
        const { data, error } = await supabase
          .from('residences')
          .select('id, slug, name, address, price, private_price, nsfas_price, promo_price, image_url, cover_image_url, images, campus, province, city, place_label, available_spots, capacity, verification_level, display_order, room_type, room_types, amenities, has_wifi, has_parking, is_furnished, utilities_included, accepts_nsfas, accepts_private, accepts_tvet, accepts_university, reservations_2027_open')
          .order('display_order', { ascending: true })
          .limit(30);
        if (error) throw error;
        const safeData = (data || []).map((r) => ({ ...r, verification_level: r.verification_level || 'basic', province: r.province || 'South Africa' })) as Residence[];
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
    setFilteredResidences(selectedProvince === 'all' ? residences : residences.filter((r) => r.province === selectedProvince));
  }, [selectedProvince, residences]);

  const getVerificationBadge = (level: string | null) => {
    switch (level) {
      case 'trusted_partner': return <Badge className="bg-success text-success-foreground gap-1"><Shield className="w-3 h-3" /> Trusted Partner</Badge>;
      case 'premium': return <Badge className="bg-primary text-primary-foreground gap-1"><Star className="w-3 h-3" /> Premium</Badge>;
      case 'verified': return <Badge variant="secondary" className="gap-1"><Shield className="w-3 h-3" /> Verified</Badge>;
      default: return null;
    }
  };

  const provinceCounts = residences.reduce<Record<string, number>>((counts, residence) => {
    const province = residence.province || 'South Africa';
    counts.all = (counts.all || 0) + 1;
    counts[province] = (counts[province] || 0) + 1;
    return counts;
  }, { all: 0 });

  if (loading) {
    return <section className="py-16 md:py-24"><div className="container mx-auto px-4"><div className="h-72 animate-pulse rounded-2xl bg-muted" /></div></section>;
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-card/30 to-background py-16 md:py-24">
      <div className="container relative z-10 mx-auto px-4">
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-4 px-4 py-1"><Building2 className="mr-2 h-4 w-4" />Accommodation Network</Badge>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Top 30 Trusted Residences</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">Browse accommodation and download a ready-to-share 4K branded poster from every listing card.</p>
        </div>

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {provinces.map((province) => (
            <Badge key={province.value} variant={selectedProvince === province.value ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedProvince(province.value)}>
              {province.name}{provinceCounts[province.value] > 0 && <span className="ml-1 text-xs opacity-70">({provinceCounts[province.value]})</span>}
            </Badge>
          ))}
        </div>

        {filteredResidences.length === 0 ? (
          <div className="py-12 text-center"><Building2 className="mx-auto mb-4 h-16 w-16 text-muted-foreground" /><h3 className="text-xl font-semibold">No residences in this province yet</h3></div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredResidences.map((residence) => {
              const preview = residence.cover_image_url || residence.images?.[0] || residence.image_url || '/placeholder.svg';
              return (
                <Card key={residence.id} className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-hover" onClick={() => navigate(`/find-my-res/${residence.slug || residence.id}`)}>
                  <div className="relative h-40 overflow-hidden bg-muted">
                    <img src={preview} alt={residence.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
                    <div className="absolute left-2 top-2">{getVerificationBadge(residence.verification_level)}</div>
                    <div className="absolute right-2 top-2 z-20"><ResidencePosterDownloadButton residence={residence} compact /></div>
                    {residence.province && <Badge variant="secondary" className="absolute bottom-2 left-2 bg-background/90 text-xs backdrop-blur-sm">{residence.province}</Badge>}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="mb-1 truncate font-semibold text-foreground">{residence.name}</h3>
                    <p className="mb-2 flex items-center gap-1 truncate text-sm text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{residence.address}</p>
                    <Badge variant="outline" className={residence.available_spots > 0 ? 'border-success/30 text-success' : 'text-muted-foreground'}>{residence.available_spots > 0 ? `${residence.available_spots} spots` : 'Check availability'}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center"><Button size="lg" onClick={() => navigate('/find')} className="gap-2">View All Residences<ArrowRight className="h-4 w-4" /></Button></div>
      </div>
    </section>
  );
};

export default TrustedLandlordsSection;
