import { supabase } from "@/integrations/supabase/client";

export async function getReferralPublic(code: string) {
  const { data, error } = await supabase.rpc("get_referral_public" as any, { _code: code });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.is_active) return null;
  return row as { code: string; agent_name: string; is_active: boolean };
}

export async function captureReferralClick(code: string, visitorId: string, landingUrl: string) {
  const { data, error } = await supabase.rpc("capture_referral_click" as any, {
    _code: code,
    _visitor_id: visitorId,
    _landing_url: landingUrl,
    _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  if (error) return null;
  return data as string | null;
}

export async function attachReferralToUser(sessionId: string) {
  await supabase.rpc("attach_referral_to_user" as any, { _session_id: sessionId });
}

export async function captureApplicationReferral(applicationId: string, code?: string | null, sessionId?: string | null, programKey?: string | null) {
  // Enforce program_key check client-side too (though server also enforces it)
  if (programKey && programKey !== 'student_recruitment') {
    return false;
  }
  const { data, error } = await supabase.rpc("capture_application_referral" as any, {
    _application_id: applicationId,
    _code: code ?? null,
    _session_id: sessionId ?? null,
  });
  if (error) return false;
  return Boolean(data);
}

export async function submitRecruiterApplication(payload: Record<string, any>) {
  return supabase.rpc("submit_recruiter_application" as any, { payload });
}

export async function adminBulkUpdateAudience(residenceIds: string[], mode: "add" | "remove" | "set", audiences: Array<"university" | "tvet_college" | "private">) {
  return supabase.rpc("admin_bulk_update_residence_audience" as any, {
    _residence_ids: residenceIds,
    _mode: mode,
    _audiences: audiences,
  });
}

export async function adminApproveRecruiter(appId: string) {
  return supabase.rpc("admin_approve_recruiter_application" as any, { _app_id: appId });
}

export async function adminRejectRecruiter(appId: string, reason?: string) {
  return supabase.rpc("admin_reject_recruiter_application" as any, { _app_id: appId, _reason: reason ?? null });
}

export async function adminMarkReferralStatus(applicationId: string, status: string) {
  return supabase.rpc("admin_mark_referral_status" as any, { _application_id: applicationId, _status: status });
}