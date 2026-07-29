import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { HeartHandshake, ShieldCheck, PhoneCall, HelpCircle } from "lucide-react";

export const Parents: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Parent & Guardian Support | Secure Off-Campus Housing"
        description="Comprehensive guidance, checklist verifications, and advisory services for parents looking for secure student accommodation."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Parent & Guardian Support Center
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Ensure your child's safety and academic comfort. We verify off-campus properties, review leases, and check amenities so you can choose with peace of mind.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">Your Child's Security is Our Top Priority</h2>
              <p className="text-muted-foreground leading-relaxed">
                Finding the right student residence from a distance is challenging. Our support center provides parents and guardians with tools to double-check lease agreements, verify safety certifications, estimate travel distances to campus, and secure payments without risking deposit scams.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold">Verified off-campus lodging safety clearances</span>
                </div>
                <div className="flex items-start gap-3">
                  <PhoneCall className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold">Direct 24/7 emergency support channels for students</span>
                </div>
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold">Free consultation with our accommodation advisory specialists</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link to="/get-started?persona=parent_guardian&need=accommodation">Initiate Onboarding Check</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/find">Browse Verified Res</Link>
                </Button>
              </div>
            </div>

            <div className="bg-muted/40 rounded-2xl p-8 border border-border">
              <h3 className="font-bold text-xl mb-4 text-foreground">Common Parent Questions</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm">How do you verify properties?</h4>
                  <p className="text-xs text-muted-foreground mt-1">Our field team conducts physical audits of security guards, biocontrol gates, and basic health clearances before listing.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">How do deposits work?</h4>
                  <p className="text-xs text-muted-foreground mt-1">All booking transactions and reservation payments are held safely under compliance standards to eliminate deposit fraud.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Can I request transport guides?</h4>
                  <p className="text-xs text-muted-foreground mt-1">Yes. Many of our listed residences host dedicated student shuttle services to TUT, UP, and major campuses daily.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default Parents;