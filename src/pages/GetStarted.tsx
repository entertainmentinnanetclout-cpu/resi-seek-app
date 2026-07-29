import React from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import GuidedOnboardingFlow from "@/components/onboarding/GuidedOnboardingFlow";

const GetStarted: React.FC = () => {
  return (
    <PublicLayout>
      <SEO
        title="Get Started | Onboarding Guidance"
        description="Begin your premium ResKonnect guided onboarding journey. Get assistance with Student Accommodation, WIL Support, Application Guidance, and Partner Solutions."
      />
      <div className="bg-gradient-to-b from-background via-muted/20 to-background min-h-[80vh] flex items-center py-10">
        <div className="container mx-auto">
          <GuidedOnboardingFlow />
        </div>
      </div>
    </PublicLayout>
  );
};

export default GetStarted;