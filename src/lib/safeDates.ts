import { formatDistanceToNow } from "date-fns";

export function parseSafeDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function safeRelativeTime(value: unknown, fallback = "Recently"): string {
  const date = parseSafeDate(value);
  if (!date) return fallback;
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return fallback;
  }
}

export function safeShortDate(value: unknown, fallback = "Open"): string {
  const date = parseSafeDate(value);
  if (!date) return fallback;
  try {
    return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  } catch {
    return fallback;
  }
}
