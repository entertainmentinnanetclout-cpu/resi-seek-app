export interface PreferenceDNA {
  campus?: string;
  institutionType?: string;
  institutionTag?: string;
  fundingType?: string;
  budgetMin: number;
  budgetMax: number;
  roomTypes: string[];
  amenities: string[];
  priorities: string[];
  styleTags: string[];
  travelMode: "walk" | "bike" | "drive" | "transport";
  maxTravelMinutes?: number | null;
  groupSize: number;
}

export interface MatchResult {
  score: number;
  reasons: string[];
  misses: string[];
}

export const DEFAULT_DNA: PreferenceDNA = {
  budgetMin: 0,
  budgetMax: 10000,
  roomTypes: [],
  amenities: [],
  priorities: ["distance", "price", "availability"],
  styleTags: [],
  travelMode: "walk",
  maxTravelMinutes: null,
  groupSize: 1,
};

const norm = (value: unknown) => String(value ?? "").toLowerCase().trim();
const arr = (value: unknown): string[] => Array.isArray(value) ? value.map((x) => String(x)) : [];
const includesLike = (hay: string[], needles: string[]) => needles.some((needle) => hay.some((item) => norm(item).includes(norm(needle)) || norm(needle).includes(norm(item))));

export function scoreResidenceForDNA(residence: any, dna: PreferenceDNA): MatchResult {
  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];
  const misses: string[] = [];
  const priorityBoost = (key: string) => dna.priorities.includes(key) ? 1.25 : 1;

  if (dna.campus) {
    const weight = 24 * priorityBoost("distance"); possible += weight;
    const hay = [residence.campus, residence.address, residence.place_label, ...(arr(residence.institution_tags))].map(norm).join(" ");
    const words = norm(dna.campus).split(/\s+/).filter((w) => w.length > 2);
    const ok = hay.includes(norm(dna.campus)) || words.every((w) => hay.includes(w));
    if (ok) { earned += weight; reasons.push(`Matches ${dna.campus}`); } else misses.push(`Different campus/area from ${dna.campus}`);
  }

  if (dna.budgetMax < 10000 || dna.budgetMin > 0) {
    const weight = 22 * priorityBoost("price"); possible += weight;
    const published = [residence.private_price, residence.price, residence.nsfas_price].map(Number).filter((v) => Number.isFinite(v) && v > 0);
    const price = published.length ? Math.min(...published) : 0;
    if (price > 0 && price >= dna.budgetMin && price <= dna.budgetMax) { earned += weight; reasons.push(`Within budget at about R${price.toLocaleString("en-ZA")}/mo`); }
    else if (price > 0 && price <= dna.budgetMax * 1.1) { earned += weight * 0.55; reasons.push("Close to your budget"); }
    else misses.push("Outside your preferred budget");
  }

  if (dna.fundingType) {
    const weight = 18; possible += weight;
    const funding = norm(dna.fundingType);
    const ok = funding.includes("nsfas") ? (residence.accepts_nsfas === true || residence.nsfas_accredited === true || residence.is_tut_accredited === true)
      : funding.includes("private") ? residence.accepts_private !== false
      : true;
    if (ok) { earned += weight; reasons.push(funding.includes("nsfas") ? "Accepts NSFAS-funded students" : "Matches your funding preference"); }
    else misses.push("Funding preference does not match");
  }

  if (dna.roomTypes.length) {
    const weight = 16; possible += weight;
    const types = [...arr(residence.room_types), residence.room_type].filter(Boolean).map(String);
    if (includesLike(types, dna.roomTypes)) { earned += weight; reasons.push(`Offers ${dna.roomTypes.join(" / ")}`); }
    else misses.push("Preferred room type not listed");
  }

  if (dna.amenities.length) {
    const weight = 10; possible += weight;
    const amenities = arr(residence.amenities);
    const matched = dna.amenities.filter((a) => includesLike(amenities, [a]) || (norm(a)==="wifi" && residence.has_wifi) || (norm(a)==="parking" && residence.has_parking));
    const ratio = matched.length / dna.amenities.length;
    earned += weight * ratio;
    if (matched.length) reasons.push(`${matched.length}/${dna.amenities.length} preferred amenities`);
    if (ratio < 1) misses.push("Some preferred amenities are not confirmed");
  }

  const availabilityWeight = 10 * priorityBoost("availability"); possible += availabilityWeight;
  const spots = Number(residence.available_spots || 0);
  if (spots >= Math.max(1, dna.groupSize || 1)) { earned += availabilityWeight; reasons.push(dna.groupSize > 1 ? `Enough published spaces for ${dna.groupSize}` : "Published availability"); }
  else if (spots > 0) { earned += availabilityWeight * 0.35; misses.push("Limited availability for your group size"); }
  else misses.push("No current published spaces");

  if (dna.styleTags.length) {
    const weight = 6; possible += weight;
    const hay = [residence.description, residence.brand_headline, residence.brand_subheadline, residence.category, ...arr(residence.amenities)].map(norm).join(" ");
    const matched = dna.styleTags.filter((tag) => hay.includes(norm(tag)));
    const ratio = dna.styleTags.length ? matched.length / dna.styleTags.length : 0;
    earned += weight * ratio;
    if (matched.length) reasons.push(`Visual/lifestyle match: ${matched.slice(0,3).join(", ")}`);
  }

  const score = possible > 0 ? Math.max(1, Math.min(99, Math.round((earned / possible) * 100))) : 70;
  return { score, reasons: reasons.slice(0,4), misses: misses.slice(0,3) };
}

export function DNAFromFilters(filters: any): PreferenceDNA {
  return {
    ...DEFAULT_DNA,
    campus: filters?.campus && filters.campus !== "all" ? filters.campus : undefined,
    institutionType: filters?.institutionType,
    institutionTag: filters?.institutionTag,
    fundingType: filters?.nsfasOnly ? "nsfas" : filters?.privatePayingOnly ? "private" : undefined,
    budgetMin: Number(filters?.priceMin || 0),
    budgetMax: Number(filters?.priceMax || 10000),
    roomTypes: arr(filters?.roomTypes),
    amenities: [...arr(filters?.amenities), ...(filters?.wifiOnly ? ["WiFi"] : []), ...(filters?.parkingOnly ? ["Parking"] : [])],
    priorities: ["distance", "price", "availability"],
    styleTags: [],
    travelMode: "walk",
    maxTravelMinutes: null,
    groupSize: 1,
  };
}
