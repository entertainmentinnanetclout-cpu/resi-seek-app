/** Evidence-aware property display and search. No flag here grants accreditation or booking status. */
export const positiveRand = (value: unknown): number | null => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const livePromo = (data: any, now: number): boolean => {
  if (data?.promo_active !== true) return false;
  const start = data?.promo_starts_at ? Date.parse(data.promo_starts_at) : null;
  const end = data?.promo_ends_at ? Date.parse(data.promo_ends_at) : null;
  return (start === null || (Number.isFinite(start) && start <= now))
    && (end === null || (Number.isFinite(end) && end >= now));
};

/** Null is UNKNOWN, not R0/month. An unavailable room never supplies a budget match. */
export const publicPrivateMonthlyRent = (residence: any, now = Date.now()): number | null => {
  const pricingYear = Number(residence?.pricing_year || 2027);
  const rooms: any[] = Array.isArray(residence?.room_pricing)
    ? residence.room_pricing.filter((room: any) =>
        room?.is_active !== false && Number(room?.academic_year || pricingYear) === pricingYear)
    : [];
  if (rooms.length) {
    const prices = rooms
      .filter((room) => Number(room.available_beds) > 0)
      .map((room) => livePromo(room, now) ? positiveRand(room.promo_price) ?? positiveRand(room.private_price) : positiveRand(room.private_price))
      .filter((price): price is number => price !== null);
    return prices.length ? Math.min(...prices) : null;
  }
  return livePromo(residence, now)
    ? positiveRand(residence.promo_price) ?? positiveRand(residence.private_price) ?? positiveRand(residence.price)
    : positiveRand(residence?.private_price) ?? positiveRand(residence?.price);
};

export const isPublishedPromotionCurrent = (residence: any, now = Date.now()): boolean => livePromo(residence, now);

export const hasVerifiedPrivateRent = (residence: any): boolean => {
  const pricingYear = Number(residence?.pricing_year || 2027);
  const rooms: any[] = Array.isArray(residence?.room_pricing)
    ? residence.room_pricing.filter((room: any) =>
        room?.is_active !== false && Number(room?.academic_year || pricingYear) === pricingYear)
    : [];
  if (rooms.length) return rooms.some((room) =>
    Number(room.available_beds) > 0 && Boolean(room.price_verified_at) && positiveRand(room.private_price) !== null,
  );
  return Boolean(residence?.price_verified_at) && publicPrivateMonthlyRent(residence) !== null;
};

/** A URL is a photo reference, not independent confirmation that an image is genuine. */
export const hasPropertyPhotoReference = (residence: any): boolean =>
  [residence?.cover_image_url, residence?.image_url].some((value) => typeof value === "string" && value.trim().length > 0)
  || (Array.isArray(residence?.images) && residence.images.some((value: unknown) => typeof value === "string" && value.trim().length > 0));

/** Only an explicit, unambiguous reported distance is filterable. Empty/zero is unknown. */
export const reportedCampusDistanceKm = (input: unknown): number | null => {
  if (typeof input === "number") return Number.isFinite(input) && input > 0 ? input : null;
  if (typeof input !== "string" || !/^\s*\d+(?:\.\d+)?\s*(?:km)?\s*$/i.test(input)) return null;
  const distance = parseFloat(input);
  return Number.isFinite(distance) && distance > 0 ? distance : null;
};

export const hasVerifiedLocation = (residence: any): boolean =>
  residence?.location_verification_status === "verified"
  && Number.isFinite(Number(residence?.latitude))
  && Number.isFinite(Number(residence?.longitude))
  && Number(residence.latitude) >= -90 && Number(residence.latitude) <= 90
  && Number(residence.longitude) >= -180 && Number(residence.longitude) <= 180;
