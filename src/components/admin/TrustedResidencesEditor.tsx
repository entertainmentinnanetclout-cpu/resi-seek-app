import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Star, Save, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Residence {
  id: string;
  name: string;
  address: string;
  image_url: string | null;
  campus: string | null;
  verification_level: string | null;
  is_trusted: boolean;
  display_order: number | null;
}

const TrustedResidencesEditor = () => {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Map<string, { is_trusted?: boolean; display_order?: number }>>(new Map());

  useEffect(() => {
    fetchResidences();
  }, []);

  const fetchResidences = async () => {
    try {
      const { data, error } = await supabase
        .from("residences")
        .select("id, name, address, image_url, campus, verification_level, is_trusted, display_order")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setResidences(data || []);
    } catch (error) {
      console.error("Error fetching residences:", error);
      toast.error("Failed to load residences");
    } finally {
      setLoading(false);
    }
  };

  const toggleTrusted = (id: string, currentValue: boolean) => {
    const newChanges = new Map(changes);
    const existing = newChanges.get(id) || {};
    newChanges.set(id, { ...existing, is_trusted: !currentValue });
    setChanges(newChanges);

    // Update local state for immediate UI feedback
    setResidences(prev => prev.map(r => 
      r.id === id ? { ...r, is_trusted: !currentValue } : r
    ));
  };

  const updateOrder = (id: string, order: number) => {
    const newChanges = new Map(changes);
    const existing = newChanges.get(id) || {};
    newChanges.set(id, { ...existing, display_order: order });
    setChanges(newChanges);

    // Update local state
    setResidences(prev => prev.map(r => 
      r.id === id ? { ...r, display_order: order } : r
    ));
  };

  const saveChanges = async () => {
    if (changes.size === 0) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const updates = Array.from(changes.entries()).map(([id, update]) => ({
        id,
        ...update,
      }));

      for (const update of updates) {
        const { id, ...fields } = update;
        const { error } = await supabase
          .from("residences")
          .update(fields)
          .eq("id", id);

        if (error) throw error;
      }

      toast.success(`Updated ${changes.size} residence(s)`);
      setChanges(new Map());
      fetchResidences();
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const getVerificationBadge = (level: string | null) => {
    switch (level) {
      case 'trusted_partner':
        return <Badge className="bg-success text-success-foreground gap-1 text-xs"><Shield className="w-3 h-3" /></Badge>;
      case 'premium':
        return <Badge className="bg-primary text-primary-foreground gap-1 text-xs"><Star className="w-3 h-3" /></Badge>;
      case 'verified':
        return <Badge variant="secondary" className="gap-1 text-xs"><Shield className="w-3 h-3" /></Badge>;
      default:
        return null;
    }
  };

  const trustedCount = residences.filter(r => r.is_trusted).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-muted-foreground">
            Select residences to feature in the "Top 30 Trusted" grid. 
            Currently selected: <strong>{trustedCount}/30</strong>
          </p>
        </div>
        <Button onClick={saveChanges} disabled={saving || changes.size === 0}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes {changes.size > 0 && `(${changes.size})`}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {residences.map((residence) => (
          <Card 
            key={residence.id} 
            className={`overflow-hidden transition-all ${
              residence.is_trusted 
                ? "ring-2 ring-primary shadow-lg" 
                : "opacity-70 hover:opacity-100"
            }`}
          >
            <div className="relative aspect-square overflow-hidden bg-muted">
              <img
                src={residence.image_url || '/placeholder.svg'}
                alt={residence.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
              <div className="absolute top-2 left-2">
                {getVerificationBadge(residence.verification_level)}
              </div>
              <div className="absolute top-2 right-2">
                <Checkbox
                  checked={residence.is_trusted}
                  onCheckedChange={() => toggleTrusted(residence.id, residence.is_trusted)}
                  className="h-6 w-6 bg-background border-2"
                />
              </div>
              {residence.is_trusted && (
                <div className="absolute bottom-2 right-2">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={residence.display_order || 1}
                    onChange={(e) => updateOrder(residence.id, parseInt(e.target.value) || 1)}
                    className="w-14 h-8 text-center text-sm bg-background/90"
                    placeholder="#"
                  />
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <h3 className="font-medium text-sm truncate">{residence.name}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {residence.campus || residence.address?.split(',')[0]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {residences.length === 0 && (
        <p className="text-center py-8 text-muted-foreground">
          No residences found. Add some residences first.
        </p>
      )}
    </div>
  );
};

export default TrustedResidencesEditor;