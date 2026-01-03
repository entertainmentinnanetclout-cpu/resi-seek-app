import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Star, Save, Loader2, MapPin, GripVertical, Wand2, X, Search } from "lucide-react";
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
  const [allResidences, setAllResidences] = useState<Residence[]>([]);
  const [trustedList, setTrustedList] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    fetchResidences();
    
    const channel = supabase
      .channel('trusted-residences')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residences' }, () => {
        if (!hasChanges) fetchResidences();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasChanges]);

  const fetchResidences = async () => {
    try {
      const { data, error } = await supabase.from("residences").select("*");
      if (error) throw error;

      const normalized: Residence[] = (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        image_url: r.image_url ?? null,
        campus: r.campus ?? null,
        verification_level: r.verification_level ?? null,
        is_trusted: Boolean(r.is_trusted ?? false),
        display_order: typeof r.display_order === "number" ? r.display_order : null,
      }));

      setAllResidences(normalized);
      
      const trusted = normalized
        .filter(r => r.is_trusted)
        .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));
      setTrustedList(trusted);
    } catch (error) {
      console.error("Error fetching residences:", error);
      toast.error("Failed to load residences");
    } finally {
      setLoading(false);
    }
  };

  const addToTrusted = (residence: Residence) => {
    if (trustedList.length >= 30) {
      toast.error("Maximum 30 trusted residences allowed");
      return;
    }
    if (trustedList.find(r => r.id === residence.id)) {
      toast.error("Already in trusted list");
      return;
    }
    setTrustedList([...trustedList, { ...residence, is_trusted: true, display_order: trustedList.length + 1 }]);
    setHasChanges(true);
  };

  const removeFromTrusted = (id: string) => {
    setTrustedList(trustedList.filter(r => r.id !== id));
    setHasChanges(true);
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    
    const newList = [...trustedList];
    const draggedItem = newList[dragItem.current];
    newList.splice(dragItem.current, 1);
    newList.splice(dragOverItem.current, 0, draggedItem);
    
    // Reassign display_order
    const reordered = newList.map((item, idx) => ({ ...item, display_order: idx + 1 }));
    setTrustedList(reordered);
    setHasChanges(true);
    
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const autoAssignRanks = () => {
    const reordered = trustedList.map((item, idx) => ({ ...item, display_order: idx + 1 }));
    setTrustedList(reordered);
    setHasChanges(true);
    toast.success("Ranks auto-assigned 1-" + reordered.length);
  };

  const saveChanges = async () => {
    if (trustedList.length > 30) {
      toast.error("Cannot save more than 30 trusted residences");
      return;
    }

    setSaving(true);
    try {
      // First, unmark all as not trusted
      const { error: resetError } = await supabase
        .from("residences")
        .update({ is_trusted: false, display_order: 0 })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Dummy condition to update all

      if (resetError) throw resetError;

      // Then mark selected as trusted with their order
      for (const res of trustedList) {
        const { error } = await supabase
          .from("residences")
          .update({ is_trusted: true, display_order: res.display_order })
          .eq("id", res.id);
        if (error) throw error;
      }

      toast.success(`Saved ${trustedList.length} trusted residences`);
      setHasChanges(false);
      fetchResidences();
    } catch (error) {
      console.error("Error saving:", error);
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

  const availableResidences = allResidences.filter(
    r => !trustedList.find(t => t.id === r.id) &&
    (r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.campus?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-muted-foreground">
            Drag to reorder. Select up to <strong>30</strong> residences.
            Currently: <strong className={trustedList.length > 30 ? "text-destructive" : ""}>{trustedList.length}/30</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoAssignRanks} disabled={trustedList.length === 0}>
            <Wand2 className="w-4 h-4 mr-2" /> Auto-Rank
          </Button>
          <Button onClick={saveChanges} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save {hasChanges && "*"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Trusted List (Left Panel) */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" /> Top {trustedList.length} Trusted
            </h3>
            {trustedList.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No trusted residences selected. Add from the right panel.
              </p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {trustedList.map((residence, index) => (
                  <div
                    key={residence.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg cursor-grab active:cursor-grabbing border border-transparent hover:border-primary/30"
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Badge variant="outline" className="w-8 h-8 flex items-center justify-center p-0 flex-shrink-0">
                      {index + 1}
                    </Badge>
                    <img
                      src={residence.image_url || '/placeholder.svg'}
                      alt={residence.name}
                      className="w-12 h-12 object-cover rounded flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{residence.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3" />
                        {residence.campus || residence.address?.split(',')[0]}
                      </p>
                    </div>
                    {getVerificationBadge(residence.verification_level)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeFromTrusted(residence.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Residences (Right Panel) */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Available Residences ({availableResidences.length})</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, campus..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {availableResidences.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No residences match your search" : "All residences are in the trusted list"}
                </p>
              ) : (
                availableResidences.map((residence) => (
                  <div
                    key={residence.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => addToTrusted(residence)}
                  >
                    <img
                      src={residence.image_url || '/placeholder.svg'}
                      alt={residence.name}
                      className="w-10 h-10 object-cover rounded flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{residence.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {residence.campus || residence.address?.split(',')[0]}
                      </p>
                    </div>
                    {getVerificationBadge(residence.verification_level)}
                    <Button variant="outline" size="sm" className="flex-shrink-0">
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrustedResidencesEditor;
