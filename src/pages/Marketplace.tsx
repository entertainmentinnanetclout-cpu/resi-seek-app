import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Plus, Search, Filter } from "lucide-react";
import { StudentVerificationModal } from "@/components/StudentVerificationModal";
import { z } from "zod";

// ... (schema and interface definitions remain the same)

const Marketplace = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [filteredListings, setFilteredListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [formData, setFormData] = useState({ item_name: "", description: "", price: "", condition: "good", category: "Books" });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchProfile();
    fetchListings();
    const channel = supabase.channel('marketplace-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_listings' }, () => fetchListings()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    filterListings();
  }, [listings, searchQuery, categoryFilter]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data);
  };

  const fetchListings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("marketplace_listings").select(`*, profiles (*)`).eq("status", "active").or(`verified.eq.true,user_id.eq.${user?.id || ''}`).order("created_at", { ascending: false });
    if (error) toast.error("Failed to load listings");
    else setListings(data || []);
    setIsLoading(false);
  };

  const filterListings = () => {
    let filtered = listings.filter(l => l.profiles); // Ensure profile exists
    if (searchQuery) filtered = filtered.filter(l => l.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || l.description.toLowerCase().includes(searchQuery.toLowerCase()));
    if (categoryFilter !== "all") filtered = filtered.filter(l => l.category === categoryFilter);
    setFilteredListings(filtered);
  };

  const checkStudentVerification = () => {
    if (!profile?.student_number || !profile?.full_name || !profile?.campus) {
      setVerificationModalOpen(true);
      return false;
    }
    return true;
  };

  // ... (handleFileSelect and uploadImages remain mostly the same, focusing on logic)

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); /* ... */ };

  return (
    <>
      <DashboardLayout>
        <SEO
            title="Student Marketplace | Buy & Sell Used Goods"
            description="Find great deals on textbooks, electronics, and more from fellow students."
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold font-display">Student Marketplace</h1>
                <p className="text-muted-foreground mt-1">Buy and sell electronics, books, and study materials.</p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="gap-2 w-full sm:w-auto flex-shrink-0" onClick={(e) => { e.preventDefault(); if (checkStudentVerification()) setIsDialogOpen(true); }}>
                    <Plus className="w-5 h-5" /> Create Listing
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg w-[90%] max-h-[90vh] overflow-y-auto">{/* Form Content */}</DialogContent>
              </Dialog>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11" />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px]">
                      <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Books">Books</SelectItem>
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Study Materials">Study Materials</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading listings...</p>
              </div>
            ) : filteredListings.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No listings found</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">{searchQuery || categoryFilter !== "all" ? "Try adjusting your search or filters." : "Be the first to create a listing!"}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredListings.map((listing) => (
                  <Card key={listing.id} className="shadow-sm hover:shadow-lg transition-shadow overflow-hidden group flex flex-col">
                    {listing.images && listing.images[0] && (
                      <div className="aspect-video overflow-hidden bg-muted"><img src={listing.images[0]} alt={listing.item_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></div>
                    )}
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-lg leading-tight line-clamp-2 flex-1">{listing.item_name}</CardTitle>
                              <Badge variant="secondary" className="whitespace-nowrap">{listing.category}</Badge>
                          </div>
                          <p className="text-2xl font-bold text-primary mt-2">R{listing.price.toFixed(2)}</p>
                          <CardDescription className="text-xs mt-1 text-muted-foreground">Seller: {listing.profiles?.full_name || 'Unknown'}</CardDescription>
                      </div>
                      <Button variant="default" className="w-full mt-4">Contact Seller</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>

      <StudentVerificationModal open={verificationModalOpen} onClose={() => setVerificationModalOpen(false)} onVerified={() => { fetchProfile(); setVerificationModalOpen(false); }} currentProfile={profile} />
    </>
  );
};

export default Marketplace;
