import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Heart, X, Minus, Check, Loader2, Apple, BookOpen, ShowerHead, Laptop, Bed, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface HamperItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  estimated_price: number | null;
}

interface Preference {
  item_id: string;
  preference: 'want' | 'dont_want' | 'neutral';
  priority: number;
}

const categories = [
  { value: "food", label: "Food & Snacks", icon: Apple },
  { value: "stationery", label: "Stationery", icon: BookOpen },
  { value: "toiletries", label: "Toiletries", icon: ShowerHead },
  { value: "tech", label: "Tech", icon: Laptop },
  { value: "bedding", label: "Bedding", icon: Bed },
];

const StudentHamper = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<HamperItem[]>([]);
  const [preferences, setPreferences] = useState<Map<string, Preference>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState("food");

  const fetchData = async () => {
    try {
      // Fetch all active hamper items
      const { data: itemsData, error: itemsError } = await supabase
        .from("hamper_items")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Fetch user's preferences
      if (user) {
        const { data: prefsData, error: prefsError } = await supabase
          .from("student_hamper_preferences")
          .select("*")
          .eq("user_id", user.id);

        if (prefsError) throw prefsError;

        const prefsMap = new Map<string, Preference>();
        (prefsData || []).forEach(pref => {
          prefsMap.set(pref.item_id, {
            item_id: pref.item_id,
            preference: pref.preference as 'want' | 'dont_want' | 'neutral',
            priority: pref.priority || 0,
          });
        });
        setPreferences(prefsMap);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load hamper items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const setPreference = async (itemId: string, pref: 'want' | 'dont_want' | 'neutral') => {
    if (!user) {
      toast.error("Please log in to save preferences");
      return;
    }

    const existingPref = preferences.get(itemId);
    const newPreferences = new Map(preferences);
    
    // If clicking the same preference, remove it (toggle off)
    if (existingPref?.preference === pref) {
      newPreferences.delete(itemId);
    } else {
      newPreferences.set(itemId, { item_id: itemId, preference: pref, priority: 0 });
    }
    
    setPreferences(newPreferences);
  };

  const savePreferences = async () => {
    if (!user) {
      toast.error("Please log in to save preferences");
      return;
    }

    setSaving(true);
    try {
      // Delete existing preferences
      await supabase
        .from("student_hamper_preferences")
        .delete()
        .eq("user_id", user.id);

      // Insert new preferences
      const prefsToInsert = Array.from(preferences.values()).map(pref => ({
        user_id: user.id,
        item_id: pref.item_id,
        preference: pref.preference,
        priority: pref.priority,
      }));

      if (prefsToInsert.length > 0) {
        const { error } = await supabase
          .from("student_hamper_preferences")
          .insert(prefsToInsert);

        if (error) throw error;
      }

      toast.success("Your hamper preferences have been saved!");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.icon : Gift;
  };

  const wantedItems = items.filter(item => preferences.get(item.id)?.preference === 'want');
  const dontWantItems = items.filter(item => preferences.get(item.id)?.preference === 'dont_want');
  const categoryItems = items.filter(item => item.category === activeCategory);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO 
        title="Student Hamper | ResKonnect" 
        description="Build your dream student hamper - tell us what you want!"
      />

      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-accent text-white mb-2">
            <Gift className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold">Build Your Dream Hamper</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Tell us what you'd love in your student hamper! Your preferences help us create the perfect care package for you.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-success/50 bg-success/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Heart className="w-6 h-6 text-success" />
                <div>
                  <p className="text-2xl font-bold text-success">{wantedItems.length}</p>
                  <p className="text-sm text-muted-foreground">Items You Want</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <X className="w-6 h-6 text-destructive" />
                <div>
                  <p className="text-2xl font-bold text-destructive">{dontWantItems.length}</p>
                  <p className="text-sm text-muted-foreground">Skip These</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="w-full grid grid-cols-5">
            {categories.map(cat => {
              const Icon = cat.icon;
              return (
                <TabsTrigger key={cat.value} value={cat.value} className="gap-1 text-xs md:text-sm">
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{cat.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {categories.map(cat => (
            <TabsContent key={cat.value} value={cat.value} className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.filter(item => item.category === cat.value).map(item => {
                  const pref = preferences.get(item.id);
                  return (
                    <Card key={item.id} className={`transition-all ${pref?.preference === 'want' ? 'border-success ring-2 ring-success/20' : pref?.preference === 'dont_want' ? 'border-destructive ring-2 ring-destructive/20' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                              {(() => { const Icon = getCategoryIcon(item.category); return <Icon className="w-6 h-6 text-muted-foreground" />; })()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{item.name}</h3>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                            )}
                            {item.estimated_price && (
                              <Badge variant="outline" className="mt-1">~R{item.estimated_price}</Badge>
                            )}
                          </div>
                        </div>

                        {/* Preference Buttons */}
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            variant={pref?.preference === 'want' ? 'default' : 'outline'}
                            className={`flex-1 ${pref?.preference === 'want' ? 'bg-success hover:bg-success/90' : ''}`}
                            onClick={() => setPreference(item.id, 'want')}
                          >
                            <Heart className="w-4 h-4 mr-1" />
                            Want
                          </Button>
                          <Button
                            size="sm"
                            variant={pref?.preference === 'neutral' ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => setPreference(item.id, 'neutral')}
                          >
                            <Minus className="w-4 h-4 mr-1" />
                            Maybe
                          </Button>
                          <Button
                            size="sm"
                            variant={pref?.preference === 'dont_want' ? 'destructive' : 'outline'}
                            className="flex-1"
                            onClick={() => setPreference(item.id, 'dont_want')}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Skip
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {items.filter(item => item.category === cat.value).length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No items in this category yet</p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Your Hamper Summary */}
        {wantedItems.length > 0 && (
          <Card className="bg-gradient-accent text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Your Hamper Summary
              </CardTitle>
              <CardDescription className="text-white/80">
                These are the items you'd love to receive
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {wantedItems.map(item => (
                  <Badge key={item.id} variant="secondary" className="bg-white/20 text-white border-0">
                    {item.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-center">
          <Button 
            size="lg" 
            onClick={savePreferences} 
            disabled={saving || preferences.size === 0}
            className="px-12"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Save My Preferences
          </Button>
        </div>

        {/* Info */}
        <Card className="bg-muted/50">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              💡 Your preferences help ResKonnect understand what students want. 
              We use this data to create amazing hamper packages and partner with vendors who can deliver what you need!
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentHamper;
