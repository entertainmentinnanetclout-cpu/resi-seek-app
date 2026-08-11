/**
 * SINGLE SOURCE OF TRUTH for institution type -> institutions -> campuses.
 *
 * Never hardcode campus lists in components again. The guide step, Find My Res
 * filters, the Applications readiness page and admin tooling must all read from
 * here so a "University" selection can never surface a TVET college option.
 */

export type InstitutionTypeKey = "university" | "tvet" | "private_college" | "other";

export interface CampusOption {
  value: string;
  label: string;
  /** Extra strings used for fuzzy matching against residence campus/address/tags. */
  aliases?: string[];
}

export interface InstitutionOption {
  value: string;
  label: string;
  /** Tag written to intent + matched against residences.institution_tags */
  tag: string;
  campuses: CampusOption[];
}

export const UNIVERSITIES: InstitutionOption[] = [
  {
    value: "TUT",
    label: "Tshwane University of Technology (TUT)",
    tag: "tut",
    campuses: [
      { value: "Pretoria West", label: "TUT Pretoria West", aliases: ["pretoria west", "main campus"] },
      { value: "Arcadia", label: "TUT Arcadia", aliases: ["arcadia"] },
      { value: "Arts (Pretoria)", label: "TUT Arts (Pretoria)", aliases: ["arts campus"] },
      { value: "Soshanguve North", label: "TUT Soshanguve North", aliases: ["soshanguve north", "sosh north"] },
      { value: "Soshanguve South", label: "TUT Soshanguve South", aliases: ["soshanguve south", "sosh south"] },
      { value: "Ga-Rankuwa", label: "TUT Ga-Rankuwa", aliases: ["ga-rankuwa", "garankuwa"] },
      { value: "Polokwane", label: "TUT Polokwane", aliases: ["polokwane"] },
      { value: "Mbombela", label: "TUT Mbombela (Nelspruit)", aliases: ["mbombela", "nelspruit"] },
      { value: "eMalahleni", label: "TUT eMalahleni (Witbank)", aliases: ["emalahleni", "witbank"] },
    ],
  },
  {
    value: "UP",
    label: "University of Pretoria (UP)",
    tag: "up",
    campuses: [
      { value: "Hatfield", label: "UP Hatfield", aliases: ["hatfield"] },
      { value: "Hillcrest", label: "UP Hillcrest", aliases: ["hillcrest"] },
      { value: "Groenkloof", label: "UP Groenkloof", aliases: ["groenkloof"] },
      { value: "Prinshof", label: "UP Prinshof", aliases: ["prinshof"] },
    ],
  },
  {
    value: "UNISA",
    label: "University of South Africa (UNISA)",
    tag: "unisa",
    campuses: [
      { value: "Muckleneuk", label: "UNISA Muckleneuk", aliases: ["muckleneuk", "sunnyside"] },
      { value: "Sunnyside", label: "UNISA Sunnyside", aliases: ["sunnyside"] },
    ],
  },
];

export const TVET_COLLEGES: InstitutionOption[] = [
  {
    value: "Tshwane South TVET College",
    label: "Tshwane South TVET College",
    tag: "tshwane-south",
    campuses: [
      { value: "Tshwane South Pretoria West", label: "Tshwane South TVET — Pretoria West", aliases: ["pretoria west"] },
      { value: "Tshwane South Atteridgeville", label: "Tshwane South TVET — Atteridgeville", aliases: ["atteridgeville"] },
      { value: "Tshwane South Centurion", label: "Tshwane South TVET — Centurion", aliases: ["centurion"] },
      { value: "Tshwane South Odi", label: "Tshwane South TVET — Odi", aliases: ["odi"] },
    ],
  },
  {
    value: "Tshwane North TVET College",
    label: "Tshwane North TVET College",
    tag: "tshwane-north",
    campuses: [
      { value: "Tshwane North Soshanguve South", label: "Tshwane North TVET — Soshanguve South", aliases: ["soshanguve"] },
      { value: "Tshwane North Mamelodi", label: "Tshwane North TVET — Mamelodi", aliases: ["mamelodi"] },
      { value: "Tshwane North Pretoria", label: "Tshwane North TVET — Pretoria", aliases: ["pretoria cbd"] },
    ],
  },
  {
    value: "Ekurhuleni West TVET College",
    label: "Ekurhuleni West TVET College",
    tag: "ekurhuleni-west",
    campuses: [{ value: "Ekurhuleni West Germiston", label: "Ekurhuleni West — Germiston", aliases: ["germiston"] }],
  },
  {
    value: "Sedibeng TVET College",
    label: "Sedibeng TVET College",
    tag: "sedibeng",
    campuses: [{ value: "Sedibeng Vanderbijlpark", label: "Sedibeng — Vanderbijlpark", aliases: ["vanderbijlpark"] }],
  },
];

