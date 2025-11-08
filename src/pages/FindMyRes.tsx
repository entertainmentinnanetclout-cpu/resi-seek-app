import { useState, useEffect } from "react";
import { MapPin, DollarSign, Users, Search, SlidersHorizontal, Star, Building2, Bed, Ruler } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState<string>("");
  const [distanceRange, setDistanceRange] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [campus, setCampus] = useState<string>("all");
const [campusOptions, setCampusOptions] = useState<string[]>([]);
  
  // Filtered residences
  const [filteredResidences, setFilteredResidences] = useState<any[]>([]);
  const [featuredResidences, setFeaturedResidences] = useState<any[]>([]);

  // Application notes
  const [applicationNotes, setApplicationNotes] = useState("");

  useEffect(() => {
    const fetchResidences = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('public_residences').select('*');
        if (error) throw error;
        setResidences(data || []);
        // Extract unique campuses from residences
const uniqueCampuses = [...new Set(data.map((r) => r.campus?.trim()))]
  .filter(Boolean)
  .sort();
setCampusOptions(uniqueCampuses);

      } catch (error) {
        console.error('Error fetching residences:', error);
        toast.error('Failed to load residences.');
      } finally {
        setLoading(false);
      }
    };

    fetchResidences();

    // Subscribe to realtime changes
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
          console.log('Residence change detected:', payload);
          
          if (payload.eventType === 'INSERT') {
            setResidences(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setResidences(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          } else if (payload.eventType === 'DELETE') {
            setResidences(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!residences.length) return;

    // Separate featured residences
    const featured = residences.filter(r => r.featured).sort((a, b) => a.display_order - b.display_order).slice(0, 5);
    setFeaturedResidences(featured);

    // Apply filters
    let filtered = [...residences];

    // Search query
    if (searchQuery) {
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Price range
    if (priceRange) {
      const [min, max] = priceRange.split("-").map(v => v === "+" ? Infinity : parseFloat(v));
      filtered = filtered.filter(r => {
        const price = typeof r.price === 'number' ? r.price : parseFloat(r.price?.replace(/[^0-9.-]+/g, "") || "0");
        return price >= min && price <= max;
      });
    }

    // Distance
    if (distanceRange && distanceRange !== "all") {
      const [min, max] = distanceRange.split("-").map(v => v === "+" ? Infinity : parseFloat(v));
      filtered = filtered.filter(r => {
        const distance = r.distance_from_campus || 0;
        return distance >= min && distance <= max;
      });
    }

    // Room type
    if (roomType && roomType !== "all") {
      filtered = filtered.filter(r => r.room_type === roomType);
    }

    // Campus
    if (campus && campus !== "all") {
      filtered = filtered.filter(r => r.campus === campus);
    }

    // Amenities
    if (selectedAmenities.length > 0) {
      filtered = filtered.filter(r => 
        selectedAmenities.every(amenity => r.amenities?.includes(amenity))
      );
    }

    setFilteredResidences(filtered);
  }, [residences, searchQuery, priceRange, distanceRange, roomType, selectedAmenities, campus]);

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
        {/* Hero Search Section */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-3">Find Your Perfect Residence</h1>
              <p className="text-muted-foreground text-lg">
                Browse 400+ verified accommodations across Pretoria & Tshwane
              </p>
            </div>

            {/* Main Search Bar */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                      placeholder="Search by name, location, or description..."
                      className="pl-10 h-12 text-base"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={() => setShowFilters(!showFilters)}
                    className="gap-2"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                  </Button>
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                  <div className="mt-6 pt-6 border-t space-y-6">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Price Range</Label>
                        <Select value={priceRange} onValueChange={setPriceRange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Any price" />
                          </SelectTrigger>
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
                        <Label>Distance from Campus</Label>
                        <Select value={distanceRange} onValueChange={setDistanceRange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Any distance" />
                          </SelectTrigger>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Any type" />
                          </SelectTrigger>
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
  <SelectTrigger>
    <SelectValue placeholder="All campuses" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All campuses</SelectItem>
    {campusOptions.map((campusName) => (
      <SelectItem key={campusName} value={campusName}>
        {campusName}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
                      </div>
                    </div>

                    {/* Amenities */}
                    <div className="space-y-3">
                      <Label>Amenities</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {amenitiesList.map((amenity) => (
                          <div key={amenity} className="flex items-center space-x-2">
                            <Checkbox
                              id={amenity}
                              checked={selectedAmenities.includes(amenity)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedAmenities([...selectedAmenities, amenity]);
                                } else {
                                  setSelectedAmenities(selectedAmenities.filter(a => a !== amenity));
                                }
                              }}
                            />
                            <label
                              htmlFor={amenity}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {amenity}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={resetFilters}>
                        Reset Filters
                      </Button>
                      <Button onClick={() => setShowFilters(false)}>
                        Show {filteredResidences.length} Results
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Top Priority Accommodations */}
        {featuredResidences.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-2 mb-6">
              <Star className="w-6 h-6 text-primary fill-primary" />
              <h2 className="text-2xl font-bold">Top Priority Accommodations</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {featuredResidences.map((residence) => (
                <Card key={residence.id} className="overflow-hidden hover:shadow-lg transition-all group">
                  {residence.image_url && (
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={residence.image_url} 
                        alt={residence.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <Badge className="absolute top-3 right-3 bg-primary">
                        Featured
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-lg">{residence.name}</CardTitle>
                      <span className="text-lg font-bold text-primary">
                        R{typeof residence.price === 'number' ? residence.price.toLocaleString() : residence.price}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{residence.address}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {residence.amenities?.slice(0, 3).map((amenity: string) => (
                        <Badge key={amenity} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleViewDetails(residence)}
                      >
                        View Details
                      </Button>
                      <Button 
                        className="flex-1"
                        onClick={() => handleApply(residence)}
                      >
                        Apply Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Separator className="my-12" />
          </div>
        )}

        {/* All Accommodations List */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              All Accommodations ({filteredResidences.length})
            </h2>
            <Select defaultValue="price-asc">
              <SelectTrigger className="w-48">
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
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading accommodations...</p>
            </div>
          ) : filteredResidences.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No accommodations found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or search query
                </p>
                <Button onClick={resetFilters}>Reset Filters</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredResidences.map((residence) => (
                <Card key={residence.id} className="hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row">
                    <CardContent className="flex-1 p-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-xl font-bold mb-1">{residence.name}</h3>
                            <div className="flex items-center text-sm text-muted-foreground gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{residence.address}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              R{typeof residence.price === 'number' ? residence.price.toLocaleString() : residence.price}
                            </div>
                            <div className="text-xs text-muted-foreground">per month</div>
                          </div>
                        </div>

                        {residence.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {residence.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm">
                          {residence.distance_from_campus && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span>{residence.distance_from_campus}km from campus</span>
                            </div>
                          )}
                          {residence.room_type && (
                            <div className="flex items-center gap-1">
                              <Bed className="w-4 h-4 text-muted-foreground" />
                              <span className="capitalize">{residence.room_type}</span>
                            </div>
                          )}
                          {residence.capacity && (
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span>{residence.available_spots || 0} / {residence.capacity} spots available</span>
                            </div>
                          )}
                        </div>

                        {residence.amenities && residence.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {residence.amenities.slice(0, 5).map((amenity: string) => (
                              <Badge key={amenity} variant="outline" className="text-xs">
                                {amenity}
                              </Badge>
                            ))}
                            {residence.amenities.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{residence.amenities.length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline"
                            onClick={() => handleViewDetails(residence)}
                          >
                            View Details
                          </Button>
                          <Button 
                            onClick={() => handleApply(residence)}
                          >
                            Apply Now
                          </Button>
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

      {/* Application Modal */}
      <Dialog open={showApplicationModal} onOpenChange={setShowApplicationModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply for {selectedResidence?.name}</DialogTitle>
            <DialogDescription>
              Review your information and submit your application
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Profile Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium">{profile?.full_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{profile?.email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Student Number:</span>
                    <p className="font-medium">{profile?.student_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Year of Study:</span>
                    <p className="font-medium">{profile?.year_of_study}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Residence Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Residence Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">{selectedResidence?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedResidence?.address}</p>
                  </div>
                  <p className="text-xl font-bold text-primary">
                    R{typeof selectedResidence?.price === 'number' ? selectedResidence.price.toLocaleString() : selectedResidence?.price}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label>Additional Notes (Optional)</Label>
              <Textarea
                placeholder="Any special requests or information you'd like to share..."
                value={applicationNotes}
                onChange={(e) => setApplicationNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowApplicationModal(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={handleSubmitApplication}
              >
                Submit Application
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedResidence?.name}</DialogTitle>
            <DialogDescription>{selectedResidence?.address}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {selectedResidence?.image_url && (
              <div className="rounded-lg overflow-hidden">
                <img 
                  src={selectedResidence.image_url} 
                  alt={selectedResidence.name}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-semibold text-primary">
                      R{typeof selectedResidence?.price === 'number' ? selectedResidence.price.toLocaleString() : selectedResidence?.price}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capacity:</span>
                    <span>{selectedResidence?.capacity} students</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available:</span>
                    <span>{selectedResidence?.available_spots} spots</span>
                  </div>
                  {selectedResidence?.distance_from_campus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Distance:</span>
                      <span>{selectedResidence.distance_from_campus}km from campus</span>
                    </div>
                  )}
                  {selectedResidence?.room_type && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room Type:</span>
                      <span className="capitalize">{selectedResidence.room_type}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Contact</h4>
                <div className="space-y-2 text-sm">
                  {selectedResidence?.contact_email && (
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p>{selectedResidence.contact_email}</p>
                    </div>
                  )}
                  {selectedResidence?.contact_phone && (
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p>{selectedResidence.contact_phone}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedResidence?.description && (
              <div>
                <h4 className="font-semibold mb-3">Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedResidence.description}
                </p>
              </div>
            )}

            {selectedResidence?.amenities && selectedResidence.amenities.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedResidence.amenities.map((amenity: string) => (
                    <Badge key={amenity} variant="secondary">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
              <Button 
                className="flex-1"
                onClick={() => {
                  setShowDetailsModal(false);
                  handleApply(selectedResidence);
                }}
              >
                Apply Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default FindMyRes;
