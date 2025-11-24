import { useState, useEffect } from "react";
import { MapPin, DollarSign, Users, Search, SlidersHorizontal, Star, Building2, Bed, Ruler, ShieldCheck } from "lucide-react";
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
  
  // Filtered residences
  const [filteredResidences, setFilteredResidences] = useState<any[]>([]);
  const [featuredResidences, setFeaturedResidences] = useState<any[]>([]);

  // Application notes
  const [applicationNotes, setApplicationNotes] = useState("");

  // DEMO DATA - Trusted Landlord Showcase
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
          console.log('Residence change detected:', payload);
          
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
    if (!residences.length) return;

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

                {showFilters && (
                  <div className="mt-6 pt-6 border-t space-y-6">
                    <div className="grid md:grid-cols-4 gap-4">
                      {/* Filter controls */}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Trusted Landlord Showcase */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-primary" />
                    <div>
                        <h2 className="text-2xl font-bold">Trusted Landlord Showcase</h2>
                        <p className="text-muted-foreground">Verified accommodation partners for safe and reliable student housing.</p>
                    </div>
                </div>
            </div>
            <div className="flex space-x-6 pb-4 overflow-x-auto">
                {trustedPartners.map((partner, index) => (
                    <Card key={index} className="min-w-[300px] flex-shrink-0 overflow-hidden group cursor-pointer">
                        <div className="relative h-48">
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
            <Separator className="my-12" />
        </div>

        {/* Top Priority Accommodations */}
        {featuredResidences.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Featured residences content */}
          </div>
        )}

        {/* All Accommodations List */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          {/* All residences content */}
        </div>
      </div>

      {/* Modals */}
    </DashboardLayout>
  );
};

export default FindMyRes;
