import { useState, useEffect } from "react";
import { Heart, MapPin, Trash2 } from "lucide-react";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import WhatsAppButton from "@/components/WhatsAppButton";
import TrustScore from "@/components/TrustScore";
import ResidencePosterDownloadButton from "@/components/findmyres/ResidencePosterDownloadButton";

interface FavoriteResidence {
  id: string;
  residence_id: string;
  created_at: string;
  residence: any;
}

const Favorites = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteResidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) void fetchFavorites();
  }, [user]);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from("favorites")
        .select(`
          id,
          residence_id,
          created_at,
          residence:residences (
            id, slug, name, address, campus, province, city, place_label,
            price, private_price, nsfas_price, promo_price,
            image_url, cover_image_url, images,
            room_type, room_types, amenities,
            verification_level, available_spots, capacity,
            has_wifi, has_parking, is_furnished, utilities_included,
            accepts_nsfas, accepts_private, accepts_tvet, accepts_university,
            reservations_2027_open
          )
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavorites((data as unknown as FavoriteResidence[]) || []);
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (favoriteId: string) => {
    try {
      await supabase.from("favorites").delete().eq("id", favoriteId);
      setFavorites(favorites.filter((f) => f.id !== favoriteId));
      toast({ title: "Removed", description: "Residence removed from favorites" });
    } catch {
      toast({ title: "Error", description: "Could not remove favorite", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <SEO title="My Favorites | ResKonnect" description="View your saved student residences and accommodations." />
      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Heart className="w-8 h-8 text-destructive" />My Favorites</h1>
            <p className="text-muted-foreground">Your saved residences for quick access</p>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Card key={i} className="shadow-card"><Skeleton className="w-full h-48" /><CardContent className="p-4 space-y-3"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-1/3" /></CardContent></Card>)}
            </div>
          ) : favorites.length === 0 ? (
            <Card className="shadow-card"><CardContent className="p-12 text-center"><div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4"><Heart className="w-8 h-8 text-destructive" /></div><h3 className="text-lg font-semibold mb-2">No Favorites Yet</h3><p className="text-muted-foreground mb-6">Start exploring residences and save your favorites by clicking the heart icon.</p><Button onClick={() => navigate("/find")}>Find Residences</Button></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {favorites.map((fav) => {
                const residence = fav.residence;
                const preview = residence.cover_image_url || residence.images?.[0] || residence.image_url || "/placeholder.svg";
                return (
                  <Card key={fav.id} className="shadow-card hover:shadow-hover transition-all overflow-hidden group cursor-pointer" onClick={() => navigate(`/find-my-res/${residence.slug || residence.id}`)}>
                    <div className="relative">
                      <img src={preview} alt={residence.name} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} />
                      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                        <ResidencePosterDownloadButton residence={residence} compact />
                        <button onClick={(e) => { e.stopPropagation(); void removeFavorite(fav.id); }} className="w-9 h-9 rounded-full bg-background text-foreground shadow-lg flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors" aria-label="Remove from favorites"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      {residence.available_spots !== undefined && (
                        <div className="absolute bottom-3 left-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${residence.available_spots > 0 ? "bg-success/90 text-success-foreground" : "bg-muted text-foreground"}`}>{residence.available_spots > 0 ? `${residence.available_spots} spots left` : "Check availability"}</span></div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-2"><TrustScore verificationLevel={residence.verification_level} variant="badge" /></div>
                      <h3 className="font-semibold text-lg mb-1 truncate">{residence.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2"><MapPin className="w-4 h-4" />{residence.campus || residence.address}</p>
                      <div className="flex items-center justify-end"><WhatsAppButton phone="0637323192" residenceName={residence.name} variant="icon" /></div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Favorites;
