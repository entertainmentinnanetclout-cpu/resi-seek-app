import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Briefcase, CheckCircle2, UserCheck, Shield } from "lucide-react";

export const OpportunitiesWil: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Workplace Integrated Learning (WIL) Placement Support"
        description="Assisting South African TVET (N6) and University of Technology students with workplace placement support, logbook compliance, and mentorship."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <Briefcase className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-4xl font-extrabold tracking-tight">
              Workplace Integrated Learning (WIL) Support
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Prepare for the practical experience component of your qualification. ResKonnect supports WIL readiness, partner engagement and available placement pathways; actual placement depends on current host capacity and confirmed programme requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">Bridge the Practical Experience Gap</h2>
              <p className="text-muted-foreground leading-relaxed">
                Many TVET and University of Technology students need workplace experience as part of their qualification journey. ResKonnect helps organise readiness information, documents and verified host opportunities when they are available, without promising a placement that depends on a third party.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Current host and programme requirements are confirmed before a placement is presented as available</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Readiness and logbook support where the programme or host requires it</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Soft skills readiness training and CV review</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link to="/get-started?persona=wil_applicant&need=wil_support">Apply for WIL Support</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/recruit">Join Recruiter Program</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Card className="border-border/80">
                <CardContent className="p-6 flex gap-4 items-start">
                  <UserCheck className="h-10 w-10 text-primary shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm">Graduation Readiness</h3>
                    <p className="text-xs text-muted-foreground mt-1">Keep your WIL readiness information and required records organised while following the official institution and host process.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardContent className="p-6 flex gap-4 items-start">
                  <Shield className="h-10 w-10 text-primary shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm">Safe Working Environments</h3>
                    <p className="text-xs text-muted-foreground mt-1">Safety, compliance, transport and stipend terms must be confirmed with the host and relevant programme before placement.</p>
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

export default OpportunitiesWil;