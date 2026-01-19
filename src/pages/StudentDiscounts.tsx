import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Percent, ExternalLink, Filter, Tag, ShoppingBag, Utensils, Bus, Gamepad2, Laptop, Heart, Loader2, CheckCircle, ShoppingCart, Package, AlertCircle } from "lucide-react";
import { RESKONNECT_WHATSAPP_FORMATTED } from "@/lib/constants";
import ShareButton from "@/components/ShareButton";

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

const categoryIcons: Record<string, any> = {
  food: Utensils,
  transport: Bus,
  entertainment: Gamepad2,
  tech: Laptop,
  health: Heart,
  shopping: ShoppingBag
};

const categoryColors: Record<string, string> = {
  food: "bg-warning/20 text-warning border-warning/30",
  transport: "bg-success/20 text-success border-success/30",
  entertainment: "bg-primary/20 text-primary border-primary/30",
  tech: "bg-accent/20 text-accent border-accent/30",
  health: "bg-destructive/20 text-destructive border-destructive/30",
  shopping: "bg-secondary/20 text-secondary-foreground border-secondary/30"
};

const StudentDiscounts = () => {
  const { user } = useAuth();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Order dialog state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [isOrdering, setIsOrdering] = useState(false);

  useEffect(() => {
    fetchDiscounts();
    
    // Realtime subscription
    const channel = supabase
      .channel('discounts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_discounts' }, () => fetchDiscounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDiscounts = async () => {
    setIsLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("student_discounts")
      .select("*")
      .eq("is_active", true)
      .order("is_verified", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
      setFetchError(error.message);
      toast.error("Failed to load discounts");
    } else {
      setDiscounts(data || []);
    }
    setIsLoading(false);
  };

  const filteredDiscounts = discounts.filter(discount => {
    const matchesSearch =
      discount.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      discount.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (discount.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesCategory = categoryFilter === "all" || discount.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const handlePartnerSubmit = () => {
    const message = encodeURIComponent(
      "Hi! I'd like to list my business on ResKonnect Student Discounts. Please share more information about partnership opportunities."
    );
    window.open(`https://wa.me/${RESKONNECT_WHATSAPP_FORMATTED}?text=${message}`, '_blank');
  };

  const openOrderDialog = (discount: Discount) => {
    if (!user) {
      toast.error("Please log in to place an order");
      return;
    }
    setSelectedDiscount(discount);
    setOrderQuantity(1);
    setDeliveryAddress("");
    setPhone("");
    setOrderNotes("");
    setOrderDialogOpen(true);
  };

  const handlePlaceOrder = async () => {
    if (!selectedDiscount || !user) return;
    
    if (!deliveryAddress.trim()) {
      toast.error("Please enter a delivery address");
      return;
    }
    if (!phone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    setIsOrdering(true);
    
    const totalPrice = (selectedDiscount.price || 0) * orderQuantity;
    
    const { error } = await supabase
      .from("discount_orders")
      .insert({
        user_id: user.id,
        discount_id: selectedDiscount.id,
        quantity: orderQuantity,
        total_price: totalPrice,
        delivery_address: deliveryAddress,
        phone: phone,
        notes: orderNotes || null,
        status: 'pending'
      });

    if (error) {
      console.error("Order error:", error);
      toast.error("Failed to place order. Please try again.");
    } else {
      toast.success("Order placed successfully! We'll contact you soon.");
      setOrderDialogOpen(false);
    }
    
    setIsOrdering(false);
  };

  const getStockStatus = (discount: Discount) => {
    if (!discount.is_orderable) return null;
    if (discount.stock_quantity === null || discount.stock_quantity === undefined) return 'available';
    if (discount.stock_quantity <= 0) return 'out_of_stock';
    if (discount.stock_quantity <= 5) return 'low_stock';
    return 'in_stock';
  };

  return (
    <DashboardLayout>
      <SEO
        title="Student Discounts | Save Money with Student Deals"
        description="Find the best student discounts in South Africa. Save on food, transport, entertainment, tech, and more."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold font-display flex items-center gap-3">
                <Percent className="w-8 h-8 text-primary" />
                Student Discounts
              </h1>
              <p className="text-muted-foreground mt-1">
                Exclusive deals and discounts for South African students.
              </p>
            </div>
            <Button variant="outline" onClick={handlePartnerSubmit}>
              <Tag className="w-4 h-4 mr-2" />
              List Your Business
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search discounts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
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

          {/* Category Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryIcons).map(([category, Icon]) => (
              <Button
                key={category}
                variant={categoryFilter === category ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(categoryFilter === category ? "all" : category)}
                className="capitalize"
              >
                <Icon className="w-4 h-4 mr-1" />
                {category}
              </Button>
            ))}
          </div>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            Found {filteredDiscounts.length} discounts
          </p>

          {/* Loading State */}
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading discounts...</p>
            </div>
          ) : fetchError ? (
            <Card className="border-destructive">
              <CardContent className="py-8 text-center">
                <p className="text-destructive mb-4">Failed to load discounts: {fetchError}</p>
                <Button onClick={fetchDiscounts} variant="outline">
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Discount Cards - GOD MODE with Images and Ordering */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredDiscounts.map(discount => {
                  const Icon = categoryIcons[discount.category] || ShoppingBag;
                  const stockStatus = getStockStatus(discount);
                  const isOutOfStock = stockStatus === 'out_of_stock';
                  
                  return (
                    <Card key={discount.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                      {/* Discount Image */}
                      {discount.image_url ? (
                        <div className="relative h-40 bg-muted">
                          <img 
                            src={discount.image_url} 
                            alt={discount.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <Badge className={`absolute top-2 right-2 ${categoryColors[discount.category] || 'bg-muted'} capitalize`}>
                            <Icon className="w-3 h-3 mr-1" />
                            {discount.category}
                          </Badge>
                        </div>
                      ) : (
                        <div className="relative h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                          <Icon className="w-12 h-12 text-primary/30" />
                          <Badge className={`absolute top-2 right-2 ${categoryColors[discount.category] || 'bg-muted'} capitalize`}>
                            <Icon className="w-3 h-3 mr-1" />
                            {discount.category}
                          </Badge>
                        </div>
                      )}
                      
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{discount.name}</CardTitle>
                              {discount.is_verified && (
                                <CheckCircle className="w-4 h-4 text-success shrink-0" />
                              )}
                            </div>
                            <CardDescription>{discount.provider}</CardDescription>
                          </div>
                          <ShareButton 
                            title={`${discount.discount} off at ${discount.provider}!`}
                            text={`Get ${discount.discount} at ${discount.provider} with ResKonnect Student Discounts! ${discount.description || ''}`}
                            imageUrl={discount.image_url || undefined}
                            variant="icon"
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1 flex flex-col">
                        {/* Pricing Section */}
                        <div className="bg-primary/10 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-2xl font-bold text-primary">{discount.discount}</p>
                              {discount.price !== null && discount.price !== undefined && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-lg font-semibold text-foreground">
                                    R{discount.price.toFixed(2)}
                                  </span>
                                  {discount.original_price && discount.original_price > discount.price && (
                                    <span className="text-sm text-muted-foreground line-through">
                                      R{discount.original_price.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {stockStatus && (
                              <Badge 
                                variant={isOutOfStock ? "destructive" : stockStatus === 'low_stock' ? "secondary" : "default"}
                                className={isOutOfStock ? "" : stockStatus === 'low_stock' ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}
                              >
                                {stockStatus === 'out_of_stock' && <AlertCircle className="w-3 h-3 mr-1" />}
                                {stockStatus === 'low_stock' && <Package className="w-3 h-3 mr-1" />}
                                {isOutOfStock ? 'Out of Stock' : stockStatus === 'low_stock' ? `Only ${discount.stock_quantity} left` : 'In Stock'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {discount.description && (
                          <p className="text-sm text-muted-foreground flex-1">{discount.description}</p>
                        )}

                        {discount.how_to_claim && !discount.is_orderable && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">How to Claim:</p>
                            <p className="text-sm text-muted-foreground">{discount.how_to_claim}</p>
                          </div>
                        )}

                        {discount.delivery_info && discount.is_orderable && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            {discount.delivery_info}
                          </div>
                        )}

                        {discount.valid_until && (
                          <p className="text-xs text-muted-foreground">
                            Valid until: {new Date(discount.valid_until).toLocaleDateString('en-ZA')}
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-auto space-y-2">
                          {discount.is_orderable && discount.price !== null && (
                            <Button 
                              className="w-full" 
                              onClick={() => openOrderDialog(discount)}
                              disabled={isOutOfStock}
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              {isOutOfStock ? 'Out of Stock' : 'Order Now'}
                            </Button>
                          )}
                          {discount.link && (
                            <Button asChild variant={discount.is_orderable ? "outline" : "default"} className="w-full">
                              <a href={discount.link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                {discount.is_orderable ? 'View Details' : 'Get Discount'}
                              </a>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredDiscounts.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Percent className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No discounts found</h3>
                    <p className="text-muted-foreground">Try adjusting your search filters</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Partner CTA */}
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="py-8 text-center">
              <h3 className="text-xl font-semibold mb-2">Are you a business owner?</h3>
              <p className="text-muted-foreground mb-4">
                Partner with ResKonnect to reach thousands of students across South Africa.
              </p>
              <Button onClick={handlePartnerSubmit}>
                Become a Partner
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Place Order
            </DialogTitle>
            <DialogDescription>
              Complete your order for {selectedDiscount?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedDiscount && (
            <div className="space-y-4">
              {/* Order Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item:</span>
                  <span className="font-medium">{selectedDiscount.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span>R{selectedDiscount.price?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Quantity:</span>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{orderQuantity}</span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setOrderQuantity(orderQuantity + 1)}
                      disabled={selectedDiscount.stock_quantity !== null && orderQuantity >= selectedDiscount.stock_quantity}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total:</span>
                  <span className="text-primary">R{((selectedDiscount.price || 0) * orderQuantity).toFixed(2)}</span>
                </div>
              </div>

              {/* Delivery Details */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    placeholder="e.g., 0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="address">Delivery Address *</Label>
                  <Textarea
                    id="address"
                    placeholder="Enter your delivery address (campus, residence, etc.)"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Order Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special instructions..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              {selectedDiscount.delivery_info && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {selectedDiscount.delivery_info}
                </p>
              )}

              <Button 
                className="w-full" 
                onClick={handlePlaceOrder}
                disabled={isOrdering}
              >
                {isOrdering ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Confirm Order - R{((selectedDiscount.price || 0) * orderQuantity).toFixed(2)}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentDiscounts;