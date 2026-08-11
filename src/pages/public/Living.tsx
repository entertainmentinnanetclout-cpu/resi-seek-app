import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Home, HeartHandshake, ArrowRight, GraduationCap, School, Wallet, ShieldCheck, ImageOff } from "lucide-react";
import { useUserIntent } from "@/contexts/UserIntentContext";
import { useCategoryCardConfigs, type ResolvedCategoryCard } from "@/hooks/useCategoryCardConfigs";

const CARD_ICONS: Record<string, typeof Building2> = {
  student_accommodation: Building2,
  university_accommodation: GraduationCap,
  tvet_accommodation: School,
  nsfas_residences: ShieldCheck,
  private_paying_student: Wallet,
  private_rentals: Home,
  parent_guidance: HeartHandshake,
};

export const Living: React.FC = () => {
  const navigate = useNavigate();
  const { setIntent } = useUserIntent();
  const { cards, isLoading } = useCategoryCardConfigs();

  const choose = (card: ResolvedCategoryCard) => {
    setIntent(card.intent);
    navigate(card.route_path);
  };

  return (
    <PublicLayout>
      <SEO
        title="Living Solutions | Student Accommodation & Private Rentals"
        description="Premium connected living with ResKonnect. Explore university residences, TVET-friendly housing, single bachelor apartments, parent support resources, and property listings."
      />

      <div className="bg-gradient-to-b from-primary/5 via-background to-background py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Connected Living Solutions
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Find safe, verified, and community-centric student accommodation and private rentals. ResKonnect is South Africa’s ultimate gateway to high-quality spaces.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {isLoading &&
              [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)}

            {!isLoading && cards.map((card) => {
              const Icon = CARD_ICONS[card.card_key] ?? Building2;
              return (
                <Card
                  key={card.id}
                  className="group overflow-hidden border-border/80 transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <button type="button" onClick={() => choose(card)} className="block w-full text-left">
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.imageAlt}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                          <ImageOff className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/25 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-white backdrop-blur-sm">
                          <Icon className="h-5 w-5" />
                        </span>
                        <h2 className="text-lg font-bold text-white">{card.title}</h2>
                      </div>
                    </div>
                  </button>
                  <CardContent className="p-6 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
                    <Button variant="outline" className="w-full" onClick={() => choose(card)}>
                      {card.cta_label || "Explore"} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Are you a property owner?</h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Advertise your rooms, connect directly with verified students and tenants, and manage bookings effortlessly with ResKonnect’s landlord dashboard.
              </p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link to="/get-started?persona=landlord&need=property_listing">List Your Property</Link>
            </Button>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default Living;
