import { hasPropertyPhotoReference, hasVerifiedLocation, hasVerifiedPrivateRent, positiveRand, publicPrivateMonthlyRent } from "@/lib/residenceListingEvidence";

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
  /** Evidence confidence, NOT a likelihood of acceptance or allocation. */
  confidence: "limited" | "partial" | "supported";
  evidenceCount: number;
  hasQuotedRent: boolean;
  hasVerifiedRent: boolean;
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
const arr = (value: unknown): string[] => Array.isArray(value) ? value.map(x => String(x)) : [];
const includesLike = (hay: string[], needles: string[]) => needles.some(needle =>
  hay.some(item => norm(item).includes(norm(needle)) || norm(needle).includes(norm(item))));

/**
 * Deterministic suitability score; no AI inference, no official accreditation
 * claim, no guessed rent, transport ETA, vacancy or reservation guarantee.
 */
export function scoreResidenceForDNA(residence: any, dna: PreferenceDNA): MatchResult {
  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];
  const misses: string[] = [];
  const priorityBoost = (key: string) => dna.priorities?.includes(key) ? 1.25 : 1;
  const privateRent = publicPrivateMonthlyRent(residence);
  const verifiedPrivateRent = hasVerifiedPrivateRent(residence);
  const locationVerified = hasVerifiedLocation(residence);
  const hasPhoto = hasPropertyPhotoReference(residence);
  const funding = norm(dna.fundingType);
  const nsfas = funding === "nsfas";
  const nsfasRate = residence.accepts_nsfas === true ? positiveRand(residence.nsfas_price) : null;
  const quote = nsfas ? nsfasRate : privateRent;
  const spots = Math.max(0, Number(residence.available_spots) || 0);
  const groupSize = Math.max(1, Number(dna.groupSize) || 1);
  const activeRooms = arr(residence.room_types);
  const roomPricing: any[] = Array.isArray(residence.room_pricing) ? residence.room_pricing.filter((r:any) =>
    r?.is_active !== false && Number(r?.academic_year || 2027) === 2027 && Number(r?.available_beds || 0) > 0) : [];
  const pricedRooms = roomPricing.some(r => Number(r.capacity) > 0 && Number(r.private_price) > 0);

  if (dna.campus && norm(dna.campus) !== "all") {
    const weight = 24 * priorityBoost("distance");
    possible += weight;
    const hay = [residence.campus, residence.city, residence.place_label,
      residence.address, ...arr(residence.institution_tags)].map(norm).join(" ");
    const words = norm(dna.campus).split(/\s+/).filter(w => w.length > 2);
    const matches = hay.includes(norm(dna.campus)) || (words.length > 0 && words.every(w => hay.includes(w)));
    if (matches) {
      earned += weight;
      reasons.push("Listed near your chosen campus/area — verify route");
    } else misses.push("Listed campus/area differs from your preference");
  }

  const constrainedBudget = Number(dna.budgetMax) < 10000 || Number(dna.budgetMin) > 0;
  if (constrainedBudget) {
    const weight = 22 * priorityBoost("price");
    possible += weight;
    if (quote !== null && quote >= (dna.budgetMin || 0) && quote <= dna.budgetMax) {
      earned += weight;
      reasons.push(nsfas
        ? "Provider-reported NSFAS-context price fits the selected Rand budget"
        : `Reported private monthly rent R${quote.toLocaleString("en-ZA")} fits your budget`);
    } else if (quote !== null && quote <= dna.budgetMax * 1.1 && quote >= (dna.budgetMin || 0)) {
      earned += weight * 0.4;
      misses.push("Quoted rent is slightly above the preferred monthly budget");
    } else if (quote === null) {
      misses.push(nsfas
        ? "No recorded NSFAS-context monthly rate; request a funded quote"
        : "Monthly rent unknown — request a current written quote");
    } else misses.push("Recorded rate is outside your selected budget");
  }

  if (funding === "nsfas" || funding === "private") {
    const weight = 18;
    possible += weight;
    const okay = funding === "nsfas" ? residence.accepts_nsfas === true : residence.accepts_private !== false;
    if (okay) {
      earned += weight;
      reasons.push(funding === "nsfas"
        ? "Provider reports accepting NSFAS — verify official accreditation separately"
        : "Provider reports accepting private-paying students");
    } else misses.push("Provider has not confirmed your selected funding route");
  } else if (funding && funding !== "undecided" && funding !== "other") {
    misses.push("Funding eligibility requires confirmation with provider");
  }

  if (dna.roomTypes.length) {
    const weight = 16;
    possible += weight;
    const advertised = [
      ...activeRooms, ...roomPricing.map(r => String(r.name || "")), residence.room_type,
    ].filter(Boolean).map(String);
    if (includesLike(advertised, dna.roomTypes)) {
      earned += weight;
      reasons.push("Preferred room type is listed — confirm an actual available unit");
    } else misses.push("Preferred room type not confirmed");
  }

  if (dna.amenities.length) {
    const weight = 10;
    possible += weight;
    const amenities = arr(residence.amenities);
    const matched = dna.amenities.filter(a => includesLike(amenities, [a])
      || (norm(a) === "wifi" && residence.has_wifi === true)
      || (norm(a) === "parking" && residence.has_parking === true)
      || (norm(a) === "furnished" && residence.is_furnished === true));
    const ratio = matched.length / dna.amenities.length;
    earned += weight * ratio;
    if (matched.length) reasons.push(`${matched.length}/${dna.amenities.length} requested amenities reported`);
    if (ratio < 1) misses.push("Some preferred amenities are not recorded");
  }

  const availabilityWeight = 10 * priorityBoost("availability");
  possible += availabilityWeight;
  if (spots >= groupSize) {
    earned += availabilityWeight;
    reasons.push("Provider-reported spaces could fit your group — booking not confirmed");
  } else if (spots > 0) {
    earned += availabilityWeight * 0.25;
    misses.push("Reported spaces are fewer than your group size");
  } else misses.push("No positive reported spaces; check directly");

  if (dna.styleTags.length) {
    const weight = 6;
    possible += weight;
    const hay = [residence.description, residence.brand_headline,
      residence.brand_subheadline, residence.category, ...arr(residence.amenities)].map(norm).join(" ");
    const matched = dna.styleTags.filter(tag => hay.includes(norm(tag)));
    earned += weight * (matched.length / dna.styleTags.length);
    if (matched.length) reasons.push("Reported lifestyle characteristics overlap with your preferences");
  }

  if (dna.maxTravelMinutes != null && dna.maxTravelMinutes > 0) {
    // No network route metric was computed by this deterministic matcher.
    misses.push("Travel time cannot be verified without a campus-to-property route");
  }

  const evidenceCount = Number(hasPhoto) + Number(privateRent !== null)
    + Number(verifiedPrivateRent) + Number(locationVerified) + Number(pricedRooms);
  const confidence: MatchResult["confidence"] =
    hasPhoto && verifiedPrivateRent && locationVerified && pricedRooms ? "supported"
      : evidenceCount >= 3 ? "partial" : "limited";
  const raw = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  // A compatibility score is never an acceptance probability. Data gaps cap it
  // so a property with no quote cannot rank as a perfect affordable result.
  const score = Math.max(0, Math.min(99,
    quote === null && constrainedBudget ? Math.min(raw, 65)
      : !verifiedPrivateRent ? Math.min(raw, 84)
      : !locationVerified ? Math.min(raw, 90) : raw));

  if (!hasPhoto) misses.push("No genuine property photo reference on record");
  if (!verifiedPrivateRent && privateRent !== null) misses.push("Monthly rent is not independently price-verified");

  return {
    score,
    reasons: reasons.slice(0, 5),
    misses: misses.slice(0, 5),
    confidence,
    evidenceCount,
    hasQuotedRent: quote !== null,
    hasVerifiedRent: verifiedPrivateRent,
  };
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
