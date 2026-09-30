import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Heart, MapPin, RefreshCw, Trash2 } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavorites([]);
      setError(null);
      setLoading(false);
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await (supabase as any)
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
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal);

      if (queryError) throw queryError;
      setFavorites((data as FavoriteResidence[]) || []);
    } catch (err: any) {
      setError(controller.signal.aborted
        ? "Favorites took too long to load. Check your connection and retry."
        : (err?.message || "Your saved residences are temporarily unavailable."));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchFavorites();
    const reconnect = () => void fetchFavorites();
    window.addEventListener("rk-reconnected", reconnect);
    return () => {
      requestRef.current?.abort();
      window.removeEventListener("rk-reconnected", reconnect);
    };
  }, [fetchFavorites]);

  const removeFavorite = async (favoriteId: string) => {
    try {
      const { error: deleteError } = await supabase.from("favorites").delete().eq("id", favoriteId);
      if (deleteError) throw deleteError;
      setFavorites((current) => current.filter((favorite) => favorite.id !== favoriteId));
      toast({ title: "Removed", description: "Residence removed from favorites" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Could not remove favorite", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <SEO title="My Favorites | ResKonnect" description="View your saved student residences and accommodations." />
      <div className="p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold"><Heart className="h-8 w-8 text-destructive" />My Favorites</h1>
              <p className="mt-2 text-muted-foreground">Your saved residences for quick access</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void fetchFavorites()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>

          {error && (
            <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div><p className="font-bold">Favorites need a connection refresh</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div>
                </div>
                <Button type="button" variant="outline" onClick={() => void fetchFavorites()} disabled={loading}>Try again</Button>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Card key={i} className="shadow-card"><Skeleton className="h-48 w-full" /><CardContent className="space-y-3 p-4"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-1/3" /></CardContent></Card>)}
            </div>
          ) : favorites.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"><Heart className="h-8 w-8 text-destructive" /></div>
                <h3 className="mb-2 text-lg font-semibold">No Favorites Yet</h3>
                <p className="mb-6 text-muted-foreground">Start exploring residences and save your favorites by clicking the heart icon.</p>
                <Button onClick={() => navigate("/find")}>Find Residences</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {favorites.map((fav) => {
                const residence = fav.residence;
                if (!residence) return null;
                const preview = residence.cover_image_url || residence.images?.[0] || residence.image_url || "/placeholder.svg";
                return (
                  <Card key={fav.id} className="group cursor-pointer overflow-hidden shadow-card transition-all hover:shadow-hover" onClick={() => navigate(`/find-my-res/${residence.slug || residence.id}`)}>
                    <div className="relative">
                      <img src={preview} alt={residence.name} className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105" onError={(event) => { event.currentTarget.src = "/placeholder.svg"; }} />
                      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
                        <ResidencePosterDownloadButton residence={residence} compact />
                        <button onClick={(event) => { event.stopPropagation(); void removeFavorite(fav.id); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-foreground shadow-lg transition-colors hover:bg-destructive hover:text-destructive-foreground" aria-label="Remove from favorites"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      {residence.available_spots !== undefined && (
                        <div className="absolute bottom-3 left-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${residence.available_spots > 0 ? "bg-success/90 text-success-foreground" : "bg-muted text-foreground"}`}>{residence.available_spots > 0 ? `${residence.available_spots} spots left` : "Check availability"}</span></div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-2"><TrustScore verificationLevel={residence.verification_level} variant="badge" /></div>
                      <h3 className="mb-1 truncate text-lg font-semibold">{residence.name}</h3>
                      <p className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{residence.campus || residence.address}</p>
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
