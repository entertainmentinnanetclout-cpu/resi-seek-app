// All TUT Campuses in South Africa
export const TUT_CAMPUSES = [
  { value: "Pretoria West", label: "Pretoria West Campus" },
  { value: "Arts (Pretoria)", label: "Arts Campus (Pretoria)" },
  { value: "Arcadia", label: "Arcadia Campus" },
  { value: "Soshanguve North", label: "Soshanguve North Campus" },
  { value: "Soshanguve South", label: "Soshanguve South Campus" },
  { value: "Ga-Rankuwa", label: "Ga-Rankuwa Campus" },
  { value: "Polokwane", label: "Polokwane Campus" },
  { value: "Mbombela", label: "Mbombela Campus (Nelspruit)" },
  { value: "eMalahleni", label: "eMalahleni Campus (Witbank)" },
] as const;

export type CampusValue = typeof TUT_CAMPUSES[number]["value"];

// TVET Colleges and private tertiary institutions across Gauteng
export const TVET_CAMPUSES = [
  { value: "Tshwane North College", label: "Tshwane North College" },
  { value: "Tshwane South College", label: "Tshwane South College" },
  { value: "Ekurhuleni West College", label: "Ekurhuleni West College" },
  { value: "Ekurhuleni East College", label: "Ekurhuleni East College" },
  { value: "Sedibeng TVET College", label: "Sedibeng TVET College" },
  { value: "Boston City Campus", label: "Boston City Campus" },
  { value: "Damelin", label: "Damelin" },
  { value: "Rosebank College", label: "Rosebank College" },
  { value: "Richfield", label: "Richfield" },
] as const;

// Private tenant / working professional hubs
export const PRIVATE_LOCATIONS = [
  { value: "Pretoria CBD", label: "Pretoria CBD" },
  { value: "Hatfield", label: "Hatfield" },
  { value: "Sunnyside", label: "Sunnyside" },
  { value: "Arcadia", label: "Arcadia" },
  { value: "Centurion", label: "Centurion" },
  { value: "Menlyn", label: "Menlyn" },
  { value: "Brooklyn", label: "Brooklyn" },
  { value: "Midrand", label: "Midrand" },
] as const;

export type AudienceGroup = "university" | "tvet" | "private";

export const CAMPUSES_BY_AUDIENCE: Record<AudienceGroup, ReadonlyArray<{ value: string; label: string }>> = {
  university: TUT_CAMPUSES,
  tvet: TVET_CAMPUSES,
  private: PRIVATE_LOCATIONS,
};

export const ALL_CAMPUSES = [
  ...TUT_CAMPUSES,
  ...TVET_CAMPUSES,
  ...PRIVATE_LOCATIONS,
] as const;