import { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, DollarSign, Users, Search, SlidersHorizontal, Star, Building2, Bed } from "lucide-react";
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
import { useVirtual } from "@tanstack/react-virtual";

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
  const [applicationNotes, setApplicationNotes] = useState("");

  // Fetch residences
  useEffect(() => {
    const fetchResidences = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("public_residences")
          .select("id, name, price, image_url, campus, amenities, featured, display_order, address, distance_from_campus, room_type, capacity, available_spots, contact_email, contact_phone, description");
        if (error) throw error;

        setResidences(data || []);

        const uniqueCampuses = [...new Set(data.map((r) => r.campus?.trim()))].filter(Boolean).sort();
        setCampusOptions(uniqueCampuses);
      } catch (error) {
        console.error("Error fetching residences:", error);
        toast.error("Failed to load residences.");
      } finally {
        setLoading(false);
      }
    };

    fetchResidences();

    const channel = supabase
      .channel("residences-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "residences" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setResidences((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setResidences((prev) => prev.map((r) => r.id === payload.new.id ? payload.new : r));
          } else if (payload.eventType === "DELETE") {
            setResidences((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Featured residences
  const featuredResidences = useMemo(() => {
    return residences
      .filter((r) => r.featured)
      .sort((a, b) => a.display_order - b.display_order)
      .slice(0, 5);
  }, [residences]);

  // Filtered residences
  const filteredResidences = useMemo(() => {
    let filtered = [...residences];

    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (priceRange) {
      const [min, max] = priceRange.split("-").map((v) => (v === "+" ? Infinity : parseFloat(v)));
      filtered = filtered.filter((r) => {
        const price = typeof r.price === "number" ? r.price : parseFloat(r.price?.replace(/[^0-9.-]+/g, "") || "0");
        return price >= min && price <= max;
      });
    }

    if (distanceRange && distanceRange !== "all") {
      const [min, max] = distanceRange.split("-").map((v) => (v === "+" ? Infinity : parseFloat(v)));
      filtered = filtered.filter((r) => {
        const distance = r.distance_from_campus || 0;
        return distance >= min && distance <= max;
      });
    }

    if (roomType && roomType !== "all") {
      filtered = filtered.filter((r) => r.room_type === roomType);
    }

    if (campus && campus !== "all") {
      filtered = filtered.filter((r) => r.campus === campus);
    }

    if (selectedAmenities.length > 0) {
      filtered = filtered.filter((r) => selectedAmenities.every((amenity) => r.amenities?.includes(amenity)));
    }

    return filtered;
  }, [residences, searchQuery, priceRange, distanceRange, roomType, selectedAmenities, campus]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtual({
    size: filteredResidences.length,
    parentRef,
    estimateSize: () => 320,
  });

  const handleApply = (residence: any) => {
    setSelectedResidence(residence);
    setShowApplicationModal(true);
  };

  const handleViewDetails = (residence: any) => {
    setSelectedResidence(residence);
    setShowDetailsModal(true);
  };

  const handleSubmitApplication = async () => {
    if (!selectedResidence) {
      toast.error("Please select a residence first.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to submit an application.");
        return;
      }

      // Check active applications limit
      const { data: activeApps } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["submitted", "approved"]);
      if ((activeApps || []).length >= 3) {
        toast.error("You can only have 3 active applications at a time.");
        return;
      }

      const { error } = await supabase.from("applications").insert({
        user_id: user.id,
        residence_id: selectedResidence.id,
        status: "submitted",
        notes: applicationNotes || "",
      });

      if (error) throw error;

      toast.success(`Application submitted for ${selectedResidence.name}!`);
      window.dispatchEvent(new Event("refreshApplications"));
      setApplicationNotes("");
    } catch (err: any) {
      console.error("Application submission error:", err);
      toast.error(err.message || "Error submitting application.");
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
        {/* Hero + Search */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
            <h1 className="text-4xl font-bold mb-3">Find Your Perfect Residence</h1>
            <p className="text-muted-foreground text-lg">Browse 400+ verified accommodations across Pretoria & Tshwane</p>

            <Card className="shadow-lg mt-8">
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
                  <Button variant="outline" size="lg" onClick={() => setShowFilters(!showFilters)} className="gap-2">
                    <SlidersHorizontal className="w-4 h-4" /> Filters
                  </Button>
                </div>

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
                            {campusOptions.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

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
                                  setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
                                }
                              }}
                            />
                            <label htmlFor={amenity} className="text-sm font-medium cursor-pointer">{amenity}</label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
                      <Button onClick={() => setShowFilters(false)}>Show {filteredResidences.length} Results</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Featured Residences */}
        {featuredResidences.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-2 mb-6">
              <Star className="w-6 h-6 text-primary fill-primary" />
              <h2 className="text-2xl font-bold">Top Priority Accommodations</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredResidences.map((res) => (
                <Card key={res.id} className="overflow-hidden hover:shadow-lg transition-all group">
                  {res.image_url && (
                    <div className="relative h-48 overflow-hidden">
                      <img src={res.image_url} alt={res.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      <Badge className="absolute top-3 right-3 bg-primary">Featured</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-lg">{res.name}</CardTitle>
                      <span className="text-lg font-bold text-primary">R{typeof res.price === 'number' ? res.price.toLocaleString() : res.price}</span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{res.address}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {res.amenities?.slice(0, 3).map((amenity: string) => (
                        <Badge key={amenity} variant="secondary" className="text-xs">{amenity}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => handleViewDetails(res)}>View Details</Button>
                      <Button className="flex-1" onClick={() => handleApply(res)}>Apply Now</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Separator className="my-12" />
          </div>
        )}

        {/* All Residences Virtualized */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">All Accommodations ({filteredResidences.length})</h2>
          </div>

          {loading ? (
            <div className="text-center py-12"><p className="text-muted-foreground">Loading accommodations...</p></div>
          ) : filteredResidences.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No accommodations found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your filters or search query</p>
                <Button onClick={resetFilters}>Reset Filters</Button>
              </CardContent>
            </Card>
          ) : (
            <div ref={parentRef} className="overflow-auto h-[70vh] relative">
              <div style={{ height: rowVirtualizer.totalSize, position: "relative" }}>
                {rowVirtualizer.virtualItems.map((virtualRow) => {
                  const res = filteredResidences[virtualRow.index];
                  return (
                    <div key={res.id} style={{ position: "absolute", top: virtualRow.start, width: "100%" }}>
                      <Card className="hover:shadow-md transition-shadow mb-4 flex flex-col md:flex-row">
                        <CardContent className="flex-1 p-6">
                          <div className="space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-xl font-bold mb-1">{res.name}</h3>
                                <div className="flex items-center text-sm text-muted-foreground gap-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{res.address}</span>
                                </div>
                              </div>
                              <span className="text-lg font-bold text-primary">R{typeof res.price === 'number' ? res.price.toLocaleString() : res.price}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {res.amenities?.slice(0, 3).map((amenity: string) => (
                                <Badge key={amenity} variant="secondary" className="text-xs">{amenity}</Badge>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" className="flex-1" onClick={() => handleViewDetails(res)}>View Details</Button>
                              <Button className="flex-1" onClick={() => handleApply(res)}>Apply Now</Button>
                            </div>
                          </div>
                        </CardContent>
                        {res.image_url && (
                          <div className="w-full md:w-48 h-48 overflow-hidden">
                            <img src={res.image_url} alt={res.name} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Application Modal */}
        <Dialog open={showApplicationModal} onOpenChange={setShowApplicationModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Apply for {selectedResidence?.name}</DialogTitle>
              <DialogDescription>Fill in your details and submit your application.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Any notes or requests..."
                value={applicationNotes}
                onChange={(e) => setApplicationNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowApplicationModal(false)}>Cancel</Button>
                <Button onClick={handleSubmitApplication}>Submit Application</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedResidence?.name}</DialogTitle>
            </DialogHeader>
            {selectedResidence?.image_url && (
              <img src={selectedResidence.image_url} alt={selectedResidence.name} className="w-full h-64 object-cover rounded-md mb-4" />
            )}
            <p className="mb-2">{selectedResidence?.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedResidence?.amenities?.map((amenity: string) => (
                <Badge key={amenity} variant="secondary" className="text-xs">{amenity}</Badge>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><strong>Price:</strong> R{selectedResidence?.price}</div>
              <div><strong>Room Type:</strong> {selectedResidence?.room_type}</div>
              <div><strong>Capacity:</strong> {selectedResidence?.capacity}</div>
              <div><strong>Available Spots:</strong> {selectedResidence?.available_spots}</div>
              <div><strong>Contact Email:</strong> {selectedResidence?.contact_email}</div>
              <div><strong>Contact Phone:</strong> {selectedResidence?.contact_phone}</div>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setShowDetailsModal(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default FindMyRes;
