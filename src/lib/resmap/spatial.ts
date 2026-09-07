import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import { residenceMatchesCampus } from "@/constants/institutionOptions";

export type TravelMode = "walk" | "bike" | "drive" | "transport";

export interface SpatialIntent {
  filterPatch: Partial<ResidenceFilters>;
  travelMode?: TravelMode;
  travelTimeMax?: number;
  campusHint?: string;
  understood: string[];
}

const rad = (value: number) => value * Math.PI / 180;
export function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const la1 = rad(a.latitude);
  const la2 = rad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estimateTravelMinutes(distanceKm: number, mode: TravelMode) {
  const speedKmh = mode === "walk" ? 4.8 : mode === "bike" ? 14 : mode === "transport" ? 22 : 30;
  const base = distanceKm / speedKmh * 60;
  return Math.max(1, Math.round(base + (mode === "transport" ? 6 : 0)));
}

export function circlePolygon(latitude: number, longitude: number, radiusKm: number, steps = 72) {
  const coordinates: number[][] = [];
  const latRadius = radiusKm / 110.574;
  const lngRadius = radiusKm / (111.320 * Math.max(0.2, Math.cos(rad(latitude))));
  for (let i = 0; i <= steps; i++) {
    const angle = 2 * Math.PI * i / steps;
    coordinates.push([longitude + lngRadius * Math.cos(angle), latitude + latRadius * Math.sin(angle)]);
  }
  return { type: "Feature" as const, properties: { radiusKm }, geometry: { type: "Polygon" as const, coordinates: [coordinates] } };
}

const campusPatterns: Array<[RegExp, string]> = [
  [/soshanguve\s+north|sosh\s+north/i, "Soshanguve North"],
  [/soshanguve\s+south|sosh\s+south/i, "Soshanguve South"],
  [/pretoria\s+(west|main)|main\s+campus/i, "Pretoria West"],
  [/\barcadia\b/i, "Arcadia"],
  [/\barts?\s+campus\b/i, "Arts (Pretoria)"],
  [/ga\s*-?\s*rankuwa|garankuwa/i, "Ga-Rankuwa"],
  [/\bpolokwane\b/i, "Polokwane"],
  [/mbombela|nelspruit/i, "Mbombela"],
  [/emalahleni|witbank/i, "eMalahleni"],
  [/\bhatfield\b/i, "Hatfield"],
  [/\bsunnyside\b/i, "Sunnyside"],
  [/\bmamelodi\b/i, "Mamelodi"],
  [/\bcenturion\b/i, "Centurion"],
  [/\bmidrand\b/i, "Midrand"],
  [/atteridgeville/i, "Atteridgeville"],
];

export function parseSpatialIntent(query: string): SpatialIntent {
  const q = query.trim();
  const patch: Partial<ResidenceFilters> = {};
  const understood: string[] = [];
  let campusHint: string | undefined;
  let travelMode: TravelMode | undefined;
  let travelTimeMax: number | undefined;

  for (const [pattern, campus] of campusPatterns) {
    if (pattern.test(q)) { campusHint = campus; understood.push(`campus: ${campus}`); break; }
  }
  if (/\bnsfas\b/i.test(q)) { patch.nsfasOnly = true; understood.push("NSFAS"); }
  if (/\b(single|own room|private room)\b/i.test(q)) { patch.roomTypes = ["single"]; patch.singlesOnly = true; understood.push("single room"); }
  if (/\b(sharing|shared room|share)\b/i.test(q)) { patch.roomTypes = ["sharing"]; understood.push("sharing room"); }
  if (/\bwi[ -]?fi\b/i.test(q)) { patch.wifiOnly = true; understood.push("Wi-Fi"); }
  if (/\bparking\b/i.test(q)) { patch.parkingOnly = true; understood.push("parking"); }
  if (/\b(available|open|rooms left|space available)\b/i.test(q)) { patch.availability = "available"; understood.push("available now"); }
  if (/\b(cheap|cheapest|lowest price|budget)\b/i.test(q)) { patch.sortBy = "price-asc"; understood.push("lowest price first"); }
  const price = q.replace(/,/g, "").match(/(?:under|below|max(?:imum)?|up to|budget(?: of)?|r)\s*:?[ ]*r?\s*(\d{3,5})/i) || q.replace(/,/g, "").match(/r\s*(\d{3,5})/i);
  if (price) { patch.priceMax = Math.min(25000, Number(price[1])); understood.push(`max R${Number(price[1]).toLocaleString("en-ZA")}`); }
  if (/\b(private funded|self[- ]?funded|cash paying)\b/i.test(q)) { patch.privatePayingOnly = true; understood.push("private paying"); }
  if (/\btvet\b|college/i.test(q)) { patch.audience = "tvet"; understood.push("TVET"); }
  else if (/\b(university|tut|up\b|unisa)\b/i.test(q)) { patch.audience = "university"; understood.push("university"); }

  const time = q.match(/(?:within|under|max(?:imum)?|less than)?\s*(\d{1,2})\s*(?:min|minute)/i);
  if (time) { travelTimeMax = Math.min(60, Math.max(5, Number(time[1]))); understood.push(`${travelTimeMax} min travel`); }
  if (/\bwalk|walking|on foot\b/i.test(q)) travelMode = "walk";
  else if (/\bbike|bicycle|cycling\b/i.test(q)) travelMode = "bike";
  else if (/\b(shuttle|bus|taxi|transport)\b/i.test(q)) travelMode = "transport";
  else if (/\bdrive|driving|car\b/i.test(q)) travelMode = "drive";
  if (travelMode) understood.push(travelMode);

  return { filterPatch: patch, travelMode, travelTimeMax, campusHint, understood };
}

