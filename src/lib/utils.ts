import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeFormatDate(
  date: string | null | undefined,
  formatStr: string = "dd MMM yyyy"
): string {
  if (!date) return "N/A";
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return "Invalid date";
    return format(parsed, formatStr);
  } catch {
    return "Invalid date";
  }
}
