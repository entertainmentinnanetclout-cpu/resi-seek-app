import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Plus, Package, Eye, Edit, Trash2, ExternalLink } from "lucide-react";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StoreData {
  id: string;
  store_name: string;
  store_description: string | null;
  store_logo_url: string | null;
  store_banner_url: string | null;
  campus: string | null;
  total_sales: number;
  rating: number;
  is_active: boolean;
}

interface Listing {
  id: string;
  item_name: string;
  price: number;
  images: string[];
  status: string;
  verified: boolean;
  created_at: string;
}

const MyStore = () => {
  const shouldBlock = useAdminRedirect();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState<StoreData | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteListingId, setDeleteListingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchStoreAndListings();
  }, [user]);

  const fetchStoreAndListings = async () => {
    if (!user) return;

    setIsLoading(true);

    // Fetch store
    const { data: storeData, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (storeError) {
      console.error("Error fetching store:", storeError);
    }

    if (!storeData) {
      // No store, redirect to setup
      navigate("/store-setup");
      return;
    }

    setStore(storeData);

    // Fetch listings
    const { data: listingsData, error: listingsError } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (listingsError) {
      console.error("Error fetching listings:", listingsError);
    }

    setListings(listingsData || []);
    setIsLoading(false);
  };

  const handleDeleteListing = async () => {
    if (!deleteListingId) return;

    try {
      const { error } = await supabase
        .from("marketplace_listings")
        .delete()
        .eq("id", deleteListingId);

      if (error) throw error;

      toast.success("Listing deleted");
      setListings(listings.filter((l) => l.id !== deleteListingId));
    } catch (error: any) {
      toast.error("Failed to delete listing");
    } finally {
      setDeleteListingId(null);
    }
  };

  if (shouldBlock) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO
        title="My Store | Manage Your Listings"
        description="Manage your store and listings on the student marketplace."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Store Header */}
          <Card className="overflow-hidden">
            {store?.store_banner_url && (
              <div
                className="h-32 bg-cover bg-center"
                style={{ backgroundImage: `url(${store.store_banner_url})` }}
              />
            )}
            <CardContent className={`p-6 ${store?.store_banner_url ? "-mt-12" : ""}`}>
              <div className="flex items-start gap-4">
                {store?.store_logo_url ? (
                  <img
                    src={store.store_logo_url}
                    alt={store.store_name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-background"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background">
                    <Store className="w-8 h-8 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold">{store?.store_name}</h1>
                      {store?.campus && (
                        <p className="text-muted-foreground">{store.campus}</p>
                      )}
                    </div>
                    <Button variant="outline" onClick={() => navigate(`/store/${store?.id}`)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Public Page
                    </Button>
                  </div>
                  {store?.store_description && (
                    <p className="text-muted-foreground mt-2">{store.store_description}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{listings.length}</p>
                <p className="text-sm text-muted-foreground">Listings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{store?.total_sales || 0}</p>
                <p className="text-sm text-muted-foreground">Sales</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">
                  {store?.rating ? store.rating.toFixed(1) : "N/A"}
                </p>
                <p className="text-sm text-muted-foreground">Rating</p>
              </CardContent>
            </Card>
          </div>

          {/* Listings */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Listings</CardTitle>
                  <CardDescription>Manage your marketplace listings</CardDescription>
                </div>
                <Button onClick={() => navigate("/marketplace")}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Listing
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {listings.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No listings yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/marketplace")}
                  >
                    Create Your First Listing
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {listings.map((listing) => (
                    <div
                      key={listing.id}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                    >
                      {listing.images?.[0] ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.item_name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{listing.item_name}</h3>
                        <p className="text-lg font-bold text-primary">
                          R{listing.price.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={listing.status === "active" ? "default" : "secondary"}
                          >
                            {listing.status}
                          </Badge>
                          {listing.verified ? (
                            <Badge variant="outline" className="text-green-600">
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600">
                              Pending Review
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteListingId(listing.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteListingId} onOpenChange={() => setDeleteListingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this listing. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteListing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default MyStore;
