import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CheckCircle2, MapPin, Building, ShieldCheck } from "lucide-react";

export const StudentAccommodation: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Student Accommodation | Campus Living Options"
        description="Browse premium, campus-adjacent, and verified student accommodation listings across South Africa. Welcoming TUT, UP, TVET, and Private College students."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Student Accommodation Hub
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Skip the stress of finding a place to stay. Browse accredited and verified residences with dynamic roommate matchmakers, student-centric amenities, and direct online application flows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">Premium Spaces Close to Campus</h2>
              <p className="text-muted-foreground leading-relaxed">
                Whether you prefer single rooms, shared options, or modern bachelor suites, our listings offer comprehensive details including security structures, Wi-Fi coverage, study lounges, transport links, and recreational spaces.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">24/7 Security & Access Control systems</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Uncapped Wi-Fi, Water & Electricity setups</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">NSFAS Accredited Off-Campus spaces</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                <Button asChild size="lg">
                  <Link to="/find">Browse Residences</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/get-started?persona=student&need=accommodation">Get Guided Onboarding</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-card border-border/80">
                <CardContent className="p-6 text-center space-y-2">
                  <Building className="h-8 w-8 mx-auto text-primary" />
                  <h3 className="font-bold text-base">Verified Res</h3>
                  <p className="text-xs text-muted-foreground">Strict health, safety & luxury standard inspections.</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/80">
                <CardContent className="p-6 text-center space-y-2">
                  <MapPin className="h-8 w-8 mx-auto text-primary" />
                  <h3 className="font-bold text-base">Walk to Class</h3>
                  <p className="text-xs text-muted-foreground">Most options located within 1km radius of campuses.</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/80 col-span-2">
                <CardContent className="p-6 flex items-center gap-4">
                  <ShieldCheck className="h-10 w-10 text-emerald-500 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm">NSFAS & Bursary Funding Friendly</h3>
                    <p className="text-xs text-muted-foreground">Find properties accommodating different financial channels easily.</p>
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

export default StudentAccommodation;