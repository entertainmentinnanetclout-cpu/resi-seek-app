import type { OnboardingRequest } from "@/lib/onboarding/onboardingTypes";

export interface RoutingTarget {
  path: string;
  label: string;
}

export function routeForRequest(record: OnboardingRequest): RoutingTarget {
  const persona = record.persona;
  const need = record.need;
  const details = record.details || {};

  switch (persona) {
    case "student":
      if (need === "accommodation") {
        return { path: "/find", label: "Browse Student Accommodation" };
      }
      if (need === "wil_support") {
        return { path: "/opportunities/wil", label: "See WIL Support Options" };
      }
      if (need === "application_support") {
        return { path: "/applications", label: "Explore Application Support" };
      }
      return { path: "/dashboard", label: "Go to your Student Dashboard" };

    case "parent_guardian":
      return { path: "/living/parents", label: "Parent & Guardian Resources" };

    case "private_tenant":
      return { path: "/living/private-rentals", label: "Browse Private Rentals" };

    case "applicant": {
      const instType = String(details.institution_type || "").toLowerCase();
      if (instType.includes("tvet")) {
        return { path: "/applications/tvet", label: "TVET Application Guidance" };
      }
      if (instType.includes("private")) {
        return { path: "/applications/private-college", label: "Private College Guidance" };
      }
      if (instType.includes("university")) {
        return { path: "/applications/university", label: "University Application Guidance" };
      }
      return { path: "/applications", label: "Applications Hub" };
    }

    case "wil_applicant":
      return { path: "/opportunities/wil", label: "WIL Placement Support" };

    case "landlord":
      return { path: "/partners/landlords", label: "Landlord Partnerships" };

    case "institution_business":
      return { path: "/partners/institutions", label: "Institution & Business Partnerships" };

    case "unsure":
    default:
      return { path: "/get-started", label: "Continue Guided Setup" };
  }
}