function stringIncludes(value: unknown, q: string) { return String(value ?? "").toLowerCase().includes(q); }

export function residenceMatchesMapFilters(residence: any, filters: ResidenceFilters) {
  if (!residence || residence.map_hidden === true || residence.is_visible === false) return false;
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    if (![residence.name, residence.address, residence.description, residence.campus, residence.city].some((v) => stringIncludes(v, q))) return false;
  }
  if (filters.campus !== "all" && !residenceMatchesCampus(residence, filters.campus, filters.institutionType)) return false;
  if (filters.category !== "all" && residence.category !== filters.category) return false;
  if (filters.gender !== "all" && residence.gender !== filters.gender && residence.gender !== "mixed") return false;
  if (filters.audience === "tvet" && residence.accepts_tvet !== true) return false;
  if (filters.audience === "private" && residence.accepts_private !== true) return false;
  if (filters.audience === "university" && residence.accepts_university === false && residence.accepts_tvet === true) return false;
  if (filters.institutionTag && !(residence.institution_tags || []).some((tag: string) => tag === filters.institutionTag || tag.includes(filters.institutionTag!))) return false;
  const price = Number(residence.price) || 0;
  if (price < filters.priceMin || price > filters.priceMax) return false;
  if (filters.roomTypes.length) {
    const types = (residence.room_types || [residence.room_type]).filter(Boolean).map((v: string) => v.toLowerCase());
    if (!filters.roomTypes.some((wanted) => types.some((actual: string) => actual.includes(wanted.toLowerCase()) || wanted.toLowerCase().includes(actual)))) return false;
  }
  if (filters.nsfasOnly && !(residence.accepts_nsfas || residence.is_tut_accredited || residence.nsfas_accredited)) return false;
  if (filters.privatePayingOnly && residence.accepts_private !== true) return false;
  if (filters.tutOnly && residence.is_tut_accredited !== true) return false;
  if (filters.singlesOnly && !(Number(residence.singles_available || 0) > 0 || (residence.room_types || []).some((t: string) => /single/i.test(t)))) return false;
  if (filters.furnishedOnly && residence.is_furnished !== true) return false;
  if (filters.wifiOnly && residence.has_wifi !== true) return false;
  if (filters.parkingOnly && residence.has_parking !== true) return false;
  if (filters.availability === "available" && Number(residence.available_spots || 0) <= 0) return false;
  if (filters.availability === "few_spots" && !(Number(residence.available_spots || 0) > 0 && Number(residence.available_spots || 0) <= 5)) return false;
  if (filters.amenities.length && !filters.amenities.every((wanted) => (residence.amenities || []).some((actual: string) => String(actual).toLowerCase() === wanted.toLowerCase()))) return false;
  return true;
}

export function campusFilterValue(campus: any) {
  const key = String(campus?.campus_key || "");
  if (key === "tut-pretoria") return "Pretoria West";
  if (key === "tut-arts") return "Arts (Pretoria)";
  if (key === "tut-sosh-north") return "Soshanguve North";
  if (key === "tut-sosh-south") return "Soshanguve South";
  if (key === "tut-ga-rankuwa") return "Ga-Rankuwa";
  if (key === "tut-mbombela") return "Mbombela";
  if (key === "tut-emalahleni") return "eMalahleni";
  if (key === "tut-polokwane") return "Polokwane";
  if (key === "tut-arcadia") return "Arcadia";
  return campus?.short_name || campus?.name || "all";
}
