import { GraduationCap, HeartHandshake, Home, FileText, Briefcase, Building2, Landmark, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Persona } from "@/lib/onboarding/onboardingTypes";

const OPTIONS: { value: Persona; label: string; icon: typeof GraduationCap; desc: string }[] = [
  { value: "student", label: "I am a Student", icon: GraduationCap, desc: "Find a place, apply, track progress" },
  { value: "parent_guardian", label: "I am a Parent / Guardian", icon: HeartHandshake, desc: "Help your child find safe options" },
  { value: "private_tenant", label: "I want a Private Rental", icon: Home, desc: "Bachelor, single, shared or apartment" },
  { value: "applicant", label: "I want to apply to College / University", icon: FileText, desc: "TVET, University, Private College" },
  { value: "wil_applicant", label: "I need WIL / Placement Support", icon: Briefcase, desc: "Internships & workplace readiness" },
  { value: "landlord", label: "I am a Landlord / Property Owner", icon: Building2, desc: "List a property, get leads" },
  { value: "institution_business", label: "Institution or Business", icon: Landmark, desc: "Partner with ResKonnect" },
  { value: "unsure", label: "I am not sure — guide me", icon: HelpCircle, desc: "We will point you in the right direction" },
];

export const PersonaSelector = ({ value, onChange }: { value: Persona | null; onChange: (p: Persona) => void }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <Card
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border-2 ${active ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-muted text-primary"}`}>
                <o.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight">{o.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{o.desc}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default PersonaSelector;