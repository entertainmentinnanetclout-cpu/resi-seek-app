import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Building2, Home, HeartHandshake, ShieldCheck, HelpCircle } from "lucide-react";

export const Living: React.FC = () => {
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
            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-8 space-y-4">
                <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-500 grid place-items-center">
                  <Building2 className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold">Student Accommodation</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Verified university and TVET college residences close to campus. Secure your perfect space today.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/living/student-accommodation">Explore Residences</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-8 space-y-4">
                <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 grid place-items-center">
                  <Home className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold">Private Rentals</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Single rooms, bachelor units, or shared apartments designed for students, young professionals, and private tenants.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/living/private-rentals">Browse Rentals</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-8 space-y-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 grid place-items-center">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold">Parent & Guardian Support</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Guidance, off-campus lodging tips, and support services to ensure safety, security, and peace of mind.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/living/parents">Parent Portal</Link>
                </Button>
              </CardContent>
            </Card>
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