export const PRIVATE_COLLEGES: InstitutionOption[] = [
  {
    value: "Boston City Campus",
    label: "Boston City Campus",
    tag: "boston",
    campuses: [{ value: "Boston Pretoria", label: "Boston — Pretoria", aliases: ["pretoria"] }],
  },
  {
    value: "Damelin",
    label: "Damelin",
    tag: "damelin",
    campuses: [{ value: "Damelin Pretoria", label: "Damelin — Pretoria", aliases: ["pretoria"] }],
  },
  {
    value: "Rosebank College",
    label: "Rosebank College",
    tag: "rosebank",
    campuses: [{ value: "Rosebank Pretoria", label: "Rosebank College — Pretoria", aliases: ["pretoria"] }],
  },
  {
    value: "Richfield",
    label: "Richfield",
    tag: "richfield",
    campuses: [{ value: "Richfield Pretoria", label: "Richfield — Pretoria", aliases: ["pretoria"] }],
  },
];

/** Generic areas — used for "Other" and for non-student private tenants. */
export const GENERIC_AREAS: CampusOption[] = [
  { value: "Pretoria CBD", label: "Pretoria CBD" },
  { value: "Pretoria West", label: "Pretoria West" },
  { value: "Hatfield", label: "Hatfield" },
  { value: "Sunnyside", label: "Sunnyside" },
  { value: "Arcadia", label: "Arcadia" },
  { value: "Atteridgeville", label: "Atteridgeville" },
  { value: "Soshanguve", label: "Soshanguve" },
  { value: "Ga-Rankuwa", label: "Ga-Rankuwa" },
  { value: "Mamelodi", label: "Mamelodi" },
  { value: "Centurion", label: "Centurion" },
  { value: "Midrand", label: "Midrand" },
];

export const INSTITUTIONS_BY_TYPE: Record<Exclude<InstitutionTypeKey, "other">, InstitutionOption[]> = {
  university: UNIVERSITIES,
  tvet: TVET_COLLEGES,
  private_college: PRIVATE_COLLEGES,
};

export const INSTITUTION_TYPE_LABELS: Record<InstitutionTypeKey, string> = {
  university: "University",
  tvet: "TVET College",
  private_college: "Private College",
  other: "Other",
};

/** Institutions for a given type. "other" has none — use GENERIC_AREAS instead. */
export function getInstitutions(type?: InstitutionTypeKey): InstitutionOption[] {
  if (!type || type === "other") return [];
  return INSTITUTIONS_BY_TYPE[type] ?? [];
}

/**
 * Campus options for a given institution type (and optionally a specific
 * institution). Never mixes types — a university selection can never return a
 * TVET campus.
 */
export function getCampusOptions(type?: InstitutionTypeKey, institution?: string): CampusOption[] {
  if (!type || type === "other") return GENERIC_AREAS;
  const institutions = getInstitutions(type);
  const scoped = institution ? institutions.filter((i) => i.value === institution) : institutions;
  const seen = new Set<string>();
  const out: CampusOption[] = [];
  for (const inst of scoped) {
    for (const c of inst.campuses) {
      if (seen.has(c.value)) continue;
      seen.add(c.value);
      out.push(c);
    }
  }
  return out;
}

export function findCampusOption(type: InstitutionTypeKey | undefined, value: string): CampusOption | undefined {
  return getCampusOptions(type).find((c) => c.value === value);
}

export function getInstitutionTag(type?: InstitutionTypeKey, institution?: string): string | undefined {
  if (!institution) return undefined;
  return getInstitutions(type).find((i) => i.value === institution)?.tag;
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();

/**
 * Fuzzy campus match. Backend campus labels drift ("Pretoria West (Main Campus)"
 * vs "Pretoria West"), so we compare normalised substrings plus known aliases
 * across campus, address and institution tags.
 */
export function residenceMatchesCampus(residence: any, campusValue?: string, type?: InstitutionTypeKey): boolean {
  if (!campusValue) return true;
  const option = findCampusOption(type, campusValue);
  const needles = [campusValue, ...(option?.aliases ?? [])].map(norm).filter(Boolean);
  const haystack = [
    residence?.campus,
    residence?.address,
    residence?.section_category,
    ...(Array.isArray(residence?.institution_tags) ? residence.institution_tags : []),
    ...(Array.isArray(residence?.audience_tags) ? residence.audience_tags : []),
  ]
    .map(norm)
    .join(" | ");

  return needles.some((n) => haystack.includes(n) || n.split(" ").every((w) => w.length > 2 && haystack.includes(w)));
}

/** Budget chips used by the guide and Find My Res. */
export const BUDGET_OPTIONS = [1500, 2500, 3500, 5000, 8000] as const;
