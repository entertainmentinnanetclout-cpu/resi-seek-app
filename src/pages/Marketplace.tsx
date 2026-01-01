import SEO from "@/components/SEO";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
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
import { Package, Plus, Search, Filter, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { StudentVerificationModal } from "@/components/StudentVerificationModal";
import { RESKONNECT_WHATSAPP_FORMATTED } from "@/lib/constants";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

const categories = ["Textbooks", "Study Notes", "Electronics", "Furniture", "Clothing", "Services", "Transport", "Other"];
const conditions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const Marketplace = () => {
  const shouldBlock = useAdminRedirect();
  if (shouldBlock) return null;
  const { user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [filteredListings, setFilteredListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    item_name: "",
    description: "",
    price: "",
    condition: "good",
    category: "Books"
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    fetchProfile();
    fetchListings();
    const channel = supabase
      .channel('marketplace-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_listings' }, () => fetchListings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    filterListings();
  }, [listings, searchQuery, categoryFilter]);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data);
  };

  const fetchListings = async () => {
    setIsLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("marketplace_listings")
      .select(`*, profiles:user_id (full_name, profile_picture_url)`)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Fetch error:", error);
      setFetchError(error.message);
      toast.error("Failed to load listings");
    } else {
      setListings(data || []);
    }
    setIsLoading(false);
  };

  const filterListings = () => {
    let filtered = listings;
    if (searchQuery) {
      filtered = filtered.filter(l => 
        l.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        l.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter(l => l.category === categoryFilter);
    }
    setFilteredListings(filtered);
  };

  const checkStudentVerification = () => {
    if (!profile?.student_number || !profile?.full_name || !profile?.campus) {
      setVerificationModalOpen(true);
      return false;
    }
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    
    // Create preview URLs
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!user || selectedFiles.length === 0) return [];
    
    const uploadedUrls: string[] = [];
    const totalFiles = selectedFiles.length;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error } = await supabase.storage
        .from('marketplace')
        .upload(filePath, file);

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload ${file.name}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('marketplace')
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
      setUploadProgress(((i + 1) / totalFiles) * 100);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.item_name || !formData.description || !formData.price) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Upload images first
      const imageUrls = await uploadImages();

      // Create listing
      const { error } = await supabase.from("marketplace_listings").insert({
        user_id: user.id,
        item_name: formData.item_name,
        description: formData.description,
        price: parseFloat(formData.price),
        condition: formData.condition,
        category: formData.category,
        images: imageUrls,
        status: "active",
        verified: false
      });

      if (error) throw error;

      toast.success("Listing created! It will be visible after verification.");
      setIsDialogOpen(false);
      setFormData({ item_name: "", description: "", price: "", condition: "good", category: "Books" });
      setSelectedFiles([]);
      setPreviewUrls([]);
      fetchListings();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Failed to create listing");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleContactSeller = (listing: any) => {
    const message = encodeURIComponent(
      `Hi! I'm interested in your listing "${listing.item_name}" on ResKonnect Marketplace for R${listing.price}. Is it still available?`
    );
    window.open(`https://wa.me/${RESKONNECT_WHATSAPP_FORMATTED}?text=${message}`, '_blank');
  };

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
                  <Button 
                    size="lg" 
                    className="gap-2 w-full sm:w-auto flex-shrink-0" 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      if (checkStudentVerification()) setIsDialogOpen(true); 
                    }}
                  >
                    <Plus className="w-5 h-5" /> Create Listing
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg w-[95%] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Listing</DialogTitle>
                    <DialogDescription>
                      List your item for sale. Add photos and details to attract buyers.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {/* Image Upload */}
                    <div className="space-y-2">
                      <Label>Photos (up to 5)</Label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        multiple
                        className="hidden"
                      />
                      <div className="flex flex-wrap gap-2">
                        {previewUrls.map((url, index) => (
                          <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {selectedFiles.length < 5 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary transition-colors"
                          >
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Add</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="item_name">Item Name *</Label>
                      <Input
                        id="item_name"
                        value={formData.item_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                        placeholder="e.g., Calculus Textbook 3rd Edition"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Price (ZAR) *</Label>
                        <Input
                          id="price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="150"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Condition</Label>
                        <Select 
                          value={formData.condition} 
                          onValueChange={(v) => setFormData(prev => ({ ...prev, condition: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {conditions.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe your item, including any wear or defects..."
                        rows={3}
                        required
                      />
                    </div>

                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress} />
                        <p className="text-xs text-muted-foreground text-center">Uploading images...</p>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Listing"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input 
                      placeholder="Search items..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      className="pl-10 h-11" 
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px]">
                      <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
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
            ) : fetchError ? (
              <Card className="shadow-sm border-destructive">
                <CardContent className="py-8 text-center">
                  <p className="text-destructive mb-4">Failed to load listings: {fetchError}</p>
                  <Button onClick={fetchListings} variant="outline">
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : filteredListings.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No listings found</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    {searchQuery || categoryFilter !== "all" 
                      ? "Try adjusting your search or filters." 
                      : "Be the first to create a listing!"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredListings.map((listing) => (
                  <Card 
                    key={listing.id} 
                    className="shadow-sm hover:shadow-lg transition-shadow overflow-hidden group flex flex-col card-3d"
                  >
                    <div className="aspect-video overflow-hidden bg-muted relative">
                      {listing.images && listing.images[0] ? (
                        <img 
                          src={listing.images[0]} 
                          alt={listing.item_name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      {!listing.verified && listing.user_id === user?.id && (
                        <Badge className="absolute top-2 right-2 bg-warning text-warning-foreground">
                          Pending Review
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg leading-tight line-clamp-2 flex-1">
                            {listing.item_name}
                          </CardTitle>
                          <Badge variant="secondary" className="whitespace-nowrap">
                            {listing.category}
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold text-primary mt-2">
                          R{listing.price.toFixed(2)}
                        </p>
                        <CardDescription className="text-xs mt-1 text-muted-foreground line-clamp-2">
                          {listing.description}
                        </CardDescription>
                        <CardDescription className="text-xs mt-2 text-muted-foreground">
                          Seller: {listing.profiles?.full_name || 'Student'}
                        </CardDescription>
                      </div>
                      <Button 
                        variant="default" 
                        className="w-full mt-4"
                        onClick={() => handleContactSeller(listing)}
                      >
                        Contact Seller
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>

      <StudentVerificationModal 
        open={verificationModalOpen} 
        onClose={() => setVerificationModalOpen(false)} 
        onVerified={() => { fetchProfile(); setVerificationModalOpen(false); }} 
        currentProfile={profile} 
      />
    </>
  );
};

export default Marketplace;
