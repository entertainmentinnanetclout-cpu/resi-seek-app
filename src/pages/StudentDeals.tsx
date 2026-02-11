import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import ShareButton from "@/components/ShareButton";
import { RESKONNECT_WHATSAPP_FORMATTED } from "@/lib/constants";
import {
  Search, Percent, ExternalLink, Filter, Tag, ShoppingBag, Utensils, Bus, Gamepad2, Laptop, Heart,
  Loader2, CheckCircle, ShoppingCart, Package, AlertCircle, Gift, X, Minus, Check,
  Apple, BookOpen, ShowerHead, Bed, Sparkles
} from "lucide-react";

// ─── Discounts types ───
interface Discount {
  id: string;
  name: string;
  provider: string;
  discount: string;
  category: string;
  description: string | null;
  how_to_claim: string | null;
  link: string | null;
  valid_until: string | null;
  is_verified: boolean;
  is_active: boolean;
  image_url: string | null;
  price: number | null;
  original_price: number | null;
  is_orderable: boolean | null;
  stock_quantity: number | null;
  delivery_info: string | null;
}

const discountCategoryIcons: Record<string, any> = {
  food: Utensils, transport: Bus, entertainment: Gamepad2, tech: Laptop, health: Heart, shopping: ShoppingBag
};
const discountCategoryColors: Record<string, string> = {
  food: "bg-warning/20 text-warning border-warning/30",
  transport: "bg-success/20 text-success border-success/30",
  entertainment: "bg-primary/20 text-primary border-primary/30",
  tech: "bg-accent/20 text-accent border-accent/30",
  health: "bg-destructive/20 text-destructive border-destructive/30",
  shopping: "bg-secondary/20 text-secondary-foreground border-secondary/30"
};

// ─── Hamper types ───
interface HamperItem {
  id: string; name: string; category: string; description: string | null; image_url: string | null; estimated_price: number | null;
}
interface Preference { item_id: string; preference: 'want' | 'dont_want' | 'neutral'; priority: number; }

const hamperCategories = [
  { value: "food", label: "Food & Snacks", icon: Apple },
  { value: "stationery", label: "Stationery", icon: BookOpen },
  { value: "toiletries", label: "Toiletries", icon: ShowerHead },
  { value: "tech", label: "Tech", icon: Laptop },
  { value: "bedding", label: "Bedding", icon: Bed },
];

