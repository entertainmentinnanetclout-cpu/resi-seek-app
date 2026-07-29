import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { School, CheckCircle2 } from "lucide-react";
import ComplianceDisclaimer from "@/components/onboarding/ComplianceDisclaimer";

export const TvetApplication: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="TVET College Application Guidance | Entry Requirements"
        description="Detailed guide for South African public TVET college applications. Learn about NATED engineering courses, business management, and occupational programs."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <School className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-4xl font-extrabold tracking-tight">
              TVET College Applications & Entry Guidance
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Clear roadmaps for prospective Technical and Vocational Education and Training (TVET) students. Discover career pathways and document preparedness rules.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <ComplianceDisclaimer />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mx-auto pt-6">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Understanding TVET Courses</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                TVET colleges offer highly practical, skill-focused qualifications under two primary frameworks: NATED (National Accredited Technical Education Diploma) courses which focus on engineering, business, or utility studies; and NC(V) (National Certificate Vocational) pathways which accommodate students who finished Grade 9.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Engineering Studies (N1 - N6)</h4>
                    <p className="text-xs text-muted-foreground mt-1">Requires Grade 12 or N3. Leads to official qualification certificates.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Business & Utility Studies (N4 - N6)</h4>
                    <p className="text-xs text-muted-foreground mt-1">Requires Grade 12. Ideal for marketing, HR, hospitality, and admin.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/40 rounded-2xl p-6 border border-border space-y-4">
              <h3 className="font-bold text-lg">Document Readiness Checklist</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Prepare these certified documents before uploading them to the official institution application portal:
              </p>
              <ul className="space-y-2 text-xs font-medium">
                <li className="flex items-center gap-2">✔ Certified copy of applicant’s South African Identity Document (ID)</li>
                <li className="flex items-center gap-2">✔ Certified copy of parent/guardian’s ID</li>
                <li className="flex items-center gap-2">✔ Certified copy of latest academic results or Matric certificate</li>
                <li className="flex items-center gap-2">✔ Proof of residential address (not older than 3 months)</li>
              </ul>
              <div className="pt-4">
                <Button asChild className="w-full">
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

export default TvetApplication;