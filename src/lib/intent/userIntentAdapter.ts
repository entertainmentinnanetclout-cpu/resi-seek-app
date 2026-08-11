import type { UserIntent } from "./userIntentTypes";

// Frontend-only intent persistence.
// TODO(backend): no dedicated user_intent table/column exists yet. When a backend
// field is available (e.g. profiles.intent_profile jsonb, or
// onboarding_requests.metadata), sync through syncIntentToBackend below.
const STORAGE_KEY = "reskonnect.user_intent.v1";

export function loadIntent(): UserIntent {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserIntent) : {};
  } catch {
    return {};
  }
}

export function saveIntent(intent: UserIntent): UserIntent {
  const next = { ...intent, updated_at: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function clearIntent() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Placeholder sync. Intentionally a no-op today: `onboarding_requests` is not
 * confirmed to exist on the active backend and we must not create migrations.
 * TODO(backend): persist intent to onboarding_requests.metadata (or a
 * user_intent_profiles table) once the schema is available.
 */
export async function syncIntentToBackend(_userId: string, _intent: UserIntent): Promise<void> {
  return;
}
