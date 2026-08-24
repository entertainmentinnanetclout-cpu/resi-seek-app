import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Shield, Star, Building2, Sparkles, ChevronDown, ChevronRight, Search, SlidersHorizontal, WalletCards, Wifi, BedDouble } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import ResidenceImageSlideshow from './ResidenceImageSlideshow';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useResidenceSections } from '@/hooks/useResidenceSections';
import TumeloCareerPreview from '@/components/landing/TumeloCareerPreview';

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
  room_type: string | null;
  price: number | string | null;
  amenities: string[] | null;
  distance_from_campus: number | string | null;
}

const money = (value: Residence['price']) => {
  const amount = Number(value || 0);
  return amount > 0 ? `R${amount.toLocaleString('en-ZA')}` : 'Price on request';
};

const TrustedResidencesGrid = () => {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [campus, setCampus] = useState('all');
  const [roomType, setRoomType] = useState('all');
  const [amenity, setAmenity] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(true);
  const navigate = useNavigate();
  const { sections, loading: sectionsLoading } = useResidenceSections('trusted');

  useEffect(() => {
    if (sections.length > 0 && Object.keys(openSections).length === 0) {
      const initial: Record<string, boolean> = {};
      sections.slice(0, 3).forEach(s => { initial[s.slug] = true; });
      setOpenSections(initial);
    }
  }, [sections]);

  useEffect(() => {
    const fetchTopResidences = async () => {
      try {
        const { data, error } = await supabase
          .from('residences')
          .select('id, name, address, image_url, images, campus, available_spots, verification_level, province, display_order, section_category, room_types, room_type, price, amenities, distance_from_campus')
          .eq('is_trusted', true)
          .order('display_order', { ascending: true })
          .limit(30);
        if (error) throw error;
        setResidences((data || []).map((r: any) => ({
          ...r,
          verification_level: r.verification_level || 'basic',
          province: r.province || 'Gauteng',
          images: r.images || [],
          room_types: r.room_types || [],
          amenities: Array.isArray(r.amenities) ? r.amenities : [],
        })));
      } catch (err) {
        console.error('[TrustedResidencesGrid] Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopResidences();
    const channel = supabase.channel('trusted-residences').on('postgres_changes', { event: '*', schema: 'public', table: 'residences' }, fetchTopResidences).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const campuses = useMemo(() => [...new Set(residences.map(r => r.campus).filter(Boolean) as string[])].sort(), [residences]);
  const roomTypes = useMemo(() => [...new Set(residences.flatMap(r => [...(r.room_types || []), ...(r.room_type ? [r.room_type] : [])]))].sort(), [residences]);
  const amenities = useMemo(() => [...new Set(residences.flatMap(r => r.amenities || []))].sort().slice(0, 12), [residences]);

  const filtered = useMemo(() => residences.filter((r) => {
    const haystack = `${r.name} ${r.address} ${r.campus || ''} ${(r.amenities || []).join(' ')} ${(r.room_types || []).join(' ')} ${r.room_type || ''}`.toLowerCase();
    const rent = Number(r.price || 0);
    const rooms = [...(r.room_types || []), ...(r.room_type ? [r.room_type] : [])];
    return (!query || haystack.includes(query.toLowerCase()))
      && (!maxRent || rent === 0 || rent <= Number(maxRent))
      && (campus === 'all' || r.campus === campus)
      && (roomType === 'all' || rooms.some(v => v.toLowerCase().includes(roomType.toLowerCase())))
      && (amenity === 'all' || (r.amenities || []).some(v => v.toLowerCase() === amenity.toLowerCase()))
      && (!availableOnly || r.available_spots > 0);
  }), [residences, query, maxRent, campus, roomType, amenity, availableOnly]);

  const goToFullSearch = () => {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (maxRent) params.set('maxPrice', maxRent);
    if (campus !== 'all') params.set('campus', campus);
    if (roomType !== 'all') params.set('roomType', roomType);
    if (amenity !== 'all') params.set('amenity', amenity);
    if (availableOnly) params.set('available', 'true');
    navigate(`/find?${params.toString()}`);
  };

  const getVerificationBadge = (level: string | null) => {
    if (level === 'trusted_partner') return <Badge className="bg-success text-success-foreground gap-1 text-xs"><Shield className="w-3 h-3" /> Trusted Partner</Badge>;
    if (level === 'premium') return <Badge className="bg-primary text-primary-foreground gap-1 text-xs"><Star className="w-3 h-3" /> Premium</Badge>;
    if (level === 'verified') return <Badge variant="secondary" className="gap-1 text-xs"><Shield className="w-3 h-3" /> Verified</Badge>;
    return null;
  };

  if (loading || sectionsLoading) return <div className="mb-8 h-72 animate-pulse rounded-3xl bg-muted" />;

  const grouped: Record<string, Residence[]> = {};
  sections.forEach(section => { grouped[section.slug] = filtered.filter(r => (r.section_category || '').toUpperCase() === section.slug); });
  const categorizedIds = new Set(Object.values(grouped).flat().map(r => r.id));
  const uncategorized = filtered.filter(r => !categorizedIds.has(r.id));
  if (uncategorized.length && sections.length) grouped[sections[0].slug] = [...(grouped[sections[0].slug] || []), ...uncategorized];

  return (
    <>
      <div className="mb-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5"><Sparkles className="w-6 h-6 text-primary" /></div>
            <div><h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Find My Res · Top 30 Verified</h2><p className="text-sm sm:text-base text-muted-foreground">Search trusted accommodation before you leave the landing page.</p></div>
          </div>
          <Badge variant="outline" className="w-fit gap-1"><Shield className="w-3.5 h-3.5" /> {residences.length} verified listings</Badge>
        </div>

        <Card className="mb-6 overflow-hidden border-primary/20 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary" /><h3 className="font-bold">Search by your budget, campus and needs</h3></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Residence, area, campus, amenity..." /></div>
              <div className="relative"><WalletCards className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" type="number" min="0" step="100" value={maxRent} onChange={e => setMaxRent(e.target.value)} placeholder="Max rent / month" /></div>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={campus} onChange={e => setCampus(e.target.value)}><option value="all">Any campus</option>{campuses.map(v => <option key={v}>{v}</option>)}</select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={roomType} onChange={e => setRoomType(e.target.value)}><option value="all">Any room type</option>{roomTypes.map(v => <option key={v}>{v}</option>)}</select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={amenity} onChange={e => setAmenity(e.target.value)}><option value="all">Any amenity</option>{amenities.map(v => <option key={v}>{v}</option>)}</select>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[2500, 3000, 3500, 4000, 4500, 5500].map(amount => <Button key={amount} type="button" size="sm" variant={maxRent === String(amount) ? 'default' : 'outline'} onClick={() => setMaxRent(String(amount))}>≤ R{amount.toLocaleString()}</Button>)}
              <Button type="button" size="sm" variant={availableOnly ? 'default' : 'outline'} onClick={() => setAvailableOnly(v => !v)}>Available now</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setQuery(''); setMaxRent(''); setCampus('all'); setRoomType('all'); setAmenity('all'); setAvailableOnly(false); }}>Clear</Button>
              <span className="ml-auto text-xs font-medium text-muted-foreground">{filtered.length} matching</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button onClick={() => { setAmenity(amenities.find(a => a.toLowerCase().includes('wifi')) || 'all'); }} className="rounded-xl border p-3 text-left hover:border-primary/40"><Wifi className="mb-1 h-4 w-4 text-primary" /><span className="text-sm font-semibold">Wi-Fi friendly</span><p className="text-xs text-muted-foreground">Jump to listings with connectivity amenities.</p></button>
              <button onClick={() => setRoomType(roomTypes.find(r => r.toLowerCase().includes('single')) || 'all')} className="rounded-xl border p-3 text-left hover:border-primary/40"><BedDouble className="mb-1 h-4 w-4 text-primary" /><span className="text-sm font-semibold">Single rooms</span><p className="text-xs text-muted-foreground">Prioritize privacy and single-room options.</p></button>
              <button onClick={goToFullSearch} className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-left hover:bg-primary/10"><MapPin className="mb-1 h-4 w-4 text-primary" /><span className="text-sm font-semibold">Open advanced Find My Res</span><p className="text-xs text-muted-foreground">Use all filters and compare the full accommodation catalogue.</p></button>
            </div>
          </CardContent>
        </Card>

        {residences.length === 0 ? (
          <Card className="p-8 text-center"><Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Verified residences will appear here once configured.</p></Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center"><Search className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><h3 className="font-bold">No Top 30 residence matches these filters</h3><p className="mt-1 text-sm text-muted-foreground">Clear a filter or search the full ResKonnect accommodation catalogue.</p><Button className="mt-4" onClick={goToFullSearch}>Search all accommodation</Button></Card>
        ) : (
          <div className="space-y-4">
            {sections.map(section => {
              const sectionResidences = grouped[section.slug] || [];
              if (!sectionResidences.length) return null;
              const isOpen = openSections[section.slug] ?? false;
              return (
                <Collapsible key={section.id} open={isOpen} onOpenChange={() => setOpenSections(prev => ({ ...prev, [section.slug]: !prev[section.slug] }))}>
                  <CollapsibleTrigger asChild><button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${section.color}`} /><span className="font-bold text-sm sm:text-base">{section.name}{section.subtitle ? ` — ${section.subtitle}` : ''}</span><Badge variant="secondary" className="text-xs bg-primary-foreground/20 text-primary-foreground border-0">{sectionResidences.length}</Badge></div>{isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}</button></CollapsibleTrigger>
                  <CollapsibleContent><div className="flex gap-4 overflow-x-auto py-4 pb-2">
                    {sectionResidences.map(residence => (
                      <Card key={residence.id} className="group min-w-[270px] max-w-[290px] flex-shrink-0 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border-border/50 hover:border-primary/40" onClick={() => navigate(`/res/${residence.id}`)}>
                        <div className="relative aspect-[16/10] overflow-hidden bg-muted"><ResidenceImageSlideshow mainImage={residence.image_url} images={residence.images} alt={residence.name} autoPlay interval={3000} /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" /><div className="absolute top-3 left-3 z-10">{getVerificationBadge(residence.verification_level)}</div><div className="absolute bottom-0 left-0 right-0 p-3 text-white"><h3 className="font-bold truncate">{residence.name}</h3><p className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{(residence.address || '').split(',')[0] || 'Location TBA'}</p></div></div>
                        <CardContent className="p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-black text-primary">{money(residence.price)}<span className="text-[10px] font-medium text-muted-foreground"> /mo</span></p>{residence.distance_from_campus && <p className="text-[11px] text-muted-foreground">{residence.distance_from_campus} from campus</p>}</div><Badge variant={residence.available_spots > 0 ? 'outline' : 'secondary'} className="text-[10px]">{residence.available_spots > 0 ? `${residence.available_spots} spots` : 'View'}</Badge></div><div className="mt-2 flex flex-wrap gap-1">{residence.campus && <Badge variant="secondary" className="text-[10px]">{residence.campus}</Badge>}{(residence.room_types || []).slice(0, 1).map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}{(residence.amenities || []).slice(0, 2).map(a => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}</div></CardContent>
                      </Card>
                    ))}
                  </div></CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex justify-center"><Button size="lg" onClick={goToFullSearch} className="gap-2"><Search className="h-4 w-4" /> Search all accommodation with these filters</Button></div>
      </div>

      {/* Career & Education follows accommodation discovery so housing remains the primary landing-page task. */}
      <TumeloCareerPreview />
    </>
  );
};

export default TrustedResidencesGrid;
