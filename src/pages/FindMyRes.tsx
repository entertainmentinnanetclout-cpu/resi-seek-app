import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Users, Search, SlidersHorizontal, ShieldCheck, Building2, Bed, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const FindMyRes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useRealtimeProfile(user);
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState<string>("");
  const [distanceRange, setDistanceRange] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [campus, setCampus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("price-asc");

  const [applicationNotes, setApplicationNotes] = useState("");

  const trustedPartners = [
    { name: 'West End Residency', location: '11 President Steyn Street, Pretoria West', image: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?q=80&w=800', rating: 4.8, verified: true },
    { name: 'Study Haven', location: '29 Carl Street, Pretoria West', image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=800', rating: 4.9, verified: true },
    { name: 'Ekhaya Junction', location: '41 Justice Mahomed Street, Sunnyside', image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?q=80&w=800', rating: 4.7, verified: true },
  ];

  const profileIsComplete = 
    profile?.full_name &&
    profile?.student_number &&
    profile?.phone &&
    profile?.campus &&
    profile?.course &&
    profile?.year_of_study;

  useEffect(() => {
    const fetchResidences = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('public_residences').select('*');
        if (error) throw error;
        setResidences(data || []);
      } catch (error) {
        console.error('Error fetching residences:', error);
        toast.error('Failed to load residences.');
      } finally {
        setLoading(false);
      }
    };
    fetchResidences();
  }, []);

  const sortedAndFilteredResidences = useMemo(() => {
    let filtered = [...residences];

    if (searchQuery) {
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.address?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (priceRange) {
      const [min, max] = priceRange.split("-").map(v => v === "+" ? Infinity : parseFloat(v));
      filtered = filtered.filter(r => r.price >= min && r.price <= max);
    }

    if (distanceRange && distanceRange !== "all") {
      const [min, max] = distanceRange.split("-").map(v => v === "+" ? Infinity : parseFloat(v));
      filtered = filtered.filter(r => r.distance_from_campus >= min && r.distance_from_campus <= max);
    }
    
    if (roomType && roomType !== "all") filtered = filtered.filter(r => r.room_type === roomType);
    if (campus && campus !== "all") filtered = filtered.filter(r => r.campus === campus);
    if (selectedAmenities.length > 0) {
      filtered = filtered.filter(r => 
        selectedAmenities.every(amenity => r.amenities?.includes(amenity))
      );
    }

    // Sorting logic
    switch (sortBy) {
        case 'price-asc': filtered.sort((a, b) => a.price - b.price); break;
        case 'price-desc': filtered.sort((a, b) => b.price - a.price); break;
        case 'distance': filtered.sort((a, b) => a.distance_from_campus - b.distance_from_campus); break;
        case 'newest': filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
        default: break;
    }

    return filtered;
  }, [residences, searchQuery, priceRange, distanceRange, roomType, selectedAmenities, campus, sortBy]);

  const handleApply = (residence: any) => {
    if (!profileIsComplete) {
        toast.error("Please complete your profile before applying.", {
            action: { label: "Go to Profile", onClick: () => navigate("/dashboard/profile") },
        });
        return;
    }
    setSelectedResidence(residence);
    setShowApplicationModal(true);
  };

  const handleViewDetails = (residence: any) => {
    setSelectedResidence(residence);
    setShowDetailsModal(true);
  };

  const handleSubmitApplication = async () => {
    if (!selectedResidence || !user) return;
    try {
      const { error } = await supabase.from('applications').insert({ user_id: user.id, residence_id: selectedResidence.id, status: 'submitted', notes: applicationNotes });
      if (error) throw error;
      toast.success(`Application submitted for ${selectedResidence?.name}!`);
      setApplicationNotes("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setShowApplicationModal(false);
    }
  };

  const resetFilter = (filter: string) => {
      if (filter === 'search') setSearchQuery('');
      if (filter === 'price') setPriceRange('');
      if (filter === 'distance') setDistanceRange('');
      if (filter === 'room') setRoomType('');
      if (filter === 'campus') setCampus('all');
      if (filter === 'amenities') setSelectedAmenities([]);
  }

  const amenitiesList = ["WiFi", "Parking", "Security", "Study Room", "Laundry", "Gym", "Pool", "Kitchen"];

  const SkeletonCard = () => (
    <Card className="overflow-hidden animate-pulse" aria-hidden="true">
        <div className="flex flex-col md:flex-row">
            <div className="md:w-1/3 h-48 md:h-auto bg-muted"></div>
            <CardContent className="flex-1 p-4 sm:p-6"><div className="space-y-4"><div className="h-6 bg-muted-foreground/20 rounded w-3/4"></div><div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div><div className="h-4 bg-muted-foreground/20 rounded w-full"></div><div className="flex gap-2 pt-4"><div className="h-8 bg-muted-foreground/20 rounded w-24"></div><div className="h-8 bg-muted-foreground/20 rounded w-24"></div></div></div></CardContent>
        </div>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">Find Your Perfect Residence</h1>
              <p className="text-muted-foreground text-md sm:text-lg">Browse verified student accommodations across Pretoria.</p>
            </div>
            <div className={`sticky top-4 z-40 bg-card/80 backdrop-blur-lg rounded-lg shadow-lg p-4 sm:p-6 border`}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <label htmlFor="search-residences" className="sr-only">Search by name or location</label>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input id="search-residences" aria-label="Search by name or location" placeholder="Search by name, location..." className="pl-10 h-12 text-base w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                  <Button aria-controls="filter-panel" aria-expanded={showFilters} variant={showFilters ? "default" : "outline"} size="lg" onClick={() => setShowFilters(!showFilters)} className="gap-2 w-full sm:w-auto flex-shrink-0"><SlidersHorizontal className="w-4 h-4" /> Filters </Button>
                </div>
                <div id="filter-panel" className={`mt-6 pt-6 border-t space-y-6 ${!showFilters && 'hidden'}`}>
                  {/* Filter controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2"><Label htmlFor="price-range">Price Range</Label><Select value={priceRange} onValueChange={setPriceRange}><SelectTrigger id="price-range" aria-label="Filter by price" className={priceRange ? "border-primary" : ""}><SelectValue placeholder="Any price" /></SelectTrigger><SelectContent><SelectItem value="0-2500">Under R2,500</SelectItem><SelectItem value="2500-3500">R2,500 - R3,500</SelectItem><SelectItem value="3500-4500">R3,500 - R4,500</SelectItem><SelectItem value="4500-+">Above R4,500</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label htmlFor="distance-range">Distance</Label><Select value={distanceRange} onValueChange={setDistanceRange}><SelectTrigger id="distance-range" aria-label="Filter by distance" className={distanceRange ? "border-primary" : ""}><SelectValue placeholder="Any distance" /></SelectTrigger><SelectContent><SelectItem value="all">Any distance</SelectItem><SelectItem value="0-1">Under 1km</SelectItem><SelectItem value="1-2">1-2km</SelectItem><SelectItem value="2-5">2-5km</SelectItem><SelectItem value="5-+">5km+</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label htmlFor="room-type">Room Type</Label><Select value={roomType} onValueChange={setRoomType}><SelectTrigger id="room-type" aria-label="Filter by room type" className={roomType ? "border-primary" : ""}><SelectValue placeholder="Any type" /></SelectTrigger><SelectContent><SelectItem value="all">Any type</SelectItem><SelectItem value="single">Single</SelectItem><SelectItem value="shared">Shared</SelectItem><SelectItem value="apartment">Apartment</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label htmlFor="campus">Campus</Label><Select value={campus} onValueChange={setCampus}><SelectTrigger id="campus" aria-label="Filter by campus" className={campus !== 'all' ? "border-primary" : ""}><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Campuses</SelectItem><SelectItem value="Pretoria West (Main Campus)">Pretoria West</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="space-y-3"><Label>Amenities</Label><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{amenitiesList.map(a => <div key={a} className="flex items-center space-x-2"><Checkbox id={a} checked={selectedAmenities.includes(a)} onCheckedChange={c => {if(c){setSelectedAmenities([...selectedAmenities,a])}else{setSelectedAmenities(selectedAmenities.filter(am=>am!==a))}}} /><label htmlFor={a} className="text-sm font-medium cursor-pointer">{a}</label></div>)}</div></div>
                  <div className="flex flex-col sm:flex-row gap-3"><Button variant="ghost" onClick={() => { resetFilter('price'); resetFilter('distance'); resetFilter('room'); resetFilter('campus'); resetFilter('amenities'); }}>Clear Filters</Button><Button onClick={() => setShowFilters(false)}>Show {sortedAndFilteredResidences.length} Results</Button></div>
                </div>
                 <div className="flex flex-wrap gap-2 pt-4">
                    {searchQuery && <Badge variant="secondary" className="pl-2.5">Search: "{searchQuery}" <button onClick={() => resetFilter('search')} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="w-3 h-3"/></button></Badge>}
                    {priceRange && <Badge variant="secondary" className="pl-2.5 capitalize">Price <button onClick={() => resetFilter('price')} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="w-3 h-3"/></button></Badge>}
                    {distanceRange !== 'all' && distanceRange && <Badge variant="secondary" className="pl-2.5 capitalize">Distance <button onClick={() => resetFilter('distance')} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="w-3 h-3"/></button></Badge>}
                    {roomType !== 'all' && roomType && <Badge variant="secondary" className="pl-2.5 capitalize">{roomType} <button onClick={() => resetFilter('room')} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="w-3 h-3"/></button></Badge>}
                    {selectedAmenities.length > 0 && <Badge variant="secondary" className="pl-2.5">{selectedAmenities.length} Amenities <button onClick={() => resetFilter('amenities')} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="w-3 h-3"/></button></Badge>}
                </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-3 mb-6"><ShieldCheck className="w-8 h-8 text-primary shrink-0" /><div><h2 className="text-2xl font-bold">Trusted Landlord Showcase</h2><p className="text-muted-foreground">Verified partners for quality student housing.</p></div></div>
            <div className="flex space-x-6 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide">{trustedPartners.map((p, i) => <TooltipProvider key={i}><Tooltip><TooltipTrigger asChild><Card className="min-w-[280px] sm:min-w-[300px] shrink-0 overflow-hidden group cursor-pointer snap-center transform transition-transform hover:scale-105"><div className="relative h-48"><img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover" /><Badge className="absolute top-3 right-3 bg-yellow-400 text-blue-900 font-bold flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Trusted</Badge></div><CardContent className="p-4"><h3 className="font-semibold text-lg truncate">{p.name}</h3><div className="flex items-center text-sm text-muted-foreground mt-1"><MapPin className="w-4 h-4 mr-1 shrink-0" /><span className="truncate">{p.location}</span></div></CardContent></Card></TooltipTrigger><TooltipContent><p>{p.name} - Rating: {p.rating}/5</p></TooltipContent></Tooltip></TooltipProvider>)}</div>
            <Separator className="my-12" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold whitespace-nowrap">All Accommodations ({loading ? "..." : sortedAndFilteredResidences.length})</h2>
            <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger aria-label="Sort by" className="w-full sm:w-48"><SelectValue placeholder="Sort by" /></SelectTrigger><SelectContent><SelectItem value="price-asc">Price: Low to High</SelectItem><SelectItem value="price-desc">Price: High to Low</SelectItem><SelectItem value="distance">Distance: Closest</SelectItem><SelectItem value="newest">Newest First</SelectItem></SelectContent></Select>
          </div>

          {loading ? (
            <div className="space-y-4">{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : sortedAndFilteredResidences.length === 0 ? (
            <Card><CardContent className="text-center p-12"><Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h3 className="text-xl font-semibold mb-2">No Accommodations Found</h3><p className="text-muted-foreground mb-4">Try adjusting your filters or search query.</p><Button onClick={() => {resetFilter('search'); resetFilter('price'); resetFilter('distance'); resetFilter('room'); resetFilter('campus'); resetFilter('amenities');}}>Clear All Filters</Button></CardContent></Card>
          ) : (
            <div className="space-y-4">{sortedAndFilteredResidences.map(r => <Card key={r.id} className="hover:shadow-md transition-shadow overflow-hidden"><div className="flex flex-col md:flex-row"><div className="md:w-1/3 h-48 md:h-auto shrink-0"><img src={r.image_url} alt={r.name} loading="lazy" className="w-full h-full object-cover"/></div><CardContent className="flex-1 p-6"><div className="flex flex-col justify-between h-full"><div><div className="flex flex-col sm:flex-row justify-between items-start mb-2"><div className="pr-4"><h3 className="text-xl font-bold mb-1">{r.name}</h3><div className="flex items-center text-sm text-muted-foreground gap-1"><MapPin className="w-4 h-4 shrink-0" /><span>{r.address}</span></div></div><div className="text-left sm:text-right mt-2 sm:mt-0 shrink-0"><div className="text-2xl font-bold text-primary">R{r.price.toLocaleString()}</div><div className="text-xs text-muted-foreground">/ month</div></div></div><p className="text-sm text-muted-foreground line-clamp-2 mt-2">{r.description}</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-sm mt-4"><div className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{r.distance_from_campus}km</span></div><div className="flex items-center gap-1"><Bed className="w-4 h-4 text-muted-foreground" /><span className="capitalize">{r.room_type}</span></div><div className="flex items-center gap-1"><Users className="w-4 h-4 text-muted-foreground" /><span>{r.available_spots || 0} / {r.capacity} spots</span></div></div>{r.amenities?.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{r.amenities.slice(0, 4).map((a:string) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}{r.amenities.length > 4 && <Badge variant="outline" className="text-xs">+{r.amenities.length - 4} more</Badge>}</div>}</div><div className="flex flex-col sm:flex-row gap-2 pt-4 mt-auto"><Button variant="outline" className="w-full sm:w-auto" onClick={() => handleViewDetails(r)}>View Details</Button><Button className="w-full sm:w-auto" onClick={() => handleApply(r)}>Apply Now</Button></div></div></CardContent></div></Card>)}</div>
          )}
        </div>
      </div>

      <Dialog open={showApplicationModal} onOpenChange={setShowApplicationModal}><DialogContent className="max-w-lg w-[90%]"><DialogHeader><DialogTitle>Apply to {selectedResidence?.name}</DialogTitle><DialogDescription>A residence representative will contact you.</DialogDescription></DialogHeader><div className="py-4 space-y-4"><div className="space-y-2"><Label htmlFor="notes">Notes for Landlord (Optional)</Label><Textarea id="notes" placeholder="e.g. I am a first year student looking for a quiet place..." value={applicationNotes} onChange={(e) => setApplicationNotes(e.target.value)} /></div><div className="flex items-start space-x-2"><Checkbox id="terms-apply" required /><Label htmlFor="terms-apply" className="text-sm text-muted-foreground -mt-1">By submitting, I confirm my profile is up-to-date and agree to be contacted.</Label></div></div><DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmitApplication}>Submit Application</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}><DialogContent className="max-w-3xl w-[90%] max-h-[90vh] overflow-y-auto">{selectedResidence && (<><DialogHeader className="pb-4"><DialogTitle className="text-2xl">{selectedResidence.name}</DialogTitle><DialogDescription className="flex items-center gap-1 pt-1"><MapPin className="w-4 h-4" /> {selectedResidence.address}</DialogDescription></DialogHeader><div className="grid md:grid-cols-2 gap-6"><div className="space-y-4"><div className="rounded-lg overflow-hidden border"><img src={selectedResidence.image_url} alt={selectedResidence.name} loading="lazy" className="w-full h-56 object-cover" /></div><div className="grid grid-cols-2 gap-4 text-sm"><div className="font-semibold">Price: <span className="font-bold text-primary text-base">R{selectedResidence.price.toLocaleString()}</span></div><div className="font-semibold">Spots: <span className="font-bold">{selectedResidence.available_spots||0}/{selectedResidence.capacity}</span></div><div className="font-semibold">Distance: <span className="font-bold">{selectedResidence.distance_from_campus}km</span></div><div className="font-semibold">Room: <span className="font-bold capitalize">{selectedResidence.room_type}</span></div></div></div><div className="space-y-4"><div><h4 className="font-semibold text-lg mb-2">Description</h4><p className="text-muted-foreground text-sm">{selectedResidence.description}</p></div><div><h4 className="font-semibold text-lg mb-2">Amenities</h4>{selectedResidence.amenities?.length > 0 ? <div className="flex flex-wrap gap-2">{selectedResidence.amenities.map((a:string) => <Badge key={a} variant="outline">{a}</Badge>)}</div> : <p className="text-sm text-muted-foreground">No amenities listed.</p>}</div></div></div><DialogFooter className="pt-6"><Button className="w-full sm:w-auto" onClick={() => { setShowDetailsModal(false); handleApply(selectedResidence); }}>Apply Now</Button></DialogFooter></>)}</DialogContent></Dialog>
    </DashboardLayout>
  );
};

export default FindMyRes;
