import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, ShoppingCart, Star, Filter, Package, Store, Flame, Sparkles, Percent, Gift } from "lucide-react";

import { useCartCount } from "@/hooks/useCart";

const Marketplace = () => {
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const cartCount = useCartCount();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "products";

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Deals state
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(true);

  // Hampers state
  const [hampers, setHampers] = useState<any[]>([]);
  const [hampersLoading, setHampersLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchDiscounts();
    fetchHampers();
  }, []);

  

  const fetchCategories = async () => {
    const { data } = await supabase.from("product_categories" as any).select("*").order("display_order");
    setCategories(data || []);
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("products" as any)
      .select("*, stores!inner(store_name, store_logo_url, rating)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching products:", error);
    setProducts(data || []);
    setIsLoading(false);
  };

  const fetchDiscounts = async () => {
    const { data } = await supabase.from("student_discounts").select("*").eq("is_active", true);
    setDiscounts(data || []);
    setDiscountsLoading(false);
  };

  const fetchHampers = async () => {
    const { data } = await supabase.from("hampers" as any).select("*, hamper_bundle_items(*)").eq("is_active", true);
    setHampers(data || []);
    setHampersLoading(false);
  };

  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a: any, b: any) => {
    switch (sortBy) {
      case "price_low": return a.price - b.price;
      case "price_high": return b.price - a.price;
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const featuredProducts = products.filter((p: any) => p.is_featured);

  return (
    <DashboardLayout>
      <SEO title="Marketplace | Shop, Deals & Hampers" description="Shop products, grab student deals, and order hamper bundles." />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold font-display">Marketplace</h1>
              <p className="text-muted-foreground mt-1">Shop, deals & hamper bundles — all in one place</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/my-store")}>
                <Store className="w-4 h-4 mr-2" /> My Store
              </Button>
              <Button variant="outline" className="relative" onClick={() => navigate("/cart")}>
                <ShoppingCart className="w-4 h-4 mr-2" /> Cart
                {cartCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">{cartCount}</Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Tabs: Products | Deals | Hampers */}
          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
              <TabsTrigger value="products" className="gap-1.5">
                <Package className="w-4 h-4" /> Products
              </TabsTrigger>
              <TabsTrigger value="deals" className="gap-1.5">
                <Percent className="w-4 h-4" /> Deals
              </TabsTrigger>
              <TabsTrigger value="hampers" className="gap-1.5">
                <Gift className="w-4 h-4" /> Hampers
              </TabsTrigger>
            </TabsList>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-6">
              {/* Search & Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input placeholder="Search products, stores, brands..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11" />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="price_low">Price: Low → High</SelectItem>
                        <SelectItem value="price_high">Price: High → Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {categories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <Button variant={selectedCategory === "all" ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory("all")} className="whitespace-nowrap">All</Button>
                  {categories.map((c: any) => (
                    <Button key={c.id} variant={selectedCategory === c.id ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(c.id)} className="whitespace-nowrap">{c.name}</Button>
                  ))}
                </div>
              )}

              {featuredProducts.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">Featured Products</h2></div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {featuredProducts.slice(0, 4).map((product: any) => (<ProductCard key={product.id} product={product} onClick={() => navigate(`/product/${product.id}`)} />))}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center gap-2 mb-4"><Flame className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">{searchQuery || selectedCategory !== "all" ? "Results" : "All Products"}</h2><Badge variant="secondary">{filteredProducts.length}</Badge></div>
                {isLoading ? (
                  <div className="text-center py-12"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" /><p className="text-muted-foreground">Loading products...</p></div>
                ) : filteredProducts.length === 0 ? (
                  <Card><CardContent className="py-12 text-center"><Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h3 className="text-xl font-semibold mb-2">No products found</h3><p className="text-muted-foreground">{searchQuery ? "Try a different search." : "Products will appear once stores add items."}</p></CardContent></Card>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredProducts.map((product: any) => (<ProductCard key={product.id} product={product} onClick={() => navigate(`/product/${product.id}`)} />))}
                  </div>
                )}
              </section>
            </TabsContent>

            {/* Deals Tab */}
            <TabsContent value="deals" className="space-y-6">
              <div className="flex items-center gap-2 mb-2"><Percent className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">Student Deals & Discounts</h2></div>
              {discountsLoading ? (
                <div className="text-center py-12"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" /></div>
              ) : discounts.length === 0 ? (
                <Card><CardContent className="py-12 text-center"><Percent className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h3 className="text-xl font-semibold mb-2">No deals yet</h3><p className="text-muted-foreground">Student deals will appear here soon.</p></CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {discounts.map((deal: any) => (
                    <Card key={deal.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      {deal.image_url && (
                        <div className="h-40 overflow-hidden bg-muted">
                          <img src={deal.image_url} alt={deal.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <Badge variant="secondary" className="mb-2">{deal.category}</Badge>
                        <h3 className="font-bold text-lg">{deal.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{deal.provider}</p>
                        <Badge className="bg-primary text-primary-foreground">{deal.discount}</Badge>
                        {deal.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{deal.description}</p>}
                        {deal.is_orderable && deal.price && (
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-lg font-bold text-primary">R{Number(deal.price).toFixed(2)}</span>
                            <Button size="sm" onClick={() => navigate(`/discounts`)}>Order</Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Hampers Tab */}
            <TabsContent value="hampers" className="space-y-6">
              <div className="flex items-center gap-2 mb-2"><Gift className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">Student Hamper Bundles</h2></div>
              {hampersLoading ? (
                <div className="text-center py-12"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" /></div>
              ) : hampers.length === 0 ? (
                <Card><CardContent className="py-12 text-center"><Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h3 className="text-xl font-semibold mb-2">No hampers available</h3><p className="text-muted-foreground">Hamper bundles will appear here once available.</p></CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hampers.map((hamper: any) => (
                    <Card key={hamper.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      {hamper.image_url && (
                        <div className="h-40 overflow-hidden bg-muted">
                          <img src={hamper.image_url} alt={hamper.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                        </div>
                      )}
                      <CardContent className="p-4">
                        {hamper.category && <Badge variant="secondary" className="mb-2">{hamper.category}</Badge>}
                        <h3 className="font-bold text-lg">{hamper.name}</h3>
                        {hamper.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{hamper.description}</p>}
                        {hamper.hamper_bundle_items?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Includes:</p>
                            <div className="flex flex-wrap gap-1">
                              {hamper.hamper_bundle_items.slice(0, 4).map((item: any) => (
                                <Badge key={item.id} variant="outline" className="text-xs">{item.item_name}</Badge>
                              ))}
                              {hamper.hamper_bundle_items.length > 4 && <Badge variant="outline" className="text-xs">+{hamper.hamper_bundle_items.length - 4} more</Badge>}
                            </div>
                          </div>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xl font-bold text-primary">R{Number(hamper.price).toFixed(2)}</span>
                          <div className="flex items-center gap-2">
                            {hamper.stock_quantity <= 0 ? (
                              <Badge variant="destructive">Sold Out</Badge>
                            ) : (
                              <Badge variant="secondary">{hamper.stock_quantity} left</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

function ProductCard({ product, onClick }: { product: any; onClick: () => void }) {
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercent = hasDiscount ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100) : 0;

  return (
    <Card className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all flex flex-col" onClick={onClick}>
      <div className="aspect-square overflow-hidden bg-muted relative">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-muted-foreground" /></div>
        )}
        {hasDiscount && <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">-{discountPercent}%</Badge>}
        {product.stock_quantity <= 0 && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center"><Badge variant="secondary">Out of Stock</Badge></div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-muted-foreground truncate mb-1">{product.stores?.store_name || "Store"}</p>
        <h3 className="font-medium text-sm line-clamp-2 flex-1">{product.name}</h3>
        <div className="mt-2">
          <span className="text-lg font-bold text-primary">R{Number(product.price).toFixed(2)}</span>
          {hasDiscount && <span className="text-xs text-muted-foreground line-through ml-2">R{Number(product.compare_at_price).toFixed(2)}</span>}
        </div>
        {product.stores?.rating > 0 && (
          <div className="flex items-center gap-1 mt-1"><Star className="w-3 h-3 fill-primary text-primary" /><span className="text-xs text-muted-foreground">{Number(product.stores.rating).toFixed(1)}</span></div>
        )}
      </div>
    </Card>
  );
}

export default Marketplace;
