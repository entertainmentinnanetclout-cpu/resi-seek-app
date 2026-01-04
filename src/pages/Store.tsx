import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Store as StoreIcon, MapPin, MessageCircle, Star, Package, ArrowLeft, ShieldCheck } from "lucide-react";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";
import { useAuth } from "@/contexts/AuthContext";
import StoreReviewForm from "@/components/StoreReviewForm";
import StoreReviews from "@/components/StoreReviews";

interface StoreData {
  id: string;
  store_name: string;
  store_description: string | null;
  store_logo_url: string | null;
  store_banner_url: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  campus: string | null;
  total_sales: number;
  rating: number;
  is_active: boolean;
  verified?: boolean;
  user_id: string;
}

interface Listing {
  id: string;
  item_name: string;
  description: string;
  price: number;
  images: string[];
  condition: string;
  category: string;
}

const Store = () => {
  const shouldBlock = useAdminRedirect();
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [store, setStore] = useState<StoreData | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [existingReview, setExistingReview] = useState<any>(null);
  const [reviewRefresh, setReviewRefresh] = useState(0);

  useEffect(() => {
    if (storeId) fetchStore();
  }, [storeId]);

  useEffect(() => {
    if (storeId && user) fetchExistingReview();
  }, [storeId, user]);

  const fetchStore = async () => {
    setIsLoading(true);

    // Fetch store
    const { data: storeData, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .eq("is_active", true)
      .maybeSingle();

    if (storeError || !storeData) {
      toast.error("Store not found");
      navigate("/marketplace");
      return;
    }

    setStore(storeData);

    // Fetch store listings
    const { data: listingsData } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("store_id", storeId)
      .eq("status", "active")
      .eq("verified", true)
      .order("created_at", { ascending: false });

    setListings(listingsData || []);
    setIsLoading(false);
  };

  const fetchExistingReview = async () => {
    if (!user || !storeId) return;

    const { data } = await supabase
      .from("store_reviews")
      .select("id, rating, comment")
      .eq("store_id", storeId)
      .eq("reviewer_id", user.id)
      .maybeSingle();

    setExistingReview(data);
  };

  const handleContactSeller = () => {
    if (!store) return;

    const whatsappNumber = store.contact_whatsapp || "";
    const message = encodeURIComponent(
      `Hi! I found your store "${store.store_name}" on ResKonnect Marketplace. I'm interested in your products.`
    );

    if (whatsappNumber) {
      window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
    } else {
      toast.error("Seller has not provided a WhatsApp number");
    }
  };

  if (shouldBlock) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!store) return null;

  return (
    <DashboardLayout>
      <SEO
        title={`${store.store_name} | Student Marketplace`}
        description={store.store_description || `Browse products from ${store.store_name}`}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back Button */}
          <Button variant="ghost" onClick={() => navigate("/marketplace")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>

          {/* Store Header */}
          <Card className="overflow-hidden">
            {store.store_banner_url ? (
              <div
                className="h-40 sm:h-48 bg-cover bg-center"
                style={{ backgroundImage: `url(${store.store_banner_url})` }}
              />
            ) : (
              <div className="h-40 sm:h-48 bg-gradient-to-r from-primary/20 to-primary/5" />
            )}
            <CardContent className="p-6 -mt-16">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {store.store_logo_url ? (
                  <img
                    src={store.store_logo_url}
                    alt={store.store_name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background shadow-lg">
                    <StoreIcon className="w-10 h-10 text-primary" />
                  </div>
                )}
                <div className="flex-1 pt-4 sm:pt-8">
                  <h1 className="text-2xl sm:text-3xl font-bold">{store.store_name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                    {store.campus && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{store.campus}</span>
                      </div>
                    )}
                    {store.rating > 0 && (
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span>{store.rating.toFixed(1)}</span>
                      </div>
                    )}
                    <Badge variant="secondary">{store.total_sales} sales</Badge>
                    {store.verified && (
                      <Badge className="bg-green-600">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Verified Seller
                      </Badge>
                    )}
                  </div>
                  {store.store_description && (
                    <p className="text-muted-foreground mt-3">{store.store_description}</p>
                  )}
                  <Button className="mt-4" onClick={handleContactSeller}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contact Seller
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Listings */}
          <div>
            <h2 className="text-xl font-bold mb-4">Products ({listings.length})</h2>
            {listings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No products available</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {listings.map((listing) => (
                  <Card
                    key={listing.id}
                    className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  >
                    <div className="aspect-square bg-muted">
                      {listing.images?.[0] ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.item_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium truncate">{listing.item_name}</h3>
                      <p className="text-lg font-bold text-primary mt-1">
                        R{listing.price.toLocaleString()}
                      </p>
                      <Badge variant="outline" className="mt-2">
                        {listing.condition}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Reviews Section */}
          <div className="space-y-4">
            <StoreReviews storeId={storeId!} refreshTrigger={reviewRefresh} />
            
            {/* Review Form - only show if user is not the store owner */}
            {user && store.user_id !== user.id && (
              <StoreReviewForm
                storeId={storeId!}
                existingReview={existingReview}
                onReviewSubmitted={() => {
                  fetchExistingReview();
                  setReviewRefresh((prev) => prev + 1);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Store;
