import { useState, useEffect } from "react";
import { MapPin, DollarSign, Users, Search, SlidersHorizontal, Star, Building2, Bed, Ruler, ShieldCheck } from "lucide-react";
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
import { useRealtimeApplications } from "@/hooks/useRealtimeApplications";
import { supabase } from "@/integrations/supabase/client";

const FindMyRes = () => {
  const { user } = useAuth();
  const { profile } = useRealtimeProfile(user);
  const { applications } = useRealtimeApplications(user);
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState<string>("");
  const [distanceRange, setDistanceRange] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [campus, setCampus] = useState<string>("all");
  
  const [filteredResidences, setFilteredResidences] = useState<any[]>([]);
  const [featuredResidences, setFeaturedResidences] = useState<any[]>([]);

  const [applicationNotes, setApplicationNotes] = useState("");

  const trustedPartners = [
    { name: 'West End Residency', location: '11 President Steyn Street, Pretoria West', image: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?q=80&w=800' },
    { name: 'Study Haven', location: '29 Carl Street, Pretoria West', image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=800' },
    { name: 'Ekhaya Junction', location: '41 Justice Mahomed Street, Sunnyside', image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?q=80&w=800' },
    { name: 'Campus Lodge', location: '115 Walker Street, Sunnyside', image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?q=80&w=800' },
    { name: 'Future Heights', location: '28 Klapper Street, Danville', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800' },
    { name: 'Urban Hub', location: '44 Van der Hoff Road, Pretoria West', image: 'https://images.unsplash.com/photo-1576941089067-2de3c901e126?q=80&w=800' },
    { name: 'The Lofts', location: '56 Troye Street, Sunnyside', image: 'https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?q=80&w=800' },
    { name: 'Cedar Place', location: '68 Belvedere Street, Arcadia', image: 'https://images.unsplash.com/photo-1605276374104-5de67d609b8f?q=80&w=800' },
    { name: 'Kopano Court', location: '93 Hamilton Street, Arcadia', image: 'https://images.unsplash.com/photo-1598228723793-52759bba239c?q=80&w=800' },
    { name: 'Sunnyside Square', location: 'Corner Reitz & Leyds Street, Sunnyside', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=800' }
  ];

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

    const channel = supabase
      .channel('residences-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'residences'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setResidences(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setResidences(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          } else if (payload.eventType === 'DELETE') {
            setResidences(prev => prev.filter(r => r.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!residences.length && !loading) return;

    const featured = residences.filter(r => r.featured).sort((a, b) => a.display_order - b.display_order).slice(0, 5);
    setFeaturedResidences(featured);

    let filtered = [...residences];

    if (searchQuery) {
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (priceRange) {
      const [min, max] = priceRange.split("-").map(v => v === "+" ? Infinity : parseFloat(v));
      filtered = filtered.filter(r => {
        const price = typeof r.price === 'number' ? r.price : parseFloat(r.price?.replace(/[^0-9.-]+/g, "") || "0");
        return price >= min && price <= max;
      });
    }

    if (distanceRange && distanceRange !== "all") {
      const [min, max] = distanceRange.split("-").map(v => v === "+" ? Infinity : parseFloat(v));
      filtered = filtered.filter(r => {
        const distance = r.distance_from_campus || 0;
        return distance >= min && distance <= max;
      });
    }

    if (roomType && roomType !== "all") {
      filtered = filtered.filter(r => r.room_type === roomType);
    }

    if (campus && campus !== "all") {
      filtered = filtered.filter(r => r.campus === campus);
    }

    if (selectedAmenities.length > 0) {
      filtered = filtered.filter(r => 
        selectedAmenities.every(amenity => r.amenities?.includes(amenity))
      );
    }

    setFilteredResidences(filtered);
  }, [residences, searchQuery, priceRange, distanceRange, roomType, selectedAmenities, campus, loading]);

  const handleApply = (residence: any) => {
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
      const { error } = await supabase.from('applications').insert({
        user_id: user.id,
        residence_id: selectedResidence.id,
        status: 'submitted',
        notes: applicationNotes
      });
      if (error) throw error;
      toast.success(`Application submitted for ${selectedResidence?.name}!`);
      setApplicationNotes("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setShowApplicationModal(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setPriceRange("");
    setDistanceRange("");
    setRoomType("");
    setSelectedAmenities([]);
    setCampus("all");
  };

  const amenitiesList = ["WiFi", "Parking", "Security", "Study Room", "Laundry", "Gym", "Pool", "Kitchen"];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">Find Your Perfect Residence</h1>
              <p className="text-muted-foreground text-md sm:text-lg">
                Browse 400+ verified accommodations across Pretoria & Tshwane
              </p>
            </div>
            <Card className="shadow-lg">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                      placeholder="Search by name, location..."
                      className="pl-10 h-12 text-base w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={() => setShowFilters(!showFilters)}
                    className="gap-2 w-full sm:w-auto flex-shrink-0"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                  </Button>
                </div>
                {showFilters && (
                  <div className="mt-6 pt-6 border-t space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Price Range</Label>
                        <Select value={priceRange} onValueChange={setPriceRange}>
                          <SelectTrigger><SelectValue placeholder="Any price" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0-2500">Under R2,500</SelectItem>
                            <SelectItem value="2500-3500">R2,500 - R3,500</SelectItem>
                            <SelectItem value="3500-4500">R3,500 - R4,500</SelectItem>
                            <SelectItem value="4500-6000">R4,500 - R6,000</SelectItem>
                            <SelectItem value="6000-+">Above R6,000</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Distance</Label>
                        <Select value={distanceRange} onValueChange={setDistanceRange}>
                          <SelectTrigger><SelectValue placeholder="Any distance" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any distance</SelectItem>
                            <SelectItem value="0-1">Within 1km</SelectItem>
                            <SelectItem value="1-2">1-2km</SelectItem>
                            <SelectItem value="2-5">2-5km</SelectItem>
                            <SelectItem value="5-+">5km+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Room Type</Label>
                        <Select value={roomType} onValueChange={setRoomType}>
                          <SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any type</SelectItem>
                            <SelectItem value="single">Single Room</SelectItem>
                            <SelectItem value="shared">Shared Room</SelectItem>
                            <SelectItem value="apartment">Apartment</SelectItem>
                            <SelectItem value="studio">Studio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Campus</Label>
                        <Select value={campus} onValueChange={setCampus}>
                          <SelectTrigger><SelectValue placeholder="All campuses" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All campuses</SelectItem>
                            <SelectItem value="Pretoria West">Pretoria West (Main Campus)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label>Amenities</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {amenitiesList.map((amenity) => (
                          <div key={amenity} className="flex items-center space-x-2">
                            <Checkbox id={amenity} checked={selectedAmenities.includes(amenity)} onCheckedChange={(checked) => { if (checked) { setSelectedAmenities([...selectedAmenities, amenity]); } else { setSelectedAmenities(selectedAmenities.filter(a => a !== amenity)); } }} />
                            <label htmlFor={amenity} className="text-sm font-medium leading-none cursor-pointer">{amenity}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
                      <Button onClick={() => setShowFilters(false)}>Show {filteredResidences.length} Results</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-primary flex-shrink-0" />
                    <div>
                        <h2 className="text-2xl font-bold">Trusted Landlord Showcase</h2>
                        <p className="text-muted-foreground">Verified partners for safe student housing.</p>
                    </div>
                </div>
            </div>
            <div className="flex space-x-6 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto">
                {trustedPartners.map((partner, index) => (
                    <Card key={index} className="min-w-[280px] sm:min-w-[300px] flex-shrink-0 overflow-hidden group cursor-pointer">
                        <div className="relative h-40 sm:h-48">
                            <img src={partner.image} alt={partner.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <Badge className="absolute top-3 right-3 bg-yellow-400 text-blue-900 font-bold">Trusted Landlord</Badge>
                        </div>
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-lg truncate">{partner.name}</h3>
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                                <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">{partner.location}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Separator className="my-8 sm:my-12" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold whitespace-nowrap">
              All Accommodations ({filteredResidences.length})
            </h2>
            <Select defaultValue="price-asc">
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="distance">Distance</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-12"><p className="text-muted-foreground">Loading accommodations...</p></div>
          ) : filteredResidences.length === 0 ? (
            <Card>
              <CardContent className="text-center p-6 sm:py-12">
                <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No accommodations found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your filters or search query.</p>
                <Button onClick={resetFilters}>Reset Filters</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredResidences.map((residence) => (
                <Card key={residence.id} className="hover:shadow-md transition-shadow overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {residence.image_url && (
                        <div className="md:w-1/3 h-48 md:h-auto flex-shrink-0">
                            <img src={residence.image_url} alt={residence.name} className="w-full h-full object-cover"/>
                        </div>
                    )}
                    <CardContent className="flex-1 p-4 sm:p-6">
                      <div className="flex flex-col justify-between h-full">
                        <div>
                          <div className="flex flex-col sm:flex-row justify-between items-start mb-2">
                            <div className="pr-4">
                              <h3 className="text-xl font-bold mb-1">{residence.name}</h3>
                              <div className="flex items-center text-sm text-muted-foreground gap-1">
                                <MapPin className="w-4 h-4 flex-shrink-0" />
                                <span>{residence.address}</span>
                              </div>
                            </div>
                            <div className="text-left sm:text-right mt-2 sm:mt-0 flex-shrink-0">
                              <div className="text-2xl font-bold text-primary">R{typeof residence.price === 'number' ? residence.price.toLocaleString() : residence.price}</div>
                              <div className="text-xs text-muted-foreground">per month</div>
                            </div>
                          </div>
                          {residence.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                              {residence.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm mt-4">
                            {residence.distance_from_campus && (
                              <div className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{residence.distance_from_campus}km from campus</span></div>
                            )}
                            {residence.room_type && (
                              <div className="flex items-center gap-1"><Bed className="w-4 h-4 text-muted-foreground" /><span className="capitalize">{residence.room_type}</span></div>
                            )}
                            {residence.capacity && (
                              <div className="flex items-center gap-1"><Users className="w-4 h-4 text-muted-foreground" /><span>{residence.available_spots || 0} / {residence.capacity} spots</span></div>
                            )}
                          </div>
                          {residence.amenities && residence.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                              {residence.amenities.slice(0, 4).map((amenity: string) => (<Badge key={amenity} variant="outline" className="text-xs">{amenity}</Badge>))}
                              {residence.amenities.length > 4 && (<Badge variant="outline" className="text-xs">+{residence.amenities.length - 4} more</Badge>)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 pt-4 mt-auto">
                          <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleViewDetails(residence)}>View Details</Button>
                          <Button className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleApply(residence)}>Apply Now</Button>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showApplicationModal} onOpenChange={setShowApplicationModal}>
        <DialogContent className="max-w-lg w-[90%]">
          <DialogHeader>
            <DialogTitle>Apply to {selectedResidence?.name}</DialogTitle>
            <DialogDescription>Submit your application now. A residence representative will contact you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes for the landlord (Optional)</Label>
              <Textarea id="notes" placeholder="e.g. I am a first year student looking for a quiet place..." value={applicationNotes} onChange={(e) => setApplicationNotes(e.target.value)} />
            </div>
            <div className="flex items-start space-x-2">
              <Checkbox id="terms-apply" required />
              <Label htmlFor="terms-apply" className="text-sm text-muted-foreground leading-relaxed -mt-1">By submitting, I confirm that my profile information is up-to-date and I agree to be contacted by the residence manager.</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSubmitApplication}>Submit Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl w-[90%] max-h-[90vh] overflow-y-auto">
            {selectedResidence && (
                <>
                    <DialogHeader className="pb-4">
                        <DialogTitle className="text-2xl">{selectedResidence.name}</DialogTitle>
                        <DialogDescription className="flex items-center gap-1 pt-1">
                            <MapPin className="w-4 h-4" /> {selectedResidence.address}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="rounded-lg overflow-hidden border">
                                <img src={selectedResidence.image_url} alt={selectedResidence.name} className="w-full h-56 object-cover" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="font-semibold">Monthly Price: <span className="font-bold text-primary text-base">R{selectedResidence.price.toLocaleString()}</span></div>
                                <div className="font-semibold">Available Spots: <span className="font-bold">{selectedResidence.available_spots || 0}/{selectedResidence.capacity}</span></div>
                                <div className="font-semibold">Distance: <span className="font-bold">{selectedResidence.distance_from_campus}km</span></div>
                                <div className="font-semibold">Room Type: <span className="font-bold capitalize">{selectedResidence.room_type}</span></div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-lg mb-2">Description</h4>
                                <p className="text-muted-foreground text-sm">{selectedResidence.description}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-lg mb-2">Amenities</h4>
                                {selectedResidence.amenities && selectedResidence.amenities.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {selectedResidence.amenities.map((amenity: string) => <Badge key={amenity} variant="outline">{amenity}</Badge>)}
                                </div>
                                ) : <p className="text-sm text-muted-foreground">No amenities listed.</p>}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="pt-6">
                        <Button className="w-full sm:w-auto" onClick={() => { setShowDetailsModal(false); handleApply(selectedResidence); }}>Apply Now</Button>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default FindMyRes;
