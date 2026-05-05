import SEO from "@/components/SEO";
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, Store, Star, Minus, Plus, Package, ArrowLeft, Truck, Shield, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { BadgeCheck, GraduationCap, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAddToCart } from "@/hooks/useCart";
import ShareButton from "@/components/ShareButton";
import { getOgImageUrl } from "@/lib/share";

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const addToCart = useAddToCart();
  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (id) fetchProduct();
  }, [id]);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem("pending_ref", ref);
    }
  }, [searchParams]);

  const fetchProduct = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("products" as any)
      .select("*, stores(id, store_name, store_logo_url, rating, campus)")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      toast.error("Product not found");
      navigate("/marketplace");
      return;
    }

    setProduct(data);

    // Fetch variants
    const { data: variantData } = await supabase
      .from("product_variants" as any)
      .select("*")
      .eq("product_id", id);
    setVariants(variantData || []);

    // Fetch related products
    const productData = data as any;
    if (productData.category_id) {
      const { data: related } = await supabase
        .from("products" as any)
        .select("*, stores(store_name)")
        .eq("category_id", productData.category_id)
        .eq("is_active", true)
        .neq("id", id)
        .limit(4);
      setRelatedProducts(related || []);
    }

    setIsLoading(false);
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error("Please sign in to add items to cart");
      return;
    }
    await addToCart(product.id, selectedVariant, quantity);
    toast.success(`${product.name} added to cart!`);
  };

  const currentPrice = selectedVariant
    ? variants.find((v: any) => v.id === selectedVariant)?.price || product?.price
    : product?.price;

  const currentStock = selectedVariant
    ? variants.find((v: any) => v.id === selectedVariant)?.stock_quantity ?? product?.stock_quantity
    : product?.stock_quantity;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!product) return null;

  const images = product.images?.length > 0 ? product.images : ['/placeholder.svg'];

  return (
    <DashboardLayout>
      <SEO
        title={`${product.name} | ResKonnect Marketplace`}
        description={product.description || `Shop ${product.name} on ResKonnect — South Africa's student marketplace.`}
        type="product"
        imageUrl={product.images?.[0] || getOgImageUrl("product", product.id)}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>

          {/* Product Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Images */}
            <div className="space-y-4">
              <div className="aspect-square rounded-xl overflow-hidden bg-muted relative group">
                <img
                  src={images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-contain bg-background cursor-zoom-in"
                  onClick={() => setZoomOpen(true)}
                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImage(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setSelectedImage(i => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((img: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                        i === selectedImage ? "border-primary" : "border-border"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="space-y-6">
              {/* Store */}
              <button
                onClick={() => navigate(`/store/${product.stores?.id}`)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Store className="w-4 h-4" />
                {product.stores?.store_name}
                {product.stores?.rating > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-primary text-primary" />
                    {Number(product.stores.rating).toFixed(1)}
                  </span>
                )}
              </button>

              <div className="flex items-start gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold flex-1">{product.name}</h1>
                <ShareButton
                  variant="icon"
                  type="product"
                  id={product.id}
                  title={product.name}
                  text={product.description || `Check out ${product.name} on ResKonnect Marketplace`}
                  className="border"
                />
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary">R{Number(currentPrice).toFixed(2)}</span>
                {product.compare_at_price && product.compare_at_price > currentPrice && (
                  <>
                    <span className="text-lg text-muted-foreground line-through">
                      R{Number(product.compare_at_price).toFixed(2)}
                    </span>
                    <Badge className="bg-destructive text-destructive-foreground">
                      Save {Math.round(((product.compare_at_price - currentPrice) / product.compare_at_price) * 100)}%
                    </Badge>
                  </>
                )}
              </div>

              {/* Stock */}
              {currentStock > 0 ? (
                <Badge variant="secondary" className="text-sm">
                  <Package className="w-3 h-3 mr-1" />
                  {currentStock <= 5 ? `Only ${currentStock} left!` : "In Stock"}
                </Badge>
              ) : (
                <Badge variant="destructive">Out of Stock</Badge>
              )}

              {/* Variants */}
              {variants.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Variant</label>
                  <Select value={selectedVariant || ""} onValueChange={setSelectedVariant}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select variant" />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.variant_name} — R{Number(v.price).toFixed(2)}
                          {v.stock_quantity <= 0 && " (Out of stock)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quantity */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-lg font-semibold w-12 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(q => Math.min(currentStock || 99, q + 1))}
                    disabled={quantity >= (currentStock || 99)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Add to Cart / Buy Now */}
              {product.payment_type === "checkout_link" && product.checkout_url ? (
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={() => window.open(product.checkout_url, "_blank")}
                >
                  <ExternalLink className="w-5 h-5" />
                  Buy Now — R{(Number(currentPrice) * quantity).toFixed(2)}
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleAddToCart}
                  disabled={currentStock <= 0}
                >
                  <ShoppingCart className="w-5 h-5" />
                  Add to Cart — R{(Number(currentPrice) * quantity).toFixed(2)}
                </Button>
              )}

              {/* Trust badges */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50">
                  <BadgeCheck className="w-4 h-4 text-green-600" />
                  <span>Verified Seller</span>
                </div>
                <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <span>Student Marketplace</span>
                </div>
                <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Campus Delivery</span>
                </div>
                <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>No Counterfeit</span>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{product.description}</p>
                </div>
              )}

              {product.brand && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Brand:</span>
                  <span className="font-medium">{product.brand}</span>
                </div>
              )}
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <section className="pt-8 border-t">
              <h2 className="text-xl font-bold mb-4">You might also like</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {relatedProducts.map((rp: any) => (
                  <Card
                    key={rp.id}
                    className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all"
                    onClick={() => navigate(`/product/${rp.id}`)}
                  >
                    <div className="aspect-square overflow-hidden bg-muted">
                      {rp.images?.[0] ? (
                        <img src={rp.images[0]} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-muted-foreground truncate">{rp.stores?.store_name}</p>
                      <h3 className="font-medium text-sm line-clamp-2">{rp.name}</h3>
                      <span className="text-lg font-bold text-primary">R{Number(rp.price).toFixed(2)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-5xl p-2 bg-background">
          <img
            src={images[selectedImage]}
            alt={product.name}
            className="w-full max-h-[85vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ProductDetail;
