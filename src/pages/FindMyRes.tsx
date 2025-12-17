import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, DollarSign, Users, Search, SlidersHorizontal, Star, Building2, Bed, Ruler, ShieldCheck, Heart, Scale, MessageCircle } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import FavoriteButton from "@/components/FavoriteButton";
import CompareButton from "@/components/CompareButton";
import CompareDrawer from "@/components/CompareDrawer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { RESKONNECT_WHATSAPP } from "@/lib/constants";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

const MAX_COMPARE = 3;

const FindMyRes = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const navigate = useNavigate();
  if (shouldBlock) return null;
  const { profile } = useRealtimeProfile(user);
  const { applications } = useRealtimeApplications(user);
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareList, setCompareList] = useState<any[]>([]);
  
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

  const toggleCompare = (residence: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (compareList.find(r => r.id === residence.id)) {
      setCompareList(prev => prev.filter(r => r.id !== residence.id));
    } else if (compareList.length < MAX_COMPARE) {
      setCompareList(prev => [...prev, residence]);
    } else {
      toast.error(`Maximum ${MAX_COMPARE} residences can be compared`);
    }
  };

  const trustedPartners = [
    { id: 'west-end-residency', name: 'West End Residency', location: '11 President Steyn Street, Pretoria West', image: '/placeholder.svg', rating: 4.8, verified: true },
    { id: 'study-haven', name: 'Study Haven', location: '29 Carl Street, Pretoria West', image: '/placeholder.svg', rating: 4.9, verified: true },
    { id: 'ekhaya-junction', name: 'Ekhaya Junction', location: '41 Justice Mahomed Street, Sunnyside', image: '/placeholder.svg', rating: 4.7, verified: true },
    { id: 'campus-lodge', name: 'Campus Lodge', location: '115 Walker Street, Sunnyside', image: '/placeholder.svg', rating: 4.6, verified: true },
    { id: 'future-heights', name: 'Future Heights', location: '28 Klapper Street, Danville', image: '/placeholder.svg', rating: 4.8, verified: true },
    { id: 'urban-hub', name: 'Urban Hub', location: '44 Van der Hoff Road, Pretoria West', image: '/placeholder.svg', rating: 4.5, verified: true },
  ];

  useEffect(() => {
    const fetchResidences = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('residences').select('*');
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

    useEffect(() => {
    if (!residences.length && !loading) return;

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
    
    // Set featured residences (can be a separate logic, here using first few from all residences)
    if (residences.length > 0) {
        setFeaturedResidences(residences.slice(0,5));
    }

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
    toast.success("Filters reset successfully!");
  };

  const amenitiesList = ["WiFi", "Parking", "Security", "Study Room", "Laundry", "Gym", "Pool", "Kitchen"];

  const SkeletonCard = () => (
    <Card className="overflow-hidden animate-pulse">
        <div className="flex flex-col md:flex-row">
            <div className="md:w-1/3 h-48 md:h-auto bg-gray-300"></div>
            <CardContent className="flex-1 p-4 sm:p-6">
                <div className="space-y-4">
                    <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-300 rounded w-full"></div>
                    <div className="flex gap-2 pt-4">
                        <div className="h-8 bg-gray-300 rounded w-24"></div>
                        <div className="h-8 bg-gray-300 rounded w-24"></div>
                    </div>
                </div>
            </CardContent>
        </div>
    </Card>
  );

  const residenceListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Student Residences",
    "itemListElement": filteredResidences.map((residence, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `https://reskonnect.co.za/res/${residence.id}`
    }))
  };

  return (
    <DashboardLayout>
      <SEO
        title="Find Student Accommodation Near TUT | 360+ Verified Residences | ResKonnect"
        description="Browse and apply to 360+ verified student residences near TUT campuses in Pretoria West, Arcadia, and Soshanguve. NSFAS approved options available."
        keywords="TUT accommodation, Pretoria West student res, verified student housing, NSFAS residence"
      />
      <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/">Home</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbLink>Residences</BreadcrumbLink>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
        </div>
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">Find Your Perfect Residence</h1>
              <p className="text-muted-foreground text-md sm:text-lg">
                Browse 360+ verified accommodations across Pretoria & Tshwane
              </p>
            </div>
            <div className={`sticky top-0 z-40 bg-background/80 backdrop-blur-lg rounded-lg shadow-lg p-4 sm:p-6`}>
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
                    variant={showFilters ? "default" : "outline"}
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
                          <SelectTrigger className={priceRange ? "border-primary" : ""}><SelectValue placeholder="Any price" /></SelectTrigger>
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
                          <SelectTrigger className={distanceRange ? "border-primary" : ""}><SelectValue placeholder="Any distance" /></SelectTrigger>
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
                          <SelectTrigger className={roomType ? "border-primary" : ""}><SelectValue placeholder="Any type" /></SelectTrigger>
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
                          <SelectTrigger className={campus !== "all" ? "border-primary" : ""}><SelectValue placeholder="All campuses" /></SelectTrigger>
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
              </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-primary flex-shrink-0" />
                    <div>
                        <h2 className="text-2xl font-bold">Related Residences</h2>
                        <p className="text-muted-foreground">Other students also viewed these.</p>
                    </div>
                </div>
            </div>
            <div className="flex space-x-6 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto snap-x snap-mandatory">
                {featuredResidences.filter(res => res.image_url).map((res, index) => (
                    <TooltipProvider key={index}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card className="min-w-[280px] sm:min-w-[300px] flex-shrink-0 overflow-hidden group cursor-pointer snap-center transform transition-transform hover:scale-105" onClick={() => handleViewDetails(res)}>
                                    <div className="relative h-40 sm:h-48">
                                        <img 
                                          src={res.image_url || "/placeholder.svg"} 
                                          alt={res.name} 
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            const target = e.currentTarget as HTMLImageElement;
                                            target.src = "/placeholder.svg";
                                          }}
                                        />
                                        <Badge className="absolute top-3 right-3 bg-yellow-400 text-blue-900 font-bold flex items-center gap-1">
                                            <ShieldCheck className="w-4 h-4" /> Trusted Landlord
                                        </Badge>
                                    </div>
                                    <CardContent className="p-4">
                                        <h3 className="font-semibold text-lg truncate">{res.name}</h3>
                                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                                            <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                                            <span className="truncate">{res.address}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{res.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ))}
            </div>
            <Separator className="my-8 sm:my-12" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold whitespace-nowrap">
              All Accommodations ({loading ? "..." : filteredResidences.length})
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
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
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
                <Link to={`/res/${residence.id}`} key={residence.id} className="block">
                <Card className="hover:shadow-md transition-shadow overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/3 h-48 md:h-auto flex-shrink-0 relative">
                      <img 
                        src={residence.image_url || "/placeholder.svg"} 
                        alt={residence.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.src = "/placeholder.svg";
                        }}
                      />
                      {/* Action buttons overlay */}
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        <FavoriteButton residenceId={residence.id} variant="icon" className="bg-background/80 backdrop-blur-sm" />
                        <CompareButton 
                          isSelected={!!compareList.find(r => r.id === residence.id)}
                          disabled={compareList.length >= MAX_COMPARE && !compareList.find(r => r.id === residence.id)}
                          onClick={(e) => toggleCompare(residence, e)}
                          className="bg-background/80 backdrop-blur-sm"
                        />
                        <WhatsAppButton phone={RESKONNECT_WHATSAPP} residenceName={residence.name} variant="icon" className="bg-background/80 backdrop-blur-sm" />
                      </div>
                    </div>
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
                              {residence.amenities.slice(0, 4).map((amenity: string) => (
                                <Badge key={amenity} variant="outline" className="text-xs">
                                  {amenity}
                                </Badge>
                              ))}
                              {residence.amenities.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{residence.amenities.length - 4} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 pt-4 mt-auto">
                          <Button variant="outline" className="w-full sm:w-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewDetails(residence);}}>View Details</Button>
                          <Button className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleApply(residence);}}>Apply Now</Button>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <Card className="bg-card/50">
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-2">Find Your Ideal Student Home</h3>
                    <p className="text-muted-foreground text-sm">
                    Search verified student residences across Pretoria, Johannesburg, Cape Town, Durban, and more. Each listing includes amenities, pricing, images, and landlord information to help you make an informed decision. ResKonnect is committed to providing a seamless and secure platform for students to find and apply for accommodation. Our verification process ensures that all residences meet our high standards for safety and quality.
                    </p>
                </CardContent>
            </Card>
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
                                <img 
                                  src={selectedResidence.image_url || "/placeholder.svg"} 
                                  alt={selectedResidence.name} 
                                  className="w-full h-56 object-cover"
                                  onError={(e) => {
                                    const target = e.currentTarget as HTMLImageElement;
                                    target.src = "/placeholder.svg";
                                  }}
                                />
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
      
      <CompareDrawer 
        compareList={compareList}
        onRemove={(id) => setCompareList(prev => prev.filter(r => r.id !== id))}
        onClear={() => setCompareList([])}
      />
    </DashboardLayout>
  );
};

export default FindMyRes;
