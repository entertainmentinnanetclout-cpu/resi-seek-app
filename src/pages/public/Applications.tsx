import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileText, School, GraduationCap, ClipboardCheck, Sparkles } from "lucide-react";
import ComplianceDisclaimer from "@/components/onboarding/ComplianceDisclaimer";

export const Applications: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Application Support & Readiness Portal"
        description="Comprehensive guidance, readiness calculators, documents prep, and institution guidance support portal."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Tertiary Application Support
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Prepare for your academic future with ResKonnect. Check your APS score, organise compliance documents, and learn about college admission pathways easily.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <ComplianceDisclaimer />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto pt-6">
            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <School className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">TVET Colleges</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clear, guided pathways for NATED and National Certificate Vocational programs at public TVETs.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/applications/tvet">Guidance Portal &rarr;</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <GraduationCap className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Universities</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Understand dynamic Bachelor, Diploma, and Higher Certificate requirements across universities.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/applications/university">Guidance Portal &rarr;</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <FileText className="h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Private Colleges</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Flexible accredited qualifications, technical diplomas, and shorter courses at leading private campuses.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/applications/private-college">Guidance Portal &rarr;</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all border-border/80">
              <CardContent className="p-6 space-y-3">
                <ClipboardCheck className="h-10 w-10 text-primary animate-pulse" />
                <h2 className="text-lg font-bold">APS Checker</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter your grades and instantly estimate your South African NSC Admission Point Score.
                </p>
                <Button asChild variant="link" className="p-0 text-primary">
                  <Link to="/applications/checker">Calculate Score &rarr;</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-8 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Ready to find accommodation?
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Once you know where you want to study, start matching with accredited student housing options adjacent to campus.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/get-started?persona=student&need=accommodation">Match Off-Campus Lodging</Link>
            </Button>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default Applications;