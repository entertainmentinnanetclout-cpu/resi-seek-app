export type ResidenceCampusPolicyInput = {
  name?: string | null;
  campus?: string | null;
  province?: string | null;
  address?: string | null;
  city?: string | null;
  institution_tags?: string[] | null;
};

type CampusRule = { label: string; province: string; aliases: string[] };

export const CAMPUS_RULES: CampusRule[] = [
  { label: "Pretoria West (Main Campus)", province: "Gauteng", aliases: ["pretoria west", "main campus", "pretoria campus"] },
  { label: "Arcadia Campus", province: "Gauteng", aliases: ["arcadia campus", "tut arcadia", "arcadia"] },
  { label: "Arts Campus", province: "Gauteng", aliases: ["arts campus", "arts (pretoria)", "tut arts"] },
  { label: "Soshanguve North Campus", province: "Gauteng", aliases: ["soshanguve north", "sosh north"] },
  { label: "Soshanguve South Campus", province: "Gauteng", aliases: ["soshanguve south", "sosh south"] },
  { label: "Ga-Rankuwa Campus", province: "Gauteng", aliases: ["ga-rankuwa", "garankuwa"] },
  { label: "Polokwane Campus", province: "Limpopo", aliases: ["polokwane campus", "tut polokwane", "polokwane"] },
  { label: "Giyani Campus", province: "Limpopo", aliases: ["giyani campus", "tut giyani", "giyani"] },
  { label: "Mbombela Campus", province: "Mpumalanga", aliases: ["mbombela campus", "tut mbombela", "mbombela", "nelspruit"] },
  { label: "eMalahleni Campus", province: "Mpumalanga", aliases: ["emalahleni campus", "tut emalahleni", "emalahleni", "witbank"] },
];

export const CAMPUS_OPTIONS_BY_PROVINCE = CAMPUS_RULES.reduce<Record<string, string[]>>((acc, rule) => {
  (acc[rule.province] ||= []).push(rule.label);
  return acc;
}, {});

const norm = (value: unknown) =>
  String(value ?? "").toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();

export const isSoshaResidence = (residence: ResidenceCampusPolicyInput) =>
  (residence.institution_tags || []).some((tag) => {
    const value = norm(tag);
    return value === "sosha" || value.includes("sosha") || value === "tosha" || value.includes("tosha");
  });

export const isEkhayaJunction = (residence: ResidenceCampusPolicyInput) =>
  norm(residence.name).includes("ekhaya junction");

export function provinceForCampus(value: string): string | null {
  const needle = norm(value);
  if (!needle) return null;
  const matched = CAMPUS_RULES.find((rule) =>
    [rule.label, ...rule.aliases].some((alias) => {
      const n = norm(alias);
      return needle.includes(n) || n.includes(needle);
    }),
  );
  return matched?.province || null;
}

export function extractServedCampuses(raw: string | null | undefined): string[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  const lower = norm(text);
  const detected = CAMPUS_RULES.filter((rule) =>
    [rule.label, ...rule.aliases].some((alias) => lower.includes(norm(alias))),
  ).map((rule) => rule.label);
  const split = text.replace(/\s+and\s+/gi, ",").split(/[,;&|/]+/).map((part) => part.trim()).filter(Boolean);
  const out: string[] = [];
  for (const value of [...detected, ...split]) {
    const matched = CAMPUS_RULES.find((rule) =>
      [rule.label, ...rule.aliases].some((alias) => {
        const n = norm(alias);
        const v = norm(value);
        return v === n || v.includes(n) || n.includes(v);
      }),
    );
    const label = matched?.label || value;
    if (!out.some((item) => norm(item) === norm(label))) out.push(label);
  }
  return out;
}

export function isPretoriaWestResidence(residence: ResidenceCampusPolicyInput, campuses = extractServedCampuses(residence.campus)) {
  const location = norm([residence.address, residence.city].filter(Boolean).join(" "));
  return campuses.some((c) => norm(c).includes("pretoria west")) || location.includes("pretoria west");
}

export function validateResidenceCampusPolicy(residence: ResidenceCampusPolicyInput) {
  const province = String(residence.province || "").trim();
  const campuses = extractServedCampuses(residence.campus);
  const violations: string[] = [];
  const filtered: string[] = [];
  for (const campus of campuses) {
    const campusProvince = provinceForCampus(campus);
    if (province && campusProvince && norm(province) !== norm(campusProvince)) {
      violations.push(campus + " is in " + campusProvince + ", but this residence is in " + province + ". A residence may serve multiple campuses only inside one province.");
      continue;
    }
    filtered.push(campus);
  }
  const hasSoshanguve = filtered.some((campus) => norm(campus).includes("soshanguve"));
  if (hasSoshanguve && isPretoriaWestResidence(residence, filtered) && !isEkhayaJunction(residence) && !isSoshaResidence(residence)) {
    violations.push("Pretoria West residences may not serve Soshanguve students unless the residence is Ekhaya Junction or is explicitly tagged SOSHA.");
  }
  if (!province) violations.push("Province is required before campus accreditation can be published to Meta.");
  return { valid: violations.length === 0, violations, servedCampuses: filtered, province, soshaException: isSoshaResidence(residence), ekhayaException: isEkhayaJunction(residence) };
}

export function toggleCampusInResidence(current: string | null | undefined, campus: string, checked: boolean) {
  const values = extractServedCampuses(current);
  const exists = values.some((item) => norm(item) === norm(campus));
  const next = checked && !exists ? [...values, campus] : !checked && exists ? values.filter((item) => norm(item) !== norm(campus)) : values;
  return next.join(", ");
}

export function setSoshaTag(tags: string[] | null | undefined, enabled: boolean) {
  const current = (tags || []).filter(Boolean);
  const without = current.filter((tag) => !["sosha", "tosha"].includes(norm(tag)));
  return enabled ? [...without, "SOSHA"] : without;
}
