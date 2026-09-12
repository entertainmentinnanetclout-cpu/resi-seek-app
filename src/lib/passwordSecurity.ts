export type WeakPasswordSignal = {
  message?: string | null;
  reasons?: string[] | null;
  detectedAt?: string;
};

const storageKey = (userId: string) => `rk:weak-password:${userId}`;

export function rememberWeakPassword(userId: string, signal?: { message?: string; reasons?: string[] } | null) {
  if (!userId || !signal) return;
  const payload: WeakPasswordSignal = {
    message: signal.message || "Your current password should be updated.",
    reasons: Array.isArray(signal.reasons) ? signal.reasons : [],
    detectedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey(userId), JSON.stringify(payload));
}

export function readWeakPassword(userId?: string | null): WeakPasswordSignal | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as WeakPasswordSignal;
  } catch {
    return null;
  }
}

export function clearWeakPassword(userId?: string | null) {
  if (!userId) return;
  localStorage.removeItem(storageKey(userId));
}
