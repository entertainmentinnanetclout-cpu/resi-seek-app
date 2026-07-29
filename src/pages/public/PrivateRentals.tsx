import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Home, Compass, UserCheck, ShieldAlert } from "lucide-react";

export const PrivateRentals: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Private Rentals | Bachelor Rooms, Shared & Single Apartments"
        description="Browse premium private rentals, bachelor rooms, single rooms, and shared apartments with ResKonnect."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Private Rentals & Bachelor Rooms
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Find flexible, high-quality, and affordable off-campus private housing options. Secure single rooms, bachelor units, shared apartments, or short-term stays today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-border/80">
                <CardContent className="p-6 space-y-2">
                  <Home className="h-6 w-6 text-primary" />
                  <h3 className="font-bold text-sm">Bachelor Apartments</h3>
                  <p className="text-xs text-muted-foreground">Self-contained comfortable rooms with private kitchenettes and ensuite bathrooms.</p>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardContent className="p-6 space-y-2">
                  <Compass className="h-6 w-6 text-primary" />
                  <h3 className="font-bold text-sm">Single & Shared Rooms</h3>
                  <p className="text-xs text-muted-foreground">Budget-friendly cozy rooms featuring communal laundry and kitchen access.</p>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardContent className="p-6 space-y-2">
                  <UserCheck className="h-6 w-6 text-primary" />
                  <h3 className="font-bold text-sm">Flexible Leases</h3>
                  <p className="text-xs text-muted-foreground">Options supporting short-term stays, internships, and annual student-friendly agreements.</p>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardContent className="p-6 space-y-2">
                  <ShieldAlert className="h-6 w-6 text-primary" />
                  <h3 className="font-bold text-sm">Verified Listings Only</h3>
                  <p className="text-xs text-muted-foreground">Preventing scams with pre-vetted landlords and secure portal payment integrations.</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">Premium Private Options</h2>
              <p className="text-muted-foreground leading-relaxed">
                Whether you are a postgraduate student, private tenant, young professional, or need a comfortable space during internships, ResKonnect helps filter the noise of finding quality properties in safe neighborhoods.
              </p>

              <div className="pt-2 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link to="/get-started?persona=private_tenant&need=private_rental">Find a Private Rental</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/find">Browse Map View</Link>
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default PrivateRentals;