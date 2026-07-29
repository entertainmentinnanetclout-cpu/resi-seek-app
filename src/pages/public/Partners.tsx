import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Building2, Building, Award, Briefcase, Landmark } from "lucide-react";

export const Partners: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Partners Portal | Landlords & Institutions"
        description="Collaborate with ResKonnect. Build property portals, host student accommodation, manage TVET campaigns, and coordinate WIL placements."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              ResKonnect Partners Network
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              We connect property owners, public institutions, and corporate businesses to create a seamless tertiary support ecosystem nationwide.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <Building2 className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Landlords</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  List student accommodations, fill beds, verify student credentials, and receive digital dashboard support.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/partners/landlords">Landlord Portal &rarr;</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <Landmark className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Institutions</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Partner with universities, TVET colleges, and private campuses to organize intake programs and portals.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/partners/institutions">Institution Portal &rarr;</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <Award className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Recruiters</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Become a registered student affiliate agent. Help students find housing or study tracks, and earn R200 per placement.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/recruit">Recruiter Portal &rarr;</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <Building className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Property Portals</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Deploy custom-branded, scalable multi-property portals to centralize large-scale property management operations.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/get-started?persona=landlord&need=partner_solution">View Portals &rarr;</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="bg-muted/40 rounded-2xl p-8 border border-border max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Explore Tailored Solutions</h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Ready to coordinate integration systems or partner with ResKonnect? Connect with our enterprise digital operations team.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/get-started?persona=institution_business&need=partner_solution">Get Started</Link>
            </Button>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default Partners;