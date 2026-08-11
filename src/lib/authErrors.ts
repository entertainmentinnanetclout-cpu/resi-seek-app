/**
 * Maps raw auth/network errors to friendly, user-facing copy.
 * A browser "Failed to fetch" means the request never reached our servers
 * (offline, blocked by an extension/firewall, or a hosting challenge page).
 */
const NETWORK_HINTS = [
  "failed to fetch",
  "networkerror",
  "network request failed",
  "load failed",
  "fetch failed",
];

export const NETWORK_ERROR_MESSAGE =
  "We can't reach the ResKonnect servers right now. Please check your connection, disable any ad blocker or VPN, and try again.";

export const getAuthErrorMessage = (
  error: unknown,
  fallback = "An unexpected error occurred.",
): string => {
  const raw =
    typeof error === "string"
      ? error
      : (error as { message?: string } | null)?.message ?? "";

  if (!raw) return fallback;
  if (NETWORK_HINTS.some((hint) => raw.toLowerCase().includes(hint))) {
    return NETWORK_ERROR_MESSAGE;
  }
  return raw;
};
