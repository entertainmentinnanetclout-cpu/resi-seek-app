import type { Persona, Need } from "@/lib/onboarding/onboardingTypes";

export type InstitutionType = "university" | "tvet" | "private_college" | "other";
export type FundingType = "nsfas" | "private" | "bursary" | "unsure";
export type StudentStatus = "current_student" | "prospective_student" | "not_a_student";

export interface ChildProfile {
  name?: string;
  institution_type?: InstitutionType;
  institution_name?: string;
  campus?: string;
  need?: Need;
}

export interface UserIntent {
  persona?: Persona;
  primary_need?: Need;
  student_status?: StudentStatus;
  institution_type?: InstitutionType;
  institution_name?: string;
  campus?: string;
  funding_type?: FundingType;
  nsfas_funded?: boolean;
  looking_for_student_accommodation?: boolean;
  looking_for_private_rental?: boolean;
  area?: string;
  budget_min?: number;
  budget_max?: number;
  room_type?: string;
  move_in_date?: string;
  preferred_programme?: string;
  current_course?: string;
  wil_needed?: boolean;
  parent_mode?: boolean;
  child_profile?: ChildProfile;
  skipped_guide?: boolean;
  completed_guide?: boolean;
  updated_at?: string;
}

export const EMPTY_INTENT: UserIntent = {};

/** True when the guide produced enough signal to personalise the platform. */
export function hasIntent(intent: UserIntent): boolean {
  return Boolean(intent.persona && intent.completed_guide && !intent.skipped_guide);
}
