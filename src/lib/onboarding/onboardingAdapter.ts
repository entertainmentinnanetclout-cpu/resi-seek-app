import type { OnboardingRequest, OnboardingStatus } from "./onboardingTypes";
import { MOCK_ONBOARDING_REQUESTS } from "./onboardingMockData";

// Frontend-safe placeholder adapter for onboarding requests.
// Persists submissions to localStorage so the admin hub can demo the flow.
// TODO: connect to Supabase onboarding_requests after backend migration is deployed.

const STORAGE_KEY = "reskonnect.onboarding.requests.v1";

function readStored(): OnboardingRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OnboardingRequest[]) : [];
  } catch {
    return [];
  }
}

function writeStored(list: OnboardingRequest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors in placeholder impl
  }
}

export type OnboardingSubmission = Omit<OnboardingRequest, "id" | "status" | "created_at">;

export async function submitOnboardingRequest(
  payload: OnboardingSubmission
): Promise<OnboardingRequest> {
  // TODO: connect to Supabase onboarding_requests after backend migration is deployed.
  const record: OnboardingRequest = {
    ...payload,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "new",
    created_at: new Date().toISOString(),
  };
  const next = [record, ...readStored()];
  writeStored(next);
  return record;
}

export async function getOnboardingRequests(): Promise<OnboardingRequest[]> {
  // TODO: connect to Supabase onboarding_requests after backend migration is deployed.
  const stored = readStored();
  // Merge stored on top of seed data (stored takes precedence by id).
  const seen = new Set(stored.map((r) => r.id));
  const merged = [...stored, ...MOCK_ONBOARDING_REQUESTS.filter((r) => !seen.has(r.id))];
  return merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function updateOnboardingRequestStatus(
  id: string,
  status: OnboardingStatus,
  patch: Partial<Pick<OnboardingRequest, "assigned_staff" | "notes">> = {}
): Promise<OnboardingRequest | null> {
  // TODO: connect to Supabase onboarding_requests after backend migration is deployed.
  const stored = readStored();
  const idx = stored.findIndex((r) => r.id === id);
  if (idx >= 0) {
    stored[idx] = { ...stored[idx], status, ...patch };
    writeStored(stored);
    return stored[idx];
  }
  // Seed row — promote to stored so updates persist locally.
  const seed = MOCK_ONBOARDING_REQUESTS.find((r) => r.id === id);
  if (!seed) return null;
  const updated: OnboardingRequest = { ...seed, status, ...patch };
  writeStored([updated, ...stored]);
  return updated;
}

export function exportRequestsToCsv(rows: OnboardingRequest[]): string {
  const header = [
    "id",
    "created_at",
    "persona",
    "need",
    "full_name",
    "phone",
    "whatsapp_number",
    "email",
    "status",
    "assigned_staff",
    "notes",
  ];
  const escape = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const body = rows
    .map((r) =>
      [
        r.id,
        r.created_at,
        r.persona,
        r.need,
        r.full_name,
        r.phone,
        r.whatsapp_number,
        r.email,
        r.status,
        r.assigned_staff,
        r.notes,
      ]
        .map(escape)
        .join(",")
    )
    .join("\n");
  return `${header.join(",")}\n${body}`;
}