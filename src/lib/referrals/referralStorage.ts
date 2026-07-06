// Persistent referral session storage (localStorage + cookie fallback).
export const REF_KEYS = {
  code: "rk_ref_code",
  sessionId: "rk_ref_session_id",
  agentName: "rk_ref_agent",
  landing: "rk_ref_landing_url",
  createdAt: "rk_ref_created_at",
  bannerHidden: "rk_ref_banner_hidden",
  pendingApplication: "rk_pending_application_intent",
  pendingRecruiter: "rk_pending_recruiter_application",
  visitorId: "rk_visitor_id",
} as const;

const THIRTY_DAYS = 60 * 60 * 24 * 30;

function setCookie(name: string, value: string, maxAge = THIRTY_DAYS) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  } catch {}
}

function getCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

export function saveReferral(code: string, sessionId?: string | null, agentName?: string | null, landing?: string) {
  const upper = code.trim().toUpperCase();
  try {
    localStorage.setItem(REF_KEYS.code, upper);
    if (sessionId) localStorage.setItem(REF_KEYS.sessionId, sessionId);
    if (agentName) localStorage.setItem(REF_KEYS.agentName, agentName);
    if (landing) localStorage.setItem(REF_KEYS.landing, landing);
    localStorage.setItem(REF_KEYS.createdAt, new Date().toISOString());
    localStorage.removeItem(REF_KEYS.bannerHidden);
  } catch {}
  setCookie(REF_KEYS.code, upper);
}

export function readReferral() {
  try {
    const code = localStorage.getItem(REF_KEYS.code) || getCookie(REF_KEYS.code);
    if (!code) return null;
    return {
      code,
      sessionId: localStorage.getItem(REF_KEYS.sessionId),
      agentName: localStorage.getItem(REF_KEYS.agentName),
      landing: localStorage.getItem(REF_KEYS.landing),
      createdAt: localStorage.getItem(REF_KEYS.createdAt),
      bannerHidden: localStorage.getItem(REF_KEYS.bannerHidden) === "1",
    };
  } catch { return null; }
}

export function hideReferralBanner() {
  try { localStorage.setItem(REF_KEYS.bannerHidden, "1"); } catch {}
}

export function clearReferral() {
  try {
    Object.values(REF_KEYS).forEach((k) => localStorage.removeItem(k));
  } catch {}
  setCookie(REF_KEYS.code, "", 0);
}

export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(REF_KEYS.visitorId);
    if (!v) {
      v = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(REF_KEYS.visitorId, v);
    }
    return v;
  } catch { return "v_anon"; }
}

// ---- Pending intents ----
export interface PendingApplicationIntent {
  residence_id: string;
  residence_name?: string;
  current_route: string;
  referral_code?: string | null;
  referral_session_id?: string | null;
  timestamp: string;
}

export function savePendingApplication(intent: PendingApplicationIntent) {
  try { localStorage.setItem(REF_KEYS.pendingApplication, JSON.stringify(intent)); } catch {}
}
export function readPendingApplication(): PendingApplicationIntent | null {
  try {
    const raw = localStorage.getItem(REF_KEYS.pendingApplication);
    return raw ? JSON.parse(raw) as PendingApplicationIntent : null;
  } catch { return null; }
}
export function clearPendingApplication() {
  try { localStorage.removeItem(REF_KEYS.pendingApplication); } catch {}
}

export function savePendingRecruiter() {
  try { localStorage.setItem(REF_KEYS.pendingRecruiter, "1"); } catch {}
}
export function readPendingRecruiter(): boolean {
  try { return localStorage.getItem(REF_KEYS.pendingRecruiter) === "1"; } catch { return false; }
}
export function clearPendingRecruiter() {
  try { localStorage.removeItem(REF_KEYS.pendingRecruiter); } catch {}
}