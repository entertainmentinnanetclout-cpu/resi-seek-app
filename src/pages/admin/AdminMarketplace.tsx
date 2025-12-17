import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Check, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface MarketplaceListing {
  id: string;
  item_name: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  status: string;
  verified: boolean;
  created_at: string;
  user_id: string;
  images: string[];
  seller?: { full_name: string; email: string } | null;
}

const AdminMarketplace = () => {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchListings = async () => {
    try {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch seller info for each listing
      const listingsWithSellers = await Promise.all(
        (data || []).map(async (listing) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", listing.user_id)
            .maybeSingle();

          return { ...listing, seller: profile };
        })
      );

      setListings(listingsWithSellers);
    } catch (error) {
      console.error("Error fetching listings:", error);
      toast.error("Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const updateListing = async (id: string, updates: Partial<MarketplaceListing>) => {
    try {
      const { error } = await supabase
        .from("marketplace_listings")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      toast.success("Listing updated");
      fetchListings();
    } catch (error) {
      toast.error("Failed to update listing");
    }
  };

  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      listing.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.seller?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || listing.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout>
      <SEO title="Marketplace Moderation | Admin" description="Moderate marketplace listings" />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">Moderate and verify marketplace listings</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by item or seller..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="removed">Removed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredListings.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No listings found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredListings.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {listing.images?.[0] && (
                              <img
                                src={listing.images[0]}
                                alt={listing.item_name}
                                className="w-10 h-10 object-cover rounded"
                              />
                            )}
                            <div>
                              <p className="font-medium">{listing.item_name}</p>
                              <p className="text-xs text-muted-foreground">{listing.condition}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{listing.seller?.full_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{listing.seller?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>R{listing.price.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{listing.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={listing.status === "active" ? "default" : "outline"}>
                            {listing.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={listing.verified ? "default" : "destructive"}>
                            {listing.verified ? "Verified" : "Unverified"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!listing.verified && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => updateListing(listing.id, { verified: true })}
                              title="Verify listing"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          {listing.status === "active" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => updateListing(listing.id, { status: "removed" })}
                              title="Remove listing"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminMarketplace;
