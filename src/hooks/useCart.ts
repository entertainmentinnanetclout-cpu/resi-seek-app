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

    // Fetch items + linked product / hamper / hamper_item details
    const { data: cartItems } = await supabase
      .from("cart_items" as any)
      .select(
        `*,
        products(id, name, price, compare_at_price, images, stock_quantity, stores(store_name)),
        hampers(id, name, price, image_url, stock_quantity),
        hamper_items(id, name, price, image_url, stock_quantity)`
      )
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
    const price = unitPriceOf(item);
    return sum + Number(price) * (item.quantity || 1);
  }, 0);

  return { items, isLoading, total, cartId, updateQuantity, removeItem, clearCart, refetch: fetchCart };
}

/** Resolve a unit price for any cart item type. */
export function unitPriceOf(item: any): number {
  if (item.unit_price != null) return Number(item.unit_price);
  if (item.item_type === "hamper") return Number(item.hampers?.price || 0);
  if (item.item_type === "hamper_item") return Number(item.hamper_items?.price || 0);
  return Number(item.products?.price || 0);
}

/** Resolve a display title/image for any cart item. */
export function displayOf(item: any): { title: string; image?: string; subtitle?: string } {
  if (item.item_type === "hamper") return {
    title: item.title_snapshot || item.hampers?.name || "Hamper",
    image: item.image_snapshot || item.hampers?.image_url,
    subtitle: "Hamper bundle",
  };
  if (item.item_type === "hamper_item") return {
    title: item.title_snapshot || item.hamper_items?.name || "Item",
    image: item.image_snapshot || item.hamper_items?.image_url,
    subtitle: "Hamper item",
  };
  return {
    title: item.products?.name || "Product",
    image: item.products?.images?.[0],
    subtitle: item.products?.stores?.store_name,
  };
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

/** Get-or-create the cart for the current user, returns cart id. */
async function ensureCart(userId: string): Promise<string | null> {
  const { data: cart } = await supabase
    .from("cart" as any).select("id").eq("user_id", userId).maybeSingle();
  if (cart) return (cart as any).id;
  const { data: newCart } = await supabase
    .from("cart" as any).insert({ user_id: userId } as any).select("id").single();
  return newCart ? (newCart as any).id : null;
}

/** Add a hamper to cart. */
export function useAddHamperToCart() {
  const { user } = useAuth();
  return async (hamper: { id: string; name: string; price: number; image_url?: string | null }, quantity = 1) => {
    if (!user) { toast.error("Please sign in"); return false; }
    const cartId = await ensureCart(user.id);
    if (!cartId) { toast.error("Cart unavailable"); return false; }
    const { data: existing } = await supabase
      .from("cart_items" as any).select("id, quantity")
      .eq("cart_id", cartId).eq("hamper_id", hamper.id).eq("item_type", "hamper").maybeSingle();
    if (existing) {
      await supabase.from("cart_items" as any).update({ quantity: (existing as any).quantity + quantity } as any).eq("id", (existing as any).id);
    } else {
      await supabase.from("cart_items" as any).insert({
        cart_id: cartId, item_type: "hamper", hamper_id: hamper.id,
        quantity, unit_price: hamper.price,
        title_snapshot: hamper.name, image_snapshot: hamper.image_url || null,
      } as any);
    }
    toast.success(`${hamper.name} added to cart`);
    return true;
  };
}

/** Add a hamper-catalog item (single) to cart. */
export function useAddHamperItemToCart() {
  const { user } = useAuth();
  return async (item: { id: string; name: string; price: number; image_url?: string | null }, quantity = 1) => {
    if (!user) { toast.error("Please sign in"); return false; }
    const cartId = await ensureCart(user.id);
    if (!cartId) { toast.error("Cart unavailable"); return false; }
    const { data: existing } = await supabase
      .from("cart_items" as any).select("id, quantity")
      .eq("cart_id", cartId).eq("hamper_item_id", item.id).eq("item_type", "hamper_item").maybeSingle();
    if (existing) {
      await supabase.from("cart_items" as any).update({ quantity: (existing as any).quantity + quantity } as any).eq("id", (existing as any).id);
    } else {
      await supabase.from("cart_items" as any).insert({
        cart_id: cartId, item_type: "hamper_item", hamper_item_id: item.id,
        quantity, unit_price: item.price,
        title_snapshot: item.name, image_snapshot: item.image_url || null,
      } as any);
    }
    toast.success(`${item.name} added to cart`);
    return true;
  };
}
