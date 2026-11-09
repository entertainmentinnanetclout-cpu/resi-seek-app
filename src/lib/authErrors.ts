/**
 * Auth API 5xx/504 failures are distinct from a bad password. Always preserve
 * the user's attempt and let the user retry; never automatically submit the
 * same password in a loop during a database outage.
 */
const NETWORK_HINTS = [
  "failed to fetch",
  "networkerror",
  "network request failed",
  "load failed",
  "fetch failed",
];

export const NETWORK_ERROR_MESSAGE =
  "ResKonnect could not contact the sign-in service. It may be temporarily unavailable. Check your connection, then retry.";

export const TEMPORARY_AUTH_SERVICE_MESSAGE =
  "ResKonnect sign-in is temporarily unavailable due to a server or database connection problem. Your password may be correct. Please retry shortly; you do not need to create a new account.";

const asAuthError = (error: unknown): { message?: string; status?: number | string; code?: string; name?: string } =>
  (error && typeof error === "object" ? error : { message: typeof error === "string" ? error : "" }) as {
    message?: string; status?: number | string; code?: string; name?: string
  };

/** 429 and invalid_credentials are NOT a service outage; don't retry those automatically. */
export const isTemporaryAuthServiceError = (error: unknown): boolean => {
  const item = asAuthError(error);
  const status = Number(item.status || 0);
  const code = String(item.code || "").toLowerCase();
  const raw = String(item.message || "").toLowerCase();
  if (status === 429 || code === "invalid_credentials" || code.startsWith("over_")) return false;
  return [500, 502, 503, 504].includes(status)
    || ["request_timeout", "unexpected_failure", "service_unavailable"].includes(code)
    || /context deadline exceeded|database connection timeout|connection terminated due to connection timeout/.test(raw);
};

export const getAuthErrorMessage = (
  error: unknown,
  fallback = "An unexpected error occurred.",
): string => {
  const item = asAuthError(error);
  const raw = String(item.message || "");
  const code = String(item.code || "").toLowerCase();
  const status = Number(item.status || 0);
  if (isTemporaryAuthServiceError(error)) return TEMPORARY_AUTH_SERVICE_MESSAGE;
  if (status === 429 || code === "over_request_rate_limit" || code === "over_email_send_rate_limit") {
    return "Too many sign-in attempts. Please wait before trying again; avoid repeatedly submitting your password.";
  }
  if (!raw) return fallback;
  if (NETWORK_HINTS.some((hint) => raw.toLowerCase().includes(hint))) return NETWORK_ERROR_MESSAGE;
  return raw;
};
