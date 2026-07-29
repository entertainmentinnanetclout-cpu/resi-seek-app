import { Card } from "@/components/ui/card";
import type { Persona, Need } from "@/lib/onboarding/onboardingTypes";

export interface NeedOption {
  value: string;
  label: string;
  need: Need;
}

const MAP: Record<Persona, NeedOption[]> = {
  student: [
    { value: "find_accommodation", label: "Find accommodation", need: "accommodation" },
    { value: "wil_support", label: "WIL / placement support", need: "wil_support" },
    { value: "application_guidance", label: "College / university application guidance", need: "application_support" },
    { value: "track_application", label: "Track my existing application", need: "application_support" },
    { value: "update_profile", label: "Update my profile", need: "general_guidance" },
  ],
  parent_guardian: [
    { value: "child_accommodation", label: "My child needs accommodation", need: "accommodation" },
    { value: "child_application", label: "My child wants to apply (TVET / university / private college)", need: "application_support" },
    { value: "child_wil", label: "My child needs WIL / placement support", need: "wil_support" },
    { value: "verified_options", label: "I want safer verified options before paying", need: "general_guidance" },
  ],
  private_tenant: [
    { value: "bachelor", label: "Bachelor room", need: "private_rental" },
    { value: "single", label: "Single room", need: "private_rental" },
    { value: "shared", label: "Shared room", need: "private_rental" },
    { value: "apartment", label: "Apartment", need: "private_rental" },
    { value: "short_term", label: "Short-term stay", need: "private_rental" },
    { value: "long_term", label: "Long-term rental", need: "private_rental" },
  ],
  applicant: [
    { value: "tvet_application", label: "TVET College application guidance", need: "application_support" },
    { value: "university_application", label: "University application guidance", need: "application_support" },
    { value: "private_college_application", label: "Private College application guidance", need: "application_support" },
    { value: "aps_check", label: "Marks / APS readiness check", need: "application_support" },
    { value: "path_help", label: "Help choosing a study path", need: "general_guidance" },
    { value: "campus_accommodation", label: "Accommodation near campus", need: "accommodation" },
  ],
  wil_applicant: [
    { value: "wil_placement", label: "WIL placement", need: "wil_support" },
    { value: "internship", label: "Internship", need: "wil_support" },
    { value: "graduate", label: "Graduate opportunity", need: "wil_support" },
    { value: "readiness", label: "Workplace readiness help", need: "wil_support" },
  ],
  landlord: [
    { value: "list_property", label: "List my accommodation", need: "property_listing" },
    { value: "fill_rooms", label: "Fill my rooms", need: "property_listing" },
    { value: "get_leads", label: "Get student / private tenant leads", need: "property_listing" },
    { value: "manage_apps", label: "Manage applications", need: "property_listing" },
    { value: "portal", label: "Build a property portal", need: "partner_solution" },
    { value: "marketing", label: "Property marketing support", need: "partner_solution" },
  ],
  institution_business: [
    { value: "intake", label: "Student intake support", need: "partner_solution" },
    { value: "wil_partner", label: "WIL placement support", need: "partner_solution" },
    { value: "accommodation_partner", label: "Accommodation support", need: "partner_solution" },
    { value: "portal", label: "Student portal / dashboard", need: "partner_solution" },
    { value: "recruitment", label: "Recruitment campaign", need: "partner_solution" },
    { value: "digital_system", label: "Digital system development", need: "partner_solution" },
  ],
  unsure: [
    { value: "general", label: "I need general guidance", need: "general_guidance" },
  ],
};

export const getNeedOptions = (persona: Persona) => MAP[persona];

export const NeedSelector = ({
  persona,
  value,
  onChange,
}: {
  persona: Persona;
  value: string | null;
  onChange: (opt: NeedOption) => void;
}) => {
  const opts = MAP[persona];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {opts.map((o) => {
        const active = value === o.value;
        return (
          <Card
            key={o.value}
            onClick={() => onChange(o)}
            className={`p-4 cursor-pointer transition-all hover:shadow-md border-2 ${active ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <p className="font-semibold text-sm">{o.label}</p>
          </Card>
        );
      })}
    </div>
  );
};

export default NeedSelector;