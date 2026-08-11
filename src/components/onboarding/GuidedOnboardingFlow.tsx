import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PersonaSelector from "./PersonaSelector";
import NeedSelector, { getNeedOptions } from "./NeedSelector";
import OnboardingForm from "./OnboardingForm";
import OnboardingSummaryCard from "./OnboardingSummaryCard";
import IntentQuickStep from "./IntentQuickStep";
import MatchingResidencesPreview from "./MatchingResidencesPreview";
import { useUserIntent } from "@/contexts/UserIntentContext";
import type { Persona, Need, OnboardingRequest } from "@/lib/onboarding/onboardingTypes";
import { submitOnboardingRequest } from "@/lib/onboarding/onboardingAdapter";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const GuidedOnboardingFlow: React.FC = () => {
  const [searchParams] = useSearchParams();

  const { setIntent, completeGuide, skipGuide } = useUserIntent();

  // Step machine: 1 Persona, 2 Need, 3 Intent details, 6 Matching results, 4 Form, 5 Summary
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [selectedNeedOption, setSelectedNeedOption] = useState<string | null>(null);
  const [resolvedNeed, setResolvedNeed] = useState<Need | null>(null);
  const [completedRecord, setCompletedRecord] = useState<OnboardingRequest | null>(null);

  // Prepopulate step 1 & 2 from query parameters if present
  useEffect(() => {
    const personaParam = searchParams.get("persona") as Persona | null;
    const needParam = searchParams.get("need") as Need | null;

    if (personaParam) {
      setSelectedPersona(personaParam);

      const options = getNeedOptions(personaParam);
      if (needParam) {
        // Look up corresponding need option
        const matched = options.find((o) => o.need === needParam);
        if (matched) {
          setSelectedNeedOption(matched.value);
          setResolvedNeed(matched.need);
          setStep(3); // skip right to intent details
          return;
        }
      }
      setStep(2); // advance to need selection
    }
  }, [searchParams]);

  const handlePersonaChange = (p: Persona) => {
    setSelectedPersona(p);
    setSelectedNeedOption(null);
    setResolvedNeed(null);
    setStep(2);
  };

  const handleNeedChange = (opt: { value: string; need: Need }) => {
    setSelectedNeedOption(opt.value);
    setResolvedNeed(opt.need);
    setIntent({ persona: selectedPersona ?? undefined, primary_need: opt.need });
    setStep(3);
  };

  const handleFormSubmit = async (formData: {
    full_name: string;
    phone: string;
    whatsapp_number: string;
    email: string;
    consent_to_be_contacted: boolean;
    popia_consent: boolean;
    details: Record<string, string | number | boolean | undefined>;
  }) => {
    if (!selectedPersona || !resolvedNeed) {
      toast.error("Missing onboarding context. Please start over.");
      setStep(1);
      return;
    }

    try {
      const record = await submitOnboardingRequest({
        persona: selectedPersona,
        need: resolvedNeed,
        full_name: formData.full_name,
        phone: formData.phone,
        whatsapp_number: formData.whatsapp_number,
        email: formData.email,
        consent_to_be_contacted: formData.consent_to_be_contacted,
        popia_consent: formData.popia_consent,
        details: formData.details,
      });

      setCompletedRecord(record);
      completeGuide();
      setStep(5);
      toast.success("Onboarding checklist submitted successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit onboarding request. Please try again.");
    }
  };

  const handleBack = () => {
    if (step === 4) setStep(showResultsFirst ? 6 : 3);
    else if (step === 6) setStep(3);
    else if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  // Accommodation-style journeys browse real places before any form.
  const showResultsFirst =
    resolvedNeed === "accommodation" || resolvedNeed === "private_rental";

  const renderStepTitleAndSubtitle = () => {
    switch (step) {
      case 1:
        return {
          title: "Get Started on ResKonnect",
          subtitle: "Tell us who you are so we can route you to the right services.",
        };
      case 2:
        return {
          title: "What do you need help with?",
          subtitle: "Choose the service or support that best matches your immediate goal.",
        };
      case 3:
        return {
          title: "A few quick details",
          subtitle: "This personalises your listings, filters and dashboard. You can skip it.",
        };
      case 6:
        return {
          title: "Here are places that match you",
          subtitle: "Browse first. Forms only come after you choose — or ask us for help directly.",
        };
      case 4:
        return {
          title: "Complete Your Support Request",
          subtitle: "Provide your details. Our platform will guide you and prepare options.",
        };
      case 5:
      default:
        return null;
    }
  };

  const headerInfo = renderStepTitleAndSubtitle();

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {headerInfo && (
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {headerInfo.title}
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            {headerInfo.subtitle}
          </p>
        </div>
      )}

      {step === 1 && (
        <Card className="shadow-lg border-muted">
          <CardContent className="p-6">
            <PersonaSelector value={selectedPersona} onChange={handlePersonaChange} />
          </CardContent>
        </Card>
      )}

      {step === 2 && selectedPersona && (
        <Card className="shadow-lg border-muted">
          <CardContent className="p-6 space-y-4">
            <NeedSelector
              persona={selectedPersona}
              value={selectedNeedOption}
              onChange={handleNeedChange}
            />
            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleBack}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; Back to Persona selection
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && selectedPersona && resolvedNeed && (
        <IntentQuickStep
          persona={selectedPersona}
          need={resolvedNeed}
          onBack={handleBack}
          onSkip={() => {
            skipGuide();
            setStep(showResultsFirst ? 6 : 4);
          }}
          onContinue={(partial) => {
            setIntent(partial);
            setStep(showResultsFirst ? 6 : 4);
          }}
        />
      )}

      {step === 6 && (
        <MatchingResidencesPreview onRequestHelp={() => setStep(4)} onBack={handleBack} />
      )}

      {step === 4 && selectedPersona && resolvedNeed && (
        <Card className="shadow-lg border-muted">
          <CardContent className="p-6">
            <OnboardingForm
              persona={selectedPersona}
              need={resolvedNeed}
              onSubmit={handleFormSubmit}
              onBack={handleBack}
            />
          </CardContent>
        </Card>
      )}

      {step === 5 && completedRecord && (
        <OnboardingSummaryCard record={completedRecord} />
      )}
    </div>
  );
};

export default GuidedOnboardingFlow;