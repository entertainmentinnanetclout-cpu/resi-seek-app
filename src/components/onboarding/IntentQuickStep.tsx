import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  BUDGET_OPTIONS,
  GENERIC_AREAS,
  getCampusOptions,
  getInstitutions,
  INSTITUTION_TYPE_LABELS,
} from "@/constants/institutionOptions";
import type { Persona, Need } from "@/lib/onboarding/onboardingTypes";
import type { FundingType, InstitutionType, UserIntent } from "@/lib/intent/userIntentTypes";
import { cn } from "@/lib/utils";

interface IntentQuickStepProps {
  persona: Persona;
  need: Need;
  onContinue: (intent: Partial<UserIntent>) => void;
  onBack: () => void;
  onSkip: () => void;
}

const INSTITUTIONS: { value: InstitutionType; label: string }[] = [
  { value: "university", label: "University" },
  { value: "tvet", label: "TVET College" },
  { value: "private_college", label: "Private College" },
  { value: "other", label: "Other" },
];

const FUNDING: { value: FundingType; label: string; hint: string }[] = [
  { value: "nsfas", label: "NSFAS funded", hint: "Prioritise NSFAS-accredited accommodation" },
  { value: "private", label: "Private / self-funded", hint: "Residences accepting private-paying students" },
  { value: "bursary", label: "Bursary funded", hint: "Bursary or employer funded" },
  { value: "unsure", label: "Not sure yet", hint: "We'll show all relevant options" },
];

const BUDGETS = [...BUDGET_OPTIONS];

const OptionButton = ({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "text-left rounded-xl border p-3 transition-all hover:border-primary/60 hover:shadow-sm",
      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card"
    )}
  >
    <span className="block text-sm font-semibold">{title}</span>
    {hint && <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>}
  </button>
);

export const IntentQuickStep: React.FC<IntentQuickStepProps> = ({
  persona,
  need,
  onContinue,
  onBack,
  onSkip,
}) => {
  const [institutionType, setInstitutionType] = useState<InstitutionType | undefined>();
  const [institutionName, setInstitutionName] = useState<string>("");
  const [campus, setCampus] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [funding, setFunding] = useState<FundingType | undefined>();
  const [budget, setBudget] = useState<number | undefined>();

  const isAccommodation = need === "accommodation" || need === "private_rental";
  const isStudentSide = persona === "student" || persona === "parent_guardian" || persona === "applicant" || persona === "wil_applicant";
  const isPrivateTenant = persona === "private_tenant" || need === "private_rental";

  // Campus options are always scoped to the selected institution type.
  const institutions = getInstitutions(institutionType as any);
  const campusOptions = institutionType
    ? getCampusOptions(institutionType as any, institutionName || undefined)
    : GENERIC_AREAS;

  const selectInstitutionType = (value: InstitutionType) => {
    setInstitutionType(value);
    setInstitutionName("");
    setCampus("");
  };

  const submit = () => {
    onContinue({
      persona,
      primary_need: need,
      institution_type: institutionType,
      institution_name: institutionName || undefined,
      campus: campus || undefined,
      area: area || undefined,
      funding_type: funding,
      nsfas_funded: funding === "nsfas",
      budget_max: budget,
      looking_for_student_accommodation: isStudentSide && need === "accommodation",
      looking_for_private_rental: isPrivateTenant,
      parent_mode: persona === "parent_guardian",
      wil_needed: need === "wil_support",
    });
  };

  return (
    <Card className="shadow-lg border-muted">
      <CardContent className="p-6 space-y-6">
        {isStudentSide && (
          <div className="space-y-2">
            <Label>Where are you studying (or planning to study)?</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INSTITUTIONS.map((i) => (
                <OptionButton
                  key={i.value}
                  active={institutionType === i.value}
                  onClick={() => selectInstitutionType(i.value)}
                  title={INSTITUTION_TYPE_LABELS[i.value] ?? i.label}
                />
              ))}
            </div>
          </div>
        )}

        {isStudentSide && institutions.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="intent-institution">
              Which {INSTITUTION_TYPE_LABELS[institutionType as InstitutionType]?.toLowerCase()}?
            </Label>
            <select
              id="intent-institution"
              value={institutionName}
              onChange={(e) => {
                setInstitutionName(e.target.value);
                setCampus("");
              }}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Any {INSTITUTION_TYPE_LABELS[institutionType as InstitutionType]?.toLowerCase()}</option>
              {institutions.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {isAccommodation && !isPrivateTenant && (
          <div className="space-y-2">
            <Label htmlFor="intent-campus">
              {institutionType && institutionType !== "other" ? "Nearest campus" : "Preferred area"} (optional)
            </Label>
            <select
              id="intent-campus"
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">
                {institutionType && institutionType !== "other" ? "Any campus" : "Any area"}
              </option>
              {campusOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {isStudentSide && !institutionType && (
              <p className="text-xs text-muted-foreground">
                Pick your institution type above to see only its campuses.
              </p>
            )}
          </div>
        )}

        {isPrivateTenant && (
          <div className="space-y-2">
            <Label htmlFor="intent-area">Which area are you looking in?</Label>
            <Input
              id="intent-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Pretoria West, Soshanguve, Arcadia"
            />
          </div>
        )}

        {isStudentSide && isAccommodation && (
          <div className="space-y-2">
            <Label>How is your accommodation funded?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FUNDING.map((f) => (
                <OptionButton
                  key={f.value}
                  active={funding === f.value}
                  onClick={() => setFunding(f.value)}
                  title={f.label}
                  hint={f.hint}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              NSFAS is used here only as a funding and accommodation accreditation context.
            </p>
          </div>
        )}

        {isAccommodation && (
          <div className="space-y-2">
            <Label>Monthly budget (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBudget(budget === b ? undefined : b)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors",
                    budget === b ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                  )}
                >
                  Up to R{b.toLocaleString("en-ZA")}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            &larr; Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onSkip}>
              Skip for now
            </Button>
            <Button type="button" onClick={submit} className="bg-cta text-cta-foreground hover:bg-cta/90">
              Continue
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IntentQuickStep;