const StudentDeals = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "hamper" ? "hamper" : "discounts";

  // ─── Discounts state ───
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [isOrdering, setIsOrdering] = useState(false);

  // ─── Hamper state ───
  const [items, setItems] = useState<HamperItem[]>([]);
  const [preferences, setPreferences] = useState<Map<string, Preference>>(new Map());
  const [hamperLoading, setHamperLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState("food");

  // ─── Fetch discounts ───
  useEffect(() => {
    fetchDiscounts();
    const channel = supabase.channel('discounts-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'student_discounts' }, () => fetchDiscounts()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchDiscounts = async () => {
    setDiscountsLoading(true);
    setFetchError(null);
    const { data, error } = await supabase.from("student_discounts").select("*").eq("is_active", true).order("is_verified", { ascending: false });
    if (error) { setFetchError(error.message); toast.error("Failed to load discounts"); } else { setDiscounts(data || []); }
    setDiscountsLoading(false);
  };

  // ─── Fetch hamper ───
  useEffect(() => {
    const fetchHamper = async () => {
      try {
        const { data: itemsData, error: itemsError } = await supabase.from("hamper_items").select("*").eq("is_active", true).order("name");
        if (itemsError) throw itemsError;
        setItems(itemsData || []);
        if (user) {
          const { data: prefsData, error: prefsError } = await supabase.from("student_hamper_preferences").select("*").eq("user_id", user.id);
          if (prefsError) throw prefsError;
          const prefsMap = new Map<string, Preference>();
          (prefsData || []).forEach(pref => { prefsMap.set(pref.item_id, { item_id: pref.item_id, preference: pref.preference as 'want' | 'dont_want' | 'neutral', priority: pref.priority || 0 }); });
          setPreferences(prefsMap);
        }
      } catch (error) { console.error("Error:", error); toast.error("Failed to load hamper items"); }
      finally { setHamperLoading(false); }
    };
    fetchHamper();
  }, [user]);

  // ─── Discount helpers ───
  const filteredDiscounts = discounts.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.provider.toLowerCase().includes(searchQuery.toLowerCase()) || (d.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchCat = categoryFilter === "all" || d.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const getStockStatus = (d: Discount) => {
    if (!d.is_orderable) return null;
    if (d.stock_quantity === null || d.stock_quantity === undefined) return 'available';
    if (d.stock_quantity <= 0) return 'out_of_stock';
    if (d.stock_quantity <= 5) return 'low_stock';
    return 'in_stock';
  };

  const openOrderDialog = (discount: Discount) => {
    if (!user) { toast.error("Please log in to place an order"); return; }
    setSelectedDiscount(discount); setOrderQuantity(1); setDeliveryAddress(""); setPhone(""); setOrderNotes(""); setOrderDialogOpen(true);
  };

  const handlePlaceOrder = async () => {
    if (!selectedDiscount || !user) return;
    if (!deliveryAddress.trim()) { toast.error("Please enter a delivery address"); return; }
    if (!phone.trim()) { toast.error("Please enter a phone number"); return; }
    setIsOrdering(true);
    const totalPrice = (selectedDiscount.price || 0) * orderQuantity;
    const { error } = await supabase.from("discount_orders").insert({ user_id: user.id, discount_id: selectedDiscount.id, quantity: orderQuantity, total_price: totalPrice, delivery_address: deliveryAddress, phone, notes: orderNotes || null, status: 'pending' });
    if (error) { toast.error("Failed to place order."); } else { toast.success("Order placed successfully!"); setOrderDialogOpen(false); }
    setIsOrdering(false);
  };

  const handlePartnerSubmit = () => {
    const message = encodeURIComponent("Hi! I'd like to list my business on ResKonnect Student Discounts.");
    window.open(`https://wa.me/${RESKONNECT_WHATSAPP_FORMATTED}?text=${message}`, '_blank');
  };

  // ─── Hamper helpers ───
  const setPreference = (itemId: string, pref: 'want' | 'dont_want' | 'neutral') => {
    if (!user) { toast.error("Please log in to save preferences"); return; }
    const newPreferences = new Map(preferences);
    if (preferences.get(itemId)?.preference === pref) { newPreferences.delete(itemId); } else { newPreferences.set(itemId, { item_id: itemId, preference: pref, priority: 0 }); }
    setPreferences(newPreferences);
  };

  const savePreferences = async () => {
    if (!user) { toast.error("Please log in"); return; }
    setSaving(true);
    try {
      await supabase.from("student_hamper_preferences").delete().eq("user_id", user.id);
      const prefsToInsert = Array.from(preferences.values()).map(p => ({ user_id: user.id, item_id: p.item_id, preference: p.preference, priority: p.priority }));
      if (prefsToInsert.length > 0) { const { error } = await supabase.from("student_hamper_preferences").insert(prefsToInsert); if (error) throw error; }
      toast.success("Preferences saved!");
    } catch { toast.error("Failed to save preferences"); }
    finally { setSaving(false); }
  };

  const getCategoryIcon = (category: string) => { const cat = hamperCategories.find(c => c.value === category); return cat ? cat.icon : Gift; };
  const wantedItems = items.filter(item => preferences.get(item.id)?.preference === 'want');
  const dontWantItems = items.filter(item => preferences.get(item.id)?.preference === 'dont_want');

  return (
    <DashboardLayout>
      <SEO title="Deals & Hamper | ResKonnect" description="Student discounts, deals, and hamper preferences all in one place." />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display flex items-center gap-3">
              <Gift className="w-8 h-8 text-primary" />
              Deals & Hamper
            </h1>
            <p className="text-muted-foreground mt-1">Student discounts, deals, and build your dream hamper.</p>
          </div>

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="discounts" className="gap-2"><Percent className="w-4 h-4" />Discounts & Deals</TabsTrigger>
              <TabsTrigger value="hamper" className="gap-2"><Gift className="w-4 h-4" />Student Hamper</TabsTrigger>
            </TabsList>

            {/* ═══ DISCOUNTS TAB ═══ */}
            <TabsContent value="discounts" className="space-y-6 mt-6">
              {/* Filters */}
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input placeholder="Search discounts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11" />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-full sm:w-[200px]"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="food">Food & Dining</SelectItem>
                        <SelectItem value="transport">Transport</SelectItem>
                        <SelectItem value="entertainment">Entertainment</SelectItem>
                        <SelectItem value="tech">Tech & Software</SelectItem>
                        <SelectItem value="health">Health & Fitness</SelectItem>
                        <SelectItem value="shopping">Shopping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                {Object.entries(discountCategoryIcons).map(([category, Icon]) => (
                  <Button key={category} variant={categoryFilter === category ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter(categoryFilter === category ? "all" : category)} className="capitalize">
                    <Icon className="w-4 h-4 mr-1" />{category}
                  </Button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Found {filteredDiscounts.length} discounts</p>
                <Button asChild variant="link" size="sm"><a href="/my-discount-orders">My Orders →</a></Button>
              </div>

              {discountsLoading ? (
                <div className="text-center py-12"><Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" /><p className="text-muted-foreground">Loading discounts...</p></div>
              ) : fetchError ? (
                <Card className="border-destructive"><CardContent className="py-8 text-center"><p className="text-destructive mb-4">Failed to load: {fetchError}</p><Button onClick={fetchDiscounts} variant="outline">Retry</Button></CardContent></Card>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {filteredDiscounts.map(discount => {
                      const Icon = discountCategoryIcons[discount.category] || ShoppingBag;
                      const stockStatus = getStockStatus(discount);
                      const isOutOfStock = stockStatus === 'out_of_stock';
                      return (
                        <Card key={discount.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                          {discount.image_url ? (
                            <div className="relative h-40 bg-muted">
                              <img src={discount.image_url} alt={discount.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              <Badge className={`absolute top-2 right-2 ${discountCategoryColors[discount.category] || 'bg-muted'} capitalize`}><Icon className="w-3 h-3 mr-1" />{discount.category}</Badge>
                            </div>
                          ) : (
                            <div className="relative h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                              <Icon className="w-12 h-12 text-primary/30" />
                              <Badge className={`absolute top-2 right-2 ${discountCategoryColors[discount.category] || 'bg-muted'} capitalize`}><Icon className="w-3 h-3 mr-1" />{discount.category}</Badge>
                            </div>
                          )}
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-lg">{discount.name}</CardTitle>
                                  {discount.is_verified && <CheckCircle className="w-4 h-4 text-success shrink-0" />}
                                </div>
                                <CardDescription>{discount.provider}</CardDescription>
                              </div>
                              <ShareButton title={`${discount.discount} off at ${discount.provider}!`} text={`Get ${discount.discount} at ${discount.provider} with ResKonnect!`} imageUrl={discount.image_url || undefined} variant="icon" />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4 flex-1 flex flex-col">
                            <div className="bg-primary/10 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-2xl font-bold text-primary">{discount.discount}</p>
                                  {discount.price !== null && discount.price !== undefined && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-lg font-semibold text-foreground">R{discount.price.toFixed(2)}</span>
                                      {discount.original_price && discount.original_price > discount.price && <span className="text-sm text-muted-foreground line-through">R{discount.original_price.toFixed(2)}</span>}
                                    </div>
                                  )}
                                </div>
                                {stockStatus && (
                                  <Badge variant={isOutOfStock ? "destructive" : stockStatus === 'low_stock' ? "secondary" : "default"} className={isOutOfStock ? "" : stockStatus === 'low_stock' ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}>
                                    {isOutOfStock ? <><AlertCircle className="w-3 h-3 mr-1" />Out of Stock</> : stockStatus === 'low_stock' ? <><Package className="w-3 h-3 mr-1" />Only {discount.stock_quantity} left</> : 'In Stock'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {discount.description && <p className="text-sm text-muted-foreground flex-1">{discount.description}</p>}
                            {discount.how_to_claim && !discount.is_orderable && <div className="space-y-2"><p className="text-sm font-medium">How to Claim:</p><p className="text-sm text-muted-foreground">{discount.how_to_claim}</p></div>}
                            {discount.delivery_info && discount.is_orderable && <div className="text-sm text-muted-foreground flex items-center gap-1"><Package className="w-4 h-4" />{discount.delivery_info}</div>}
                            {discount.valid_until && <p className="text-xs text-muted-foreground">Valid until: {new Date(discount.valid_until).toLocaleDateString('en-ZA')}</p>}
                            <div className="mt-auto space-y-2">
                              {discount.is_orderable && discount.price !== null && <Button className="w-full" onClick={() => openOrderDialog(discount)} disabled={isOutOfStock}><ShoppingCart className="w-4 h-4 mr-2" />{isOutOfStock ? 'Out of Stock' : 'Order Now'}</Button>}
                              {discount.link && <Button asChild variant={discount.is_orderable ? "outline" : "default"} className="w-full"><a href={discount.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4 mr-2" />{discount.is_orderable ? 'View Details' : 'Get Discount'}</a></Button>}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  {filteredDiscounts.length === 0 && (
                    <Card><CardContent className="py-12 text-center"><Percent className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h3 className="text-xl font-semibold mb-2">No discounts found</h3><p className="text-muted-foreground">Try adjusting your search filters</p></CardContent></Card>
                  )}
                </>
              )}

              <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
                <CardContent className="py-8 text-center">
                  <h3 className="text-xl font-semibold mb-2">Are you a business owner?</h3>
                  <p className="text-muted-foreground mb-4">Partner with ResKonnect to reach thousands of students.</p>
                  <Button onClick={handlePartnerSubmit}>Become a Partner</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ HAMPER TAB ═══ */}
            <TabsContent value="hamper" className="space-y-8 mt-6">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground mb-2">
                  <Gift className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold">Build Your Dream Hamper</h2>
                <p className="text-muted-foreground max-w-xl mx-auto">Tell us what you'd love in your student hamper!</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="border-success/50 bg-success/5">
                  <CardContent className="p-4"><div className="flex items-center gap-3"><Heart className="w-6 h-6 text-success" /><div><p className="text-2xl font-bold text-success">{wantedItems.length}</p><p className="text-sm text-muted-foreground">Items You Want</p></div></div></CardContent>
                </Card>
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="p-4"><div className="flex items-center gap-3"><X className="w-6 h-6 text-destructive" /><div><p className="text-2xl font-bold text-destructive">{dontWantItems.length}</p><p className="text-sm text-muted-foreground">Skip These</p></div></div></CardContent>
                </Card>
              </div>

              {hamperLoading ? (
                <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <>
                  <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                    <TabsList className="w-full grid grid-cols-5">
                      {hamperCategories.map(cat => { const Icon = cat.icon; return (<TabsTrigger key={cat.value} value={cat.value} className="gap-1 text-xs md:text-sm"><Icon className="w-4 h-4" /><span className="hidden sm:inline">{cat.label}</span></TabsTrigger>); })}
                    </TabsList>
                    {hamperCategories.map(cat => (
                      <TabsContent key={cat.value} value={cat.value} className="mt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {items.filter(item => item.category === cat.value).map(item => {
                            const pref = preferences.get(item.id);
                            const ItemIcon = getCategoryIcon(item.category);
                            return (
                              <Card key={item.id} className={`transition-all ${pref?.preference === 'want' ? 'border-success ring-2 ring-success/20' : pref?.preference === 'dont_want' ? 'border-destructive ring-2 ring-destructive/20' : ''}`}>
                                <CardContent className="p-4">
                                  <div className="flex gap-4">
                                    {item.image_url ? <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-lg object-cover" /> : <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center"><ItemIcon className="w-6 h-6 text-muted-foreground" /></div>}
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-semibold truncate">{item.name}</h3>
                                      {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                                      {item.estimated_price && <Badge variant="outline" className="mt-1">~R{item.estimated_price}</Badge>}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-4">
                                    <Button size="sm" variant={pref?.preference === 'want' ? 'default' : 'outline'} className={`flex-1 ${pref?.preference === 'want' ? 'bg-success hover:bg-success/90' : ''}`} onClick={() => setPreference(item.id, 'want')}><Heart className="w-4 h-4 mr-1" />Want</Button>
                                    <Button size="sm" variant={pref?.preference === 'neutral' ? 'default' : 'outline'} className="flex-1" onClick={() => setPreference(item.id, 'neutral')}><Minus className="w-4 h-4 mr-1" />Maybe</Button>
                                    <Button size="sm" variant={pref?.preference === 'dont_want' ? 'destructive' : 'outline'} className="flex-1" onClick={() => setPreference(item.id, 'dont_want')}><X className="w-4 h-4 mr-1" />Skip</Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                          {items.filter(item => item.category === cat.value).length === 0 && (
                            <div className="col-span-full text-center py-8 text-muted-foreground"><Gift className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>No items in this category yet</p></div>
                          )}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>

                  {wantedItems.length > 0 && (
                    <Card className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" />Your Hamper Summary</CardTitle><CardDescription className="text-primary-foreground/80">Items you'd love to receive</CardDescription></CardHeader>
                      <CardContent><div className="flex flex-wrap gap-2">{wantedItems.map(item => <Badge key={item.id} variant="secondary" className="bg-white/20 text-primary-foreground border-0">{item.name}</Badge>)}</div></CardContent>
                    </Card>
                  )}

                  <div className="flex justify-center">
                    <Button size="lg" onClick={savePreferences} disabled={saving || preferences.size === 0} className="px-12">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}Save My Preferences
                    </Button>
                  </div>

                  <Card className="bg-muted/50">
                    <CardContent className="py-4 text-center">
                      <p className="text-sm text-muted-foreground">💡 Your preferences help ResKonnect create amazing hamper packages and partner with vendors who deliver what you need!</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" />Place Order</DialogTitle>
            <DialogDescription>Complete your order for {selectedDiscount?.name}</DialogDescription>
          </DialogHeader>
          {selectedDiscount && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Item:</span><span className="font-medium">{selectedDiscount.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price:</span><span>R{selectedDiscount.price?.toFixed(2)}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Quantity:</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}>-</Button>
                    <span className="w-8 text-center">{orderQuantity}</span>
                    <Button size="sm" variant="outline" onClick={() => setOrderQuantity(orderQuantity + 1)} disabled={selectedDiscount.stock_quantity !== null && orderQuantity >= (selectedDiscount.stock_quantity ?? 0)}>+</Button>
                  </div>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold"><span>Total:</span><span className="text-primary">R{((selectedDiscount.price || 0) * orderQuantity).toFixed(2)}</span></div>
              </div>
              <div className="space-y-3">
                <div><Label htmlFor="phone">Phone Number *</Label><Input id="phone" placeholder="e.g., 0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div><Label htmlFor="address">Delivery Address *</Label><Textarea id="address" placeholder="Enter your delivery address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} /></div>
                <div><Label htmlFor="notes">Order Notes (Optional)</Label><Textarea id="notes" placeholder="Any special instructions..." value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} rows={2} /></div>
              </div>
              {selectedDiscount.delivery_info && <p className="text-sm text-muted-foreground flex items-center gap-1"><Package className="w-4 h-4" />{selectedDiscount.delivery_info}</p>}
              <Button className="w-full" onClick={handlePlaceOrder} disabled={isOrdering}>
                {isOrdering ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Placing Order...</> : <><ShoppingCart className="w-4 h-4 mr-2" />Confirm Order - R{((selectedDiscount.price || 0) * orderQuantity).toFixed(2)}</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentDeals;
