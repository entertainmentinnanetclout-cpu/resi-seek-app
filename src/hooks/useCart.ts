import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useCartCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    fetchCount();
  }, [user]);

  const fetchCount = async () => {
    if (!user) return;
    const { data: cart } = await supabase
      .from("cart" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!cart) { setCount(0); return; }
    const { count: itemCount } = await supabase
      .from("cart_items" as any)
      .select("*", { count: "exact", head: true })
      .eq("cart_id", (cart as any).id);
    setCount(itemCount || 0);
  };

  return count;
}

export function useCart() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cartId, setCartId] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    if (!user) { setItems([]); setIsLoading(false); return; }
    setIsLoading(true);

    // Get or create cart
    let { data: cart } = await supabase
      .from("cart" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!cart) {
      const { data: newCart } = await supabase
        .from("cart" as any)
        .insert({ user_id: user.id } as any)
        .select("id")
        .single();
      cart = newCart;
    }

    if (!cart) { setIsLoading(false); return; }
    setCartId((cart as any).id);

    // Fetch items with product details
    const { data: cartItems } = await supabase
      .from("cart_items" as any)
      .select("*, products(id, name, price, compare_at_price, images, stock_quantity, stores(store_name))")
      .eq("cart_id", (cart as any).id);

    setItems(cartItems || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      await removeItem(itemId);
      return;
    }
    await supabase.from("cart_items" as any).update({ quantity } as any).eq("id", itemId);
    fetchCart();
  };

  const removeItem = async (itemId: string) => {
    await supabase.from("cart_items" as any).delete().eq("id", itemId);
    fetchCart();
    toast.success("Item removed from cart");
  };

  const clearCart = async () => {
    if (!cartId) return;
    await supabase.from("cart_items" as any).delete().eq("cart_id", cartId);
    fetchCart();
  };

  const total = items.reduce((sum: number, item: any) => {
    const price = item.products?.price || 0;
    return sum + Number(price) * (item.quantity || 1);
  }, 0);

  return { items, isLoading, total, cartId, updateQuantity, removeItem, clearCart, refetch: fetchCart };
}

export function useAddToCart() {
  const { user } = useAuth();

  return async (productId: string, variantId: string | null, quantity: number = 1) => {
    if (!user) { toast.error("Please sign in"); return; }

    // Get or create cart
    let { data: cart } = await supabase
      .from("cart" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!cart) {
      const { data: newCart } = await supabase
        .from("cart" as any)
        .insert({ user_id: user.id } as any)
        .select("id")
        .single();
      cart = newCart;
    }

    if (!cart) { toast.error("Failed to create cart"); return; }

    // Check if item already in cart
    const query = supabase
      .from("cart_items" as any)
      .select("id, quantity")
      .eq("cart_id", (cart as any).id)
      .eq("product_id", productId);

    if (variantId) {
      query.eq("variant_id", variantId);
    } else {
      query.is("variant_id", null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      await supabase
        .from("cart_items" as any)
        .update({ quantity: (existing as any).quantity + quantity } as any)
        .eq("id", (existing as any).id);
    } else {
      const item: any = {
        cart_id: (cart as any).id,
        product_id: productId,
        quantity,
      };
      if (variantId) item.variant_id = variantId;
      await supabase.from("cart_items" as any).insert(item);
    }
  };
}
