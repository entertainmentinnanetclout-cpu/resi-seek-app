import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, Award, Zap, TrendingUp } from "lucide-react";

export const PartnersLandlords: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Landlord Partnerships | Premium Accommodation Leads"
        description="List your student accommodation with ResKonnect. Reach thousands of university, TVET, and private college students instantly."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <Building2 className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-4xl font-extrabold tracking-tight">
              Landlord & Property Owner Solutions
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Maximize occupancy and minimize administrative headaches. Access vetted student and young professional leads with robust lease management systems.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">Fill Your Rooms Quickly</h2>
              <p className="text-muted-foreground leading-relaxed">
                ResKonnect isn’t just a classifieds page; it's an enterprise property gateway. We assist with accreditation checklists, target student marketing, trial application pipelines, and rent tracking integrations.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Pre-screened tenant credentials and roommate profiling</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Direct integration with South African bursary funds</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Robust landlord reporting and analytics panels</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link to="/get-started?persona=landlord&need=property_listing">List My Accommodation</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/auth">Owner Sign In</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-border/80">
                <CardContent className="p-6 space-y-2">
                  <Zap className="h-6 w-6 text-primary" />
                  <h3 className="font-bold text-sm">Instant Leads</h3>
                  <p className="text-xs text-muted-foreground">Match with students actively seeking rooms near your specific campus location.</p>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardContent className="p-6 space-y-2">
                  <Award className="h-6 w-6 text-primary" />
                  <h3 className="font-bold text-sm">Accreditation Support</h3>
                  <p className="text-xs text-muted-foreground">Receive clear structural audit templates to ensure compliance guidelines are met.</p>
                </CardContent>
              </Card>

              <Card className="border-border/80 col-span-1 sm:col-span-2">
                <CardContent className="p-6 flex items-center gap-4">
                  <TrendingUp className="h-10 w-10 text-emerald-500 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm">Scale Your Business</h3>
                    <p className="text-xs text-muted-foreground">Manage single apartments, multi-story residences, or city-wide property portals under one centralized account.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default PartnersLandlords;