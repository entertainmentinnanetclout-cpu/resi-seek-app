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