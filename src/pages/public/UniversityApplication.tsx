import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import ComplianceDisclaimer from "@/components/onboarding/ComplianceDisclaimer";

export const UniversityApplication: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="University Application Guidance | APS & Subject Requirements"
        description="Detailed guide for South African public university applications. Understand Minimum Admission Requirements, Bachelor thresholds, and APS computation rules."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <GraduationCap className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-4xl font-extrabold tracking-tight">
              University Applications & Entry Guidance
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Achieve your academic dreams. Learn about minimum statutory requirements, subject specific thresholds, and computed APS parameters for various degree paths.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <ComplianceDisclaimer />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mx-auto pt-6">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">University Admission Frameworks</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                South African universities require specific statutory passes on your NSC (National Senior Certificate) to qualify for different levels of tertiary learning.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Bachelor Degree Entry</h4>
                    <p className="text-xs text-muted-foreground mt-1">Requires an NSC pass with at least 50% (Level 4) in four recognized subjects.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Diploma Entry</h4>
                    <p className="text-xs text-muted-foreground mt-1">Requires an NSC pass with at least 40% (Level 3) in four recognized subjects.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/40 rounded-2xl p-6 border border-border space-y-4">
              <h3 className="font-bold text-lg">Document Readiness Checklist</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Make sure you have certified copies of these standard requirements ready to complete official registration online:
              </p>
              <ul className="space-y-2 text-xs font-medium">
                <li className="flex items-center gap-2">✔ Certified ID copy of the prospective student</li>
                <li className="flex items-center gap-2">✔ Certified copy of Grade 11 final report or Grade 12 Matric certificate</li>
                <li className="flex items-center gap-2">✔ Certified copy of parent/guardian ID</li>
                <li className="flex items-center gap-2">✔ Proof of residential address</li>
              </ul>
              <div className="pt-4 space-y-2">
                <Button asChild className="w-full">
                  <Link to="/applications/checker">Go to APS Calculator</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/get-started?persona=applicant&need=application_support">Request Application Support</Link>
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default UniversityApplication;