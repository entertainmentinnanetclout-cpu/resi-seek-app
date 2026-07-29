import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, CheckCircle2 } from "lucide-react";
import ComplianceDisclaimer from "@/components/onboarding/ComplianceDisclaimer";

export const PrivateCollegeApplication: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Private College Application Guidance | Entry Requirements"
        description="Detailed guide for South African private college applications. Learn about specialized diplomas, short courses, and technical pathways."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <FileText className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-4xl font-extrabold tracking-tight">
              Private College Applications & Entry Guidance
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Explore specialized vocational learning. Understand flexible entry requirements, shorter diplomas, and targeted trade courses at private institutions.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <ComplianceDisclaimer />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mx-auto pt-6">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Why Choose a Private College?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Private colleges and institutes offer specialized study fields (such as Digital Arts, culinary programs, or premium software development camps) with smaller class sizes, flexible schedules, and direct industry pipeline connections.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Flexible Mid-Year Intakes</h4>
                    <p className="text-xs text-muted-foreground mt-1">Many private institutions host multiple intake periods instead of a single annual window.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Specialized Focus</h4>
                    <p className="text-xs text-muted-foreground mt-1">Acquire technical and workplace skills faster through industry-aligned diplomas.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/40 rounded-2xl p-6 border border-border space-y-4">
              <h3 className="font-bold text-lg">Document Readiness Checklist</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ensure you have certified copies of these basic requirements ready to upload to the official registration system:
              </p>
              <ul className="space-y-2 text-xs font-medium">
                <li className="flex items-center gap-2">✔ Certified copy of applicant’s South African Identity Document (ID)</li>
                <li className="flex items-center gap-2">✔ Certified copy of latest academic results or Matric certificate</li>
                <li className="flex items-center gap-2">✔ Certified copy of parent/guardian ID</li>
                <li className="flex items-center gap-2">✔ Proof of residence</li>
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

export default PrivateCollegeApplication;