import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v3.0.0-god-mode";
const ALLOWED_MODES = new Set(["strict_handover", "document_handover"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_]/g, "_").substring(0, 60);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Server configuration error", _version: VERSION }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header", _version: VERSION }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", _version: VERSION }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: isAdmin }, { data: isOps }] = await Promise.all([
      adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      adminClient.rpc("has_role", { _user_id: user.id, _role: "operations_lead" }),
    ]);
    if (!isAdmin && !isOps) {
      return new Response(JSON.stringify({ error: "Handover export access required", _version: VERSION }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const residenceId = body?.residence_id ?? null;
    const mode = ALLOWED_MODES.has(body?.mode) ? body.mode : "strict_handover";
    if (!residenceId) {
      return new Response(JSON.stringify({ error: "residence_id is required for a handover pack", _version: VERSION }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL: there is deliberately no skip_validation switch. Validation and rows
    // are produced by one database transaction snapshot to prevent time-of-check/time-of-use drift.
    const { data: prepared, error: prepError } = await adminClient.rpc("prepare_handover_export", {
      _residence_id: residenceId,
      _mode: mode,
    });
    if (prepError) {
      console.error(`[${VERSION}] prepare_handover_export failed`, prepError);
      return new Response(JSON.stringify({ error: "Verified export preparation failed", detail: prepError.message, _version: VERSION }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!prepared?.ok) {
      return new Response(JSON.stringify({
        error: "DATA INTEGRITY ERROR — handover pack blocked",
        validation: prepared?.validation ?? null,
        _version: VERSION,
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rows = Array.isArray(prepared.rows) ? prepared.rows : [];
    if (!rows.length) {
      return new Response(JSON.stringify({ error: "No handover-ready applications found", _version: VERSION }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
    const { data: documents, error: documentsError } = await adminClient
      .from("documents").select("user_id,document_type,file_name,status").in("user_id", userIds);
    if (documentsError) console.warn(`[${VERSION}] document list unavailable`, documentsError.message);
    const docsByUser = new Map<string, any[]>();
    for (const doc of documents ?? []) {
      const list = docsByUser.get(doc.user_id) ?? [];
      list.push(doc);
      docsByUser.set(doc.user_id, list);
    }

    const residenceName = rows[0]?.residence_name || "Residence";
    const generatedAt = prepared.generated_at || new Date().toISOString();
    const fingerprint = prepared.fingerprint || "unavailable";
    const runId = prepared.run_id || "unavailable";
    const warningCount = prepared.validation?.warnings ?? 0;

    const summaryHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Verified Handover Pack - ${escapeHtml(residenceName)}</title>
<style>
*{box-sizing:border-box}body{font-family:Inter,Segoe UI,Arial,sans-serif;margin:0;background:#f8fafc;color:#0f172a;font-size:12px}.hero{background:linear-gradient(135deg,#071326,#12346b);color:#fff;padding:28px 32px}.brand{font-size:24px;font-weight:900}.gold{color:#f5b32f}.hero h1{margin:12px 0 4px;font-size:28px}.hero p{margin:0;color:#cbd5e1}.wrap{padding:22px 28px}.proof{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}.proof div{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px}.k{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}.v{font-weight:800;margin-top:4px;word-break:break-all}.verified{border:1px solid #86efac;background:#f0fdf4;color:#166534;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-weight:700}.warning{border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:10px;padding:10px 14px;margin-bottom:16px}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0}th{background:#071326;color:#fff;text-align:left;padding:9px 7px;font-size:9px;text-transform:uppercase;letter-spacing:.04em}td{padding:9px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top}tr:nth-child(even){background:#f8fafc}.badge{display:inline-block;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:800;background:#e0e7ff;color:#3730a3}.footer{padding:18px 28px;color:#64748b;font-size:10px}.fingerprint{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}@media print{body{background:#fff}.wrap{padding:12px}.hero{padding:18px}.proof{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<section class="hero"><div class="brand">Res<span class="gold">Konnect</span></div><h1>Verified Handover Pack</h1><p>${escapeHtml(residenceName)} · ${escapeHtml(mode.replaceAll("_", " "))}</p></section>
<main class="wrap">
<div class="proof">
<div><div class="k">Generated</div><div class="v">${escapeHtml(new Date(generatedAt).toLocaleString("en-ZA"))}</div></div>
<div><div class="k">Verified rows</div><div class="v">${rows.length}</div></div>
<div><div class="k">Integrity run</div><div class="v">${escapeHtml(runId)}</div></div>
<div><div class="k">Warnings</div><div class="v">${warningCount}</div></div>
</div>
<div class="verified">✓ GOD MODE integrity gate passed. Duplicate, identity, funding, contact, residence and workflow blockers were rechecked atomically before this pack was generated.</div>
${warningCount ? `<div class="warning">${warningCount} non-blocking advisory warning(s) remain. Use Document Handover mode when document completeness must also be a hard requirement.</div>` : ""}
<table><thead><tr><th>#</th><th>Ref</th><th>Applicant</th><th>Student # / ID</th><th>Funding</th><th>Contact</th><th>Campus / Course</th><th>Status</th><th>Documents</th></tr></thead><tbody>
${rows.map((r: any, index: number) => {
  const docs = docsByUser.get(r.user_id) ?? [];
  const identity = r.student_number || r.identity_number || "—";
  const docText = docs.length ? docs.map((d: any) => d.document_type).join(", ") : "None";
  return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(r.ref_code)}</strong></td><td><strong>${escapeHtml(r.full_name)}</strong></td><td>${escapeHtml(identity)}</td><td>${escapeHtml(r.funding_source)}</td><td>${escapeHtml(r.phone)}<br>${escapeHtml(r.email)}</td><td>${escapeHtml(r.campus)}<br>${escapeHtml(r.course || "—")}</td><td><span class="badge">${escapeHtml(String(r.status || "").replaceAll("_", " "))}</span><br>${escapeHtml(formatDate(r.application_date))}</td><td>${escapeHtml(docText)}</td></tr>`;
}).join("")}
</tbody></table>
<div class="verified" style="margin-top:16px"><div class="k">SHA-256 dataset fingerprint</div><div class="v fingerprint">${escapeHtml(fingerprint)}</div></div>
</main>
<footer class="footer">ResKonnect · LIVING • AI • OPPORTUNITY · Verified Handover OS ${escapeHtml(VERSION)}. This pack has no validation bypass path.</footer>
</body></html>`;

    const today = new Date().toISOString().slice(0, 10);
    return new Response(summaryHtml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="ResKonnect_Verified_Handover_${sanitizeFileName(residenceName)}_${today}.html"`,
        "X-ResKonnect-Integrity-Run": String(runId),
        "X-ResKonnect-Fingerprint": String(fingerprint),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error(`[${VERSION}]`, message);
    return new Response(JSON.stringify({ error: message, _version: VERSION }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
