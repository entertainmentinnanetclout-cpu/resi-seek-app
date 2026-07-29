import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Landmark, CheckCircle2, ShieldCheck, Cpu, Sparkles } from "lucide-react";

export const PartnersInstitutions: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Institution & Business Solutions | Student Portals"
        description="Empower your campus or business with ResKonnect. Digital systems, customized student portals, and coordinated campus campaigns."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <Landmark className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-4xl font-extrabold tracking-tight">
              Institution & Business Solutions
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Empower student communities, coordinate placement campaigns, and automate off-campus lodging operations with customizable enterprise portals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-border/80">
                <CardContent className="p-6 space-y-2">
                  <Cpu className="h-6 w-6 text-primary" />
                  <h3 className="font-bold text-sm">Student Portals</h3>
                  <p className="text-xs text-muted-foreground">White-labeled portal architectures hosting news, events, and room-search modules.</p>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardContent className="p-6 space-y-2">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  <h3 className="font-bold text-sm">Accommodation Audit</h3>
                  <p className="text-xs text-muted-foreground">Secure student safety standard records across external landlord properties.</p>
                </CardContent>
              </Card>

              <Card className="border-border/80 col-span-1 sm:col-span-2">
                <CardContent className="p-6 flex items-center gap-4">
                  <Sparkles className="h-10 w-10 text-yellow-500 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm">SETA & WIL Alignments</h3>
                    <p className="text-xs text-muted-foreground">Automate TVET placement matching and track logbook progress directly with SETA stakeholders.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">Scale Your Tertiary Operations</h2>
              <p className="text-muted-foreground leading-relaxed">
                Modern student management requires reliable, responsive, and secure software. ResKonnect assists public universities, TVET colleges, and private providers with customized student administration portals.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Consolidated dashboarding for student advisors</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Secure database backups and POPIA compliant data pipelines</span>
                </div>
              </div>

              <div className="pt-2">
                <Button asChild size="lg">
                  <Link to="/get-started?persona=institution_business&need=partner_solution">Connect with Operations</Link>
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default PartnersInstitutions;