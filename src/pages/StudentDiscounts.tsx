import SEO from "@/components/SEO";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Percent, ExternalLink, Filter, Tag, ShoppingBag, Utensils, Bus, Gamepad2, Laptop, Heart, Loader2, CheckCircle } from "lucide-react";
import { RESKONNECT_WHATSAPP_FORMATTED } from "@/lib/constants";

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
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

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
              {/* Discount Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredDiscounts.map(discount => {
                  const Icon = categoryIcons[discount.category] || ShoppingBag;
                  return (
                    <Card key={discount.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
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
                          <Badge className={`${categoryColors[discount.category] || 'bg-muted'} capitalize shrink-0`}>
                            <Icon className="w-3 h-3 mr-1" />
                            {discount.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1 flex flex-col">
                        <div className="bg-primary/10 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-primary">{discount.discount}</p>
                        </div>

                        {discount.description && (
                          <p className="text-sm text-muted-foreground flex-1">{discount.description}</p>
                        )}

                        {discount.how_to_claim && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">How to Claim:</p>
                            <p className="text-sm text-muted-foreground">{discount.how_to_claim}</p>
                          </div>
                        )}

                        {discount.valid_until && (
                          <p className="text-xs text-muted-foreground">
                            Valid until: {new Date(discount.valid_until).toLocaleDateString('en-ZA')}
                          </p>
                        )}

                        {discount.link && (
                          <Button asChild className="w-full mt-auto">
                            <a href={discount.link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Get Discount
                            </a>
                          </Button>
                        )}
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
    </DashboardLayout>
  );
};

export default StudentDiscounts;