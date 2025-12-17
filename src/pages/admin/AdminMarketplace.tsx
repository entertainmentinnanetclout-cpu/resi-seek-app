import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Check, X, CheckCheck, XCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

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

  const bulkVerify = async () => {
    if (selectedIds.size === 0) {
      toast.error("No listings selected");
      return;
    }

    setBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ verified: true })
        .in("id", Array.from(selectedIds));

      if (error) throw error;
      toast.success(`${selectedIds.size} listings verified`);
      setSelectedIds(new Set());
      fetchListings();
    } catch (error) {
      console.error("Error bulk verifying listings:", error);
      toast.error("Failed to verify listings");
    } finally {
      setBulkProcessing(false);
    }
  };

  const bulkRemove = async () => {
    if (selectedIds.size === 0) {
      toast.error("No listings selected");
      return;
    }

    setBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ status: "removed" })
        .in("id", Array.from(selectedIds));

      if (error) throw error;
      toast.success(`${selectedIds.size} listings removed`);
      setSelectedIds(new Set());
      fetchListings();
    } catch (error) {
      console.error("Error bulk removing listings:", error);
      toast.error("Failed to remove listings");
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAllUnverified = () => {
    const unverifiedIds = filteredListings
      .filter(listing => !listing.verified && listing.status === "active")
      .map(listing => listing.id);
    setSelectedIds(new Set(unverifiedIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      listing.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.seller?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || listing.status === statusFilter;
    const matchesVerified = verifiedFilter === "all" || 
      (verifiedFilter === "verified" && listing.verified) ||
      (verifiedFilter === "unverified" && !listing.verified);
    return matchesSearch && matchesStatus && matchesVerified;
  });

  const unverifiedCount = filteredListings.filter(l => !l.verified && l.status === "active").length;

  return (
    <AdminLayout>
      <SEO title="Marketplace Moderation | Admin" description="Moderate marketplace listings" />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">Moderate and verify marketplace listings</p>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-medium">{selectedIds.size} selected</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={bulkVerify}
                    disabled={bulkProcessing}
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Verify All
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={bulkRemove}
                    disabled={bulkProcessing}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Remove All
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="removed">Removed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Verified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
              {unverifiedCount > 0 && (
                <Button variant="outline" onClick={selectAllUnverified}>
                  Select Unverified ({unverifiedCount})
                </Button>
              )}
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === unverifiedCount && selectedIds.size > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllUnverified();
                            } else {
                              clearSelection();
                            }
                          }}
                        />
                      </TableHead>
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
                      <TableRow key={listing.id} className={selectedIds.has(listing.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          {!listing.verified && listing.status === "active" && (
                            <Checkbox
                              checked={selectedIds.has(listing.id)}
                              onCheckedChange={() => toggleSelection(listing.id)}
                            />
                          )}
                        </TableCell>
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