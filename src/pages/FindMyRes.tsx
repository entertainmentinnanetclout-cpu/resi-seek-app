import SEO from "@/components/SEO";
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Users, Search, SlidersHorizontal, Building2, Bed, ShieldCheck, ChevronDown, ChevronUp, LayoutGrid, List, ArrowUpDown } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import TrustedResidencesGrid from "@/components/TrustedResidencesGrid";
import ResidenceSectionGrid from "@/components/ResidenceSectionGrid";
import { RESKONNECT_WHATSAPP } from "@/lib/constants";


const MAX_COMPARE = 3;

// Section categories for filtering
const SECTION_TABS = [
  { value: "all", label: "All" },
  { value: "Soshanguve", label: "Soshanguve" },
  { value: "Pretoria West", label: "Pretoria West" },
  { value: "Arcadia", label: "Arcadia" },
  { value: "Arts", label: "Arts" },
  { value: "Ga-Rankuwa", label: "Ga-Rankuwa" },
  { value: "ARLC", label: "ARLC" },
  { value: "Other", label: "Other" },
];

// Sorting options
const SORT_OPTIONS = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "distance", label: "Nearest First" },
  { value: "availability", label: "Most Available" },
  { value: "newest", label: "Newest First" },
];

// Derive section from campus or section_category
function deriveSection(residence: any): string {
  if (residence.section_category) return residence.section_category;
  
  const campus = residence.campus?.toLowerCase() || '';
  if (campus.includes('soshanguve')) return 'Soshanguve';
  if (campus.includes('arts')) return 'Arts';
  if (campus.includes('arcadia')) return 'Arcadia';
  if (campus.includes('pretoria west') || campus.includes('pretoria-west')) return 'Pretoria West';
  if (campus.includes('ga-rankuwa') || campus.includes('garankuwa')) return 'Ga-Rankuwa';
  if (campus.includes('polokwane')) return 'Polokwane';
  if (campus.includes('mbombela') || campus.includes('nelspruit')) return 'Mbombela';
  if (campus.includes('emalahleni') || campus.includes('witbank')) return 'eMalahleni';
  
  return 'Other';
}

