import SEO from "@/components/SEO";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Minus, Plus, Trash2, ArrowLeft, ShoppingBag, Package } from "lucide-react";
import { useCart, unitPriceOf, displayOf } from "@/hooks/useCart";
import { useAdminRedirect } from "@/hooks/useAdminRedirect";

const Cart = () => {
  const shouldBlock = useAdminRedirect();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, isLoading, total, updateQuantity, removeItem, clearCart } = useCart();

  if (shouldBlock) return null;

  return (
    <DashboardLayout>
      <SEO title="Shopping Cart | ResKonnect" description="Review your cart items and checkout." />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continue Shopping
          </Button>

          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-7 h-7" />
              Shopping Cart
            </h1>
            {items.length > 0 && (
              <Badge variant="secondary">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
                <p className="text-muted-foreground mb-6">Browse the marketplace to find great deals.</p>
                <Button onClick={() => navigate("/marketplace")}>Browse Marketplace</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {items.map((item: any) => {
                  const d = displayOf(item);
                  const lineTotal = unitPriceOf(item) * (item.quantity || 1);
                  const detailHref = item.item_type === "product" && item.products?.id
                    ? `/product/${item.products.id}` : undefined;
                  return (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div
                            className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0 cursor-pointer"
                            onClick={() => detailHref && navigate(detailHref)}
                          >
                            {d.image ? (
                              <img src={d.image} alt={d.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">{d.subtitle}</p>
                            <h3
                              className="font-medium truncate cursor-pointer hover:text-primary"
                              onClick={() => detailHref && navigate(detailHref)}
                            >
                              {d.title}
                            </h3>
                            <p className="text-lg font-bold text-primary mt-1">
                              R{lineTotal.toFixed(2)}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                <Button variant="outline" size="sm" onClick={clearCart} className="text-destructive">
                  Clear Cart
                </Button>
              </div>

              {/* Order Summary */}
              <div>
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal ({items.length} items)</span>
                      <span>R{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="text-primary font-medium">To be confirmed</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="text-primary">R{total.toFixed(2)}</span>
                    </div>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => navigate("/checkout")}
                    >
                      Proceed to Checkout
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Cash on Delivery • PayFast coming soon
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Cart;
