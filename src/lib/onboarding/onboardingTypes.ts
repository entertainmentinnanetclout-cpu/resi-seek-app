// Shared onboarding types.
// TODO: connect to Supabase onboarding_requests after backend migration is deployed.

export type Persona =
  | "student"
  | "parent_guardian"
  | "private_tenant"
  | "applicant"
  | "wil_applicant"
  | "landlord"
  | "institution_business"
  | "unsure";

export type Need =
  | "accommodation"
  | "private_rental"
  | "application_support"
  | "wil_support"
  | "property_listing"
  | "partner_solution"
  | "general_guidance";

export type OnboardingStatus =
  | "new"
  | "in_review"
  | "contacted"
  | "routed"
  | "closed";

export interface OnboardingRequest {
  id: string;
  persona: Persona;
  need: Need;
  full_name: string;
  phone?: string;
  whatsapp_number?: string;
  email?: string;
  consent_to_be_contacted: boolean;
  popia_consent: boolean;
  // Free-form persona-specific fields kept as a bag so we can evolve schema
  // without breaking the placeholder adapter.
  details: Record<string, string | number | boolean | undefined>;
  status: OnboardingStatus;
  assigned_staff?: string;
  notes?: string;
  created_at: string;
}

export const PERSONA_LABELS: Record<Persona, string> = {
  student: "Student",
  parent_guardian: "Parent / Guardian",
  private_tenant: "Private Tenant",
  applicant: "Applicant",
  wil_applicant: "WIL Applicant",
  landlord: "Landlord / Property Owner",
  institution_business: "Institution / Business",
  unsure: "Unsure — needs routing",
};

export const NEED_LABELS: Record<Need, string> = {
  accommodation: "Student Accommodation",
  private_rental: "Private Rental",
  application_support: "Application Support",
  wil_support: "WIL / Placement Support",
  property_listing: "List a Property",
  partner_solution: "Partner Solution",
  general_guidance: "General Guidance",
};

export const STATUS_LABELS: Record<OnboardingStatus, string> = {
  new: "New",
  in_review: "In Review",
  contacted: "Contacted",
  routed: "Routed",
  closed: "Closed",
};