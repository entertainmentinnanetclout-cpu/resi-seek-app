/** Client-side first line of defence; database constraints and RLS remain authoritative. */
export interface RoomIntegrityInput {
  name?: unknown;
  academic_year?: unknown;
  capacity?: unknown;
  available_beds?: unknown;
  private_price?: unknown;
  nsfas_price?: unknown;
  promo_price?: unknown;
  deposit?: unknown;
  admin_fee?: unknown;
  reservation_fee?: unknown;
}

const finite = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function roomIntegrityIssue(row: RoomIntegrityInput): string | null {
  const year = finite(row.academic_year);
  if (!Number.isInteger(year) || (year as number) < 2026 || (year as number) > 2035)
    return "Choose a valid academic year.";
  if (!String(row.name ?? "").trim()) return "Enter a room-type name.";
  const capacity = finite(row.capacity);
  const available = finite(row.available_beds);
  if (!Number.isInteger(capacity) || (capacity as number) <= 0)
    return "Capacity must be a whole number greater than zero.";
  if (!Number.isInteger(available) || (available as number) < 0 || (available as number) > (capacity as number))
    return "Available beds must be between zero and capacity.";
  for (const key of ["private_price", "nsfas_price", "promo_price", "deposit", "admin_fee", "reservation_fee"] as const) {
    const value = finite(row[key]);
    if (row[key] !== null && row[key] !== undefined && row[key] !== "" && (value === null || value < 0))
      return `${key.replace(/_/g, " ")} must be a nonnegative Rand amount.`;
  }
  const privateRent = finite(row.private_price);
  const nsfasRate = finite(row.nsfas_price);
  if (!(privateRent && privateRent > 0) && !(nsfasRate && nsfasRate > 0))
    return "Supply a positive monthly rate for at least one funding route. Missing rates are not free rooms.";
  const promo = finite(row.promo_price);
  if (promo !== null && promo > 0 && !(privateRent && privateRent > 0 && promo < privateRent))
    return "A promotional private rate must be below the published private monthly rate.";
  return null;
}
