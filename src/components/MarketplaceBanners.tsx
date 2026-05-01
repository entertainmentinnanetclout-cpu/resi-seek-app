import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Banner {
  id: string;
  title: string;
  subtitle?: string | null;
  image_url: string;
  cta_text?: string | null;
  cta_link?: string | null;
  category_slug?: string | null;
}

interface Props {
  placement: "hero" | "category" | "campaign";
  categorySlug?: string;
  className?: string;
}

const MarketplaceBanners = ({ placement, categorySlug, className }: Props) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      let query = supabase
        .from("marketplace_banners" as any)
        .select("*")
        .eq("is_active", true)
        .eq("placement", placement)
        .order("display_order", { ascending: true });
      if (placement === "category" && categorySlug) {
        query = query.eq("category_slug", categorySlug);
      }
      const { data } = await query;
      setBanners((data as any[]) || []);
    };
    load();
  }, [placement, categorySlug]);

  // Auto-rotate
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setActive((a) => (a + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const b = banners[active];

  const handleCta = () => {
    if (!b.cta_link) return;
    if (b.cta_link.startsWith("http")) window.open(b.cta_link, "_blank");
    else navigate(b.cta_link);
  };

  return (
    <Card className={`overflow-hidden relative ${className || ""}`}>
      <div
        className="aspect-[16/6] sm:aspect-[16/5] bg-cover bg-center relative"
        style={{ backgroundImage: `url(${b.image_url})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
        <div className="relative h-full flex flex-col justify-center p-6 sm:p-8 max-w-xl">
          <h2 className="text-white text-2xl sm:text-4xl font-bold drop-shadow">{b.title}</h2>
          {b.subtitle && <p className="text-white/90 mt-2 text-sm sm:text-base drop-shadow">{b.subtitle}</p>}
          {b.cta_text && b.cta_link && (
            <div>
              <Button onClick={handleCta} className="mt-3" size="sm">{b.cta_text}</Button>
            </div>
          )}
        </div>
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

export default MarketplaceBanners;