const FindMyRes = () => {
  // ALL hooks must be called unconditionally before any early returns
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile } = useRealtimeProfile(user);
  const { applications } = useRealtimeApplications(user);
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareList, setCompareList] = useState<any[]>([]);
  const [isListOpen, setIsListOpen] = useState(false);
  const [showFirstVisitModal, setShowFirstVisitModal] = useState(false);
  const [showFloatingBar, setShowFloatingBar] = useState(false);
  
  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'sections' | 'list'>('sections');
  const [sectionFilter, setSectionFilter] = useState("all");
  const [sortBy, setSortBy] = useState("price-asc");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState<string>("");
  const [distanceRange, setDistanceRange] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [campus, setCampus] = useState<string>("all");

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

  // First-visit CTA modal
  useEffect(() => {
    if (!user) {
      const visited = localStorage.getItem('reskonnect_visited');
      if (!visited) {
        const timer = setTimeout(() => setShowFirstVisitModal(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  // Floating bar on scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowFloatingBar(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchResidences = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('residences').select('*');
        if (error) throw error;
        
        const safeData = (data || []).map(r => ({
          ...r,
          verification_level: r.verification_level || 'basic',
          province: r.province || 'Gauteng',
          distance_from_campus: r.distance_from_campus || 0,
          featured: r.featured || false,
          display_order: r.display_order || 0,
        }));
        
        setResidences(safeData);
      } catch (error) {
        console.error('[FindMyRes] Error:', error);
        toast.error('Failed to load residences.');
      } finally {
        setLoading(false);
      }
    };

    fetchResidences();
  }, []);

  // Enhanced filtering with section support
  const filteredAndSortedResidences = useMemo(() => {
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

    // Section filter (new)
    if (sectionFilter && sectionFilter !== "all") {
      filtered = filtered.filter(r => deriveSection(r) === sectionFilter);
    }

    if (selectedAmenities.length > 0) {
      filtered = filtered.filter(r => 
        selectedAmenities.every(amenity => r.amenities?.includes(amenity))
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-desc':
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'distance':
        filtered.sort((a, b) => (a.distance_from_campus || 999) - (b.distance_from_campus || 999));
        break;
      case 'availability':
        filtered.sort((a, b) => (b.available_spots || 0) - (a.available_spots || 0));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
    }
    
    return filtered;
  }, [residences, searchQuery, priceRange, distanceRange, roomType, selectedAmenities, campus, sectionFilter, sortBy]);

  // Keep filteredResidences for backward compatibility
  const filteredResidences = filteredAndSortedResidences;

  // Early return AFTER all hooks are called (React rules of hooks)
  if (shouldBlock) return null;

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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={sectionFilter} onValueChange={setSectionFilter}>
                        <SelectTrigger className={sectionFilter !== "all" ? "border-primary" : ""}><SelectValue placeholder="All types" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="FLATS">Flats</SelectItem>
                          <SelectItem value="COMMUNES">Communes</SelectItem>
                          <SelectItem value="RENTALS">Rentals</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
          {/* Trusted Residences Grid - Top 30 in 3 rows of 10 */}
          <TrustedResidencesGrid />

          <Separator className="my-8" />

          {/* Collapsible All Accommodations List */}
          <Collapsible open={isListOpen} onOpenChange={setIsListOpen}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="gap-2 text-left justify-start">
                  <Building2 className="w-5 h-5" />
                  <span className="text-lg font-bold">
                    All Accommodations ({loading ? "..." : filteredResidences.length}+)
                  </span>
                  {isListOpen ? <ChevronUp className="w-5 h-5 ml-2" /> : <ChevronDown className="w-5 h-5 ml-2" />}
                </Button>
              </CollapsibleTrigger>
              {isListOpen && (
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-48">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price-asc">Price: Low to High</SelectItem>
                    <SelectItem value="price-desc">Price: High to Low</SelectItem>
                    <SelectItem value="distance">Nearest First</SelectItem>
                    <SelectItem value="availability">Most Available</SelectItem>
                    <SelectItem value="newest">Newest First</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <CollapsibleContent>
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
                                   <Badge variant="secondary" className="mt-2 sm:mt-0">
                                    <ShieldCheck className="w-3 h-3 mr-1" />
                                    Verified
                                  </Badge>
                                  {residence.available_spots === 0 && (
                                    <Badge variant="destructive" className="mt-2 sm:mt-0 animate-pulse">
                                      FULL
                                    </Badge>
                                  )}
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
                                  {residence.room_types?.some((t: string) => t.toLowerCase().includes('single')) && (
                                    <Badge variant="outline" className="text-xs border-green-500 text-green-600">Singles Available</Badge>
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
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <Card className="bg-card/50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-2">Find Your Ideal Student Home</h3>
              <p className="text-muted-foreground text-sm">
                Search verified student residences across Pretoria, Johannesburg, Cape Town, Durban, and more. Each listing includes amenities, images, and contact information. ResKonnect is committed to providing a seamless and secure platform for students to find and apply for accommodation. Contact us at 0637323192 or reskonnect@gmail.com for assistance.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showApplicationModal} onOpenChange={setShowApplicationModal}>
        <DialogContent className="max-w-lg w-[90%]">
          <DialogHeader>
            <DialogTitle>Apply to {selectedResidence?.name}</DialogTitle>
            <DialogDescription>Submit your application now. ResKonnect will contact you at 0637323192 or reskonnect@gmail.com.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes for the application (Optional)</Label>
              <Textarea id="notes" placeholder="e.g. I am a first year student looking for a quiet place..." value={applicationNotes} onChange={(e) => setApplicationNotes(e.target.value)} />
            </div>
            <div className="flex items-start space-x-2">
              <Checkbox id="terms-apply" required />
              <Label htmlFor="terms-apply" className="text-sm text-muted-foreground leading-relaxed -mt-1">By submitting, I confirm that my profile information is up-to-date and I agree to be contacted by ResKonnect.</Label>
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
                    <div className="font-semibold">Available Spots: <span className="font-bold">{selectedResidence.available_spots || 0}/{selectedResidence.capacity}</span></div>
                    <div className="font-semibold">Distance: <span className="font-bold">{selectedResidence.distance_from_campus}km</span></div>
                    <div className="font-semibold">Room Type: <span className="font-bold capitalize">{selectedResidence.room_type}</span></div>
                    <div className="font-semibold">Contact: <span className="font-bold">0637323192</span></div>
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
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Contact ResKonnect</h4>
                    <p className="text-sm text-muted-foreground">Phone: 0637323192</p>
                    <p className="text-sm text-muted-foreground">Email: reskonnect@gmail.com</p>
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

      {/* First-Visit CTA Modal */}
      <Dialog open={showFirstVisitModal} onOpenChange={(open) => {
        setShowFirstVisitModal(open);
        if (!open) localStorage.setItem('reskonnect_visited', 'true');
      }}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl">Start Your Journey 🎓</DialogTitle>
            <DialogDescription className="text-base pt-2">
              Find verified student accommodation near TUT campuses. Create a free account to apply, save favorites, and get notified about new listings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full" onClick={() => { setShowFirstVisitModal(false); localStorage.setItem('reskonnect_visited', 'true'); navigate('/auth'); }}>
              Create Free Account
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { setShowFirstVisitModal(false); localStorage.setItem('reskonnect_visited', 'true'); }}>
              Browse First
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Bar (Mobile) */}
      {showFloatingBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur-lg border-t shadow-lg sm:hidden">
          <div className="flex gap-2 max-w-lg mx-auto">
            <Button className="flex-1" onClick={() => user ? navigate('/applications') : navigate('/auth')}>
              Apply Now
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <a href={`https://wa.me/${RESKONNECT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">
                WhatsApp Us
              </a>
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default FindMyRes;
