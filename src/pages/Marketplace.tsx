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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Plus, Search, Filter } from "lucide-react";

interface MarketplaceListing {
  id: string;
  item_name: string;
  description: string;
  price: number;
  condition: string;
  category: string;
  images: string[];
  created_at: string;
  profiles: {
    full_name: string;
    student_number: string | null;
  } | null;
}

const Marketplace = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [filteredListings, setFilteredListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    item_name: "",
    description: "",
    price: "",
    condition: "good",
    category: "books",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchProfile();
    fetchListings();
  }, []);

  useEffect(() => {
    filterListings();
  }, [listings, searchQuery, categoryFilter]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(data);
  };

  const fetchListings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("marketplace_listings")
      .select(`
        *,
        profiles (
          full_name,
          student_number
        )
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load listings");
    } else {
      setListings((data as any) || []);
    }
    setIsLoading(false);
  };

  const filterListings = () => {
    let filtered = listings;

    if (searchQuery) {
      filtered = filtered.filter(
        (listing) =>
          listing.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          listing.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((listing) => listing.category === categoryFilter);
    }

    setFilteredListings(filtered);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 3) {
      toast.error("Maximum 3 images allowed");
      return;
    }
    setSelectedFiles([...selectedFiles, ...files].slice(0, 3));
  };

  const uploadImages = async () => {
    if (!user || selectedFiles.length === 0) return [];

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    for (const file of selectedFiles) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from("marketplace")
        .upload(fileName, file);

      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("marketplace")
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    setUploadingImages(false);
    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.student_number) {
      toast.error("Please complete your student profile before listing items");
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    const imageUrls = await uploadImages();

    const { error } = await supabase.from("marketplace_listings").insert({
      user_id: user?.id,
      item_name: formData.item_name,
      description: formData.description,
      price: parseFloat(formData.price),
      condition: formData.condition,
      category: formData.category,
      images: imageUrls,
    });

    if (error) {
      toast.error("Failed to create listing");
    } else {
      toast.success("Listing created successfully!");
      setIsDialogOpen(false);
      setFormData({
        item_name: "",
        description: "",
        price: "",
        condition: "good",
        category: "books",
      });
      setSelectedFiles([]);
      fetchListings();
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold font-display mb-2">Student Marketplace</h1>
              <p className="text-muted-foreground">Buy and sell electronics, books, and study materials</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="premium" size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Create Listing
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Listing</DialogTitle>
                  <DialogDescription>
                    List your electronics, books, or study materials for sale
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="item_name">Item Name *</Label>
                    <Input
                      id="item_name"
                      value={formData.item_name}
                      onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="books">Books</SelectItem>
                        <SelectItem value="electronics">Electronics</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="price">Price (R) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="condition">Condition *</Label>
                    <Select
                      value={formData.condition}
                      onValueChange={(value) => setFormData({ ...formData, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="like_new">Like New</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="images">Images (Max 3) *</Label>
                    <Input
                      id="images"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                    />
                    {selectedFiles.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {selectedFiles.length} file(s) selected
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={uploadingImages}>
                    {uploadingImages ? "Uploading..." : "Create Listing"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filters */}
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="books">Books</SelectItem>
                      <SelectItem value="electronics">Electronics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Listings Grid */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading listings...</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-12 text-center">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No listings found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || categoryFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Be the first to create a listing!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((listing) => (
                <Card key={listing.id} className="shadow-card hover:shadow-premium transition-shadow overflow-hidden group">
                  {listing.images[0] && (
                    <div className="aspect-video overflow-hidden bg-muted">
                      <img
                        src={listing.images[0]}
                        alt={listing.item_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl">{listing.item_name}</CardTitle>
                      <Badge variant="secondary">{listing.category}</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {listing.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-primary">
                          R{listing.price.toFixed(2)}
                        </span>
                        <Badge variant="outline" className="capitalize">
                          {listing.condition.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Seller: {listing.profiles?.full_name || 'Unknown'}</p>
                        {listing.profiles?.student_number && (
                          <p className="text-xs">Student #: {listing.profiles.student_number}</p>
                        )}
                      </div>
                      <Button variant="default" className="w-full">
                        Contact Seller
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Marketplace;
