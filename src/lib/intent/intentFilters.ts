import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import type { UserIntent } from "./userIntentTypes";

export interface IntentFilterResult {
  /** Partial filter patch to pre-apply on Find My Res. Always user-removable. */
  patch: Partial<ResidenceFilters>;
  /** Human explanation shown above results, or null when nothing is pre-applied. */
  note: string | null;
  /**
   * True when the visitor wants a non-student private rental. ResKonnect has no
   * private rental listing type yet, so we show a support/request panel instead
   * of mislabelling student residences.
   * TODO(backend): private_rental_listings / rental_listings table required.
   */
  privateRentalUnavailable: boolean;
}

const audienceFromInstitution = (
  institution?: string
): ResidenceFilters["audience"] => {
  if (institution === "tvet") return "tvet";
  if (institution === "private_college") return "private";
  if (institution === "university") return "university";
  return "all";
};

export function deriveFiltersFromIntent(intent: UserIntent): IntentFilterResult {
  const empty: IntentFilterResult = { patch: {}, note: null, privateRentalUnavailable: false };

  // Guide skipped or never completed: full public browsing, no forced filters.
  if (!intent.persona || intent.skipped_guide || !intent.completed_guide) return empty;

  // Private tenants: never reuse accepts_private student residences as rentals.
  if (intent.persona === "private_tenant" || intent.primary_need === "private_rental") {
    return { patch: {}, note: null, privateRentalUnavailable: true };
  }

  const patch: Partial<ResidenceFilters> = {};
  const notes: string[] = [];

  const wantsAccommodation =
    intent.primary_need === "accommodation" ||
    intent.looking_for_student_accommodation === true ||
    intent.persona === "student" ||
    intent.persona === "parent_guardian" ||
    intent.persona === "applicant";

  if (!wantsAccommodation) return empty;

  const institution = intent.parent_mode
    ? intent.child_profile?.institution_type ?? intent.institution_type
    : intent.institution_type;

  const audience = audienceFromInstitution(institution);
  if (audience !== "all") patch.audience = audience;

  const campus = intent.parent_mode ? intent.child_profile?.campus ?? intent.campus : intent.campus;
  if (campus) patch.campus = campus;

  if (intent.nsfas_funded || intent.funding_type === "nsfas") {
    patch.nsfasOnly = true;
    notes.push(
      "Showing NSFAS-accredited or NSFAS-relevant student accommodation based on your selection."
    );
  } else if (intent.funding_type === "private") {
    notes.push("Showing student accommodation that accepts private-paying students.");
  } else {
    notes.push("Showing student accommodation based on your profile.");
  }

  if (typeof intent.budget_max === "number" && intent.budget_max > 0) {
    patch.priceMax = intent.budget_max;
    if (typeof intent.budget_min === "number") patch.priceMin = intent.budget_min;
    notes.push(`Budget filter applied at R${intent.budget_max.toLocaleString("en-ZA")} and below.`);
  }

  if (intent.room_type) patch.roomTypes = [intent.room_type];

  return { patch, note: notes.join(" "), privateRentalUnavailable: false };
}
