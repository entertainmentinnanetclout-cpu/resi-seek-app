import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (name: string) => Deno.env.get(name) || "";
const supabaseUrl = env("SUPABASE_URL") || env("EXTERNAL_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey = env("SUPABASE_ANON_KEY") || env("EXTERNAL_SUPABASE_ANON_KEY");
const routineModel = "gpt-5.6-luna";
const complexModel = "gpt-5.6-terra";

const extractText = (data: any) => {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) for (const part of item?.content || []) if (part?.type === "output_text" && typeof part?.text === "string") return part.text;
  return data?.choices?.[0]?.message?.content || "";
};

const parseAgentJson = (raw: string) => {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      answer: String(parsed.answer || ""),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.75))),
      risk: ["green", "amber", "red"].includes(parsed.risk) ? parsed.risk : "amber",
      escalate: Boolean(parsed.escalate),
      reason: String(parsed.reason || ""),
    };
  } catch {
    return { answer: raw.trim(), confidence: 0.72, risk: "amber", escalate: true, reason: "Model output was not structured." };
  }
};

const costFor = (model: string, input = 0, output = 0) => {
  const rates: Record<string, [number, number]> = {
    "gpt-5.6-luna": [0.20, 1.20],
    "gpt-5.6-terra": [2.00, 12.00],
    "gpt-5.6-sol": [4.00, 20.00],
  };
  const [ri, ro] = rates[model] || [0, 0];
  return (input / 1_000_000) * ri + (output / 1_000_000) * ro;
};

async function probeOpenAIKey(openaiKey: string) {
  if (!openaiKey) return { ok: false, error: "OPENAI_API_KEY is not configured" };
  const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(routineModel)}`, {
    headers: { Authorization: `Bearer ${openaiKey}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: data?.error?.message || `OpenAI HTTP ${response.status}` };
  return { ok: true, model: data?.id || routineModel, owned_by: data?.owned_by || "openai" };
}

async function runOpenAITest(openaiKey: string) {
  if (!openaiKey) return { ok: false, error: "OPENAI_API_KEY is not configured" };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: routineModel,
      input: "Reply with exactly: OK",
      reasoning: { effort: "none" },
      max_output_tokens: 16,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: data?.error?.message || `OpenAI HTTP ${response.status}` };
  return { ok: true, model: data?.model || routineModel, response_id: data?.id || null, output_text: extractText(data) };
}

async function setOpenAIConnection(service: any, result: { ok: boolean; model?: string; error?: string }, tested = false) {
  const now = new Date().toISOString();
  const patch = result.ok
    ? {
        status: "connected",
        enabled: true,
        setup_step: 3,
        external_account_label: `OpenAI API · ${result.model || routineModel}`,
        last_tested_at: tested ? now : undefined,
        last_success_at: now,
        last_error: null,
        last_error_at: null,
      }
    : {
        status: "needs_action",
        enabled: false,
        setup_step: 2,
        last_tested_at: tested ? now : undefined,
        last_error: result.error || "OpenAI verification failed",
        last_error_at: now,
      };
  const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  await service.from("adminos_integration_connections").update(clean).eq("provider", "openai");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Supabase runtime is not configured" }, 500);

  const started = Date.now();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || body.task || "general");
  const openaiKey = env("OPENAI_API_KEY");
  const lovableKey = env("LOVABLE_API_KEY");
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (action === "health") {
    const existing = await service.from("adminos_integration_connections").select("status,enabled").eq("provider", "openai").maybeSingle();
    let verification: any = {
      ok: existing.data?.status === "connected" && existing.data?.enabled === true,
      model: routineModel,
      error: null,
    };
    if (openaiKey && !verification.ok) {
      verification = await probeOpenAIKey(openaiKey);
      await setOpenAIConnection(service, verification, false);
    } else if (!openaiKey && existing.data?.status === "connected") {
      verification = { ok: false, error: "OPENAI_API_KEY is not configured", model: routineModel };
      await setOpenAIConnection(service, verification, false);
    }
    return json({
      ok: Boolean(verification.ok || lovableKey),
      primary: verification.ok ? "openai" : null,
      fallback: lovableKey ? "lovable_gateway" : null,
      openai_configured: Boolean(openaiKey),
      openai_verified: Boolean(verification.ok),
      model: verification.model || routineModel,
      error: verification.error || null,
      models: { routine: routineModel, complex: complexModel, fallback: "google/gemini-2.5-flash" },
      release: 4,
      phase: 3,
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await authClient.auth.getUser();
  const user = userData?.user || null;
  let staffRole: string | null = null;
  if (user) {
    const { data } = await service.rpc("get_user_staff_role", { _user_id: user.id });
    staffRole = data || null;
  }

  if (action === "test") {
    if (!user || !staffRole) return json({ error: "Staff access required" }, 403);
    const test = await runOpenAITest(openaiKey);
    await setOpenAIConnection(service, test, true);
    if (!test.ok) return json({ error: test.error, openai_configured: Boolean(openaiKey), openai_verified: false }, 503);
    return json({ ok: true, openai_configured: true, openai_verified: true, primary: "openai", model: test.model || routineModel, response_id: test.response_id || null });
  }

  if (!user && action !== "public_enquiry") return json({ error: "Authentication required" }, 401);
  if (!["public_enquiry", "enquiry_reply"].includes(action) && !staffRole) return json({ error: "Staff access required" }, 403);

  const contactId = body.contact_id ? String(body.contact_id) : null;
  let contact: any = null;
  if (contactId) {
    const { data } = await service.from("adminos_contacts").select("*").eq("id", contactId).maybeSingle();
    contact = data;
    if (!staffRole && action === "enquiry_reply" && contact?.profile_user_id !== user?.id) return json({ error: "Contact access denied" }, 403);
  }

  const { data: cfg } = await service.from("adminos_agent_config").select("*").eq("agent_key", "konnect_agent").maybeSingle();
  if (!cfg?.enabled) return json({ error: "Konnect Agent is paused by AdminOS" }, 503);
  const threshold = Number(cfg.confidence_threshold || 0.86);
  const { data: promptRow } = await service.from("adminos_agent_prompt_versions").select("system_prompt,policy,tool_allowlist,version").eq("agent_key", "konnect_agent").eq("active", true).maybeSingle();
  const systemPrompt = promptRow?.system_prompt || "You are Konnect Agent. Return JSON only with answer, confidence, risk, escalate, reason.";

  const sources = await service.from("adminos_knowledge_sources").select("id").eq("status", "active").limit(20);
  const sourceIds = (sources.data || []).map((s: any) => s.id);
  let knowledge: any[] = [];
  if (sourceIds.length) {
    const k = await service.from("adminos_knowledge_entries").select("title,content,structured_data,confidence,valid_until").in("source_id", sourceIds).limit(30);
    knowledge = (k.data || []).filter((x: any) => !x.valid_until || new Date(x.valid_until) > new Date());
  }

  let applications: any[] = [];
  if (contact?.profile_user_id) {
    const apps = await service.from("applications").select("id,status,funding_type,created_at,updated_at,residence_id,residences(name,campus,price,available_spots)").eq("user_id", contact.profile_user_id).order("updated_at", { ascending: false }).limit(8);
    applications = apps.data || [];
  }

  let history: any[] = [];
  if (body.thread_id) {
    const h = await service.from("adminos_enquiry_messages").select("sender_type,content,created_at").eq("thread_id", String(body.thread_id)).order("created_at", { ascending: true }).limit(12);
    history = h.data || [];
  }

  const message = String(body.message || body.content || "").slice(0, 12000);
  if (!message.trim()) return json({ error: "Message is required" }, 400);
  const context = {
    task: action,
    contact: action === "public_enquiry" ? null : contact ? { id: contact.id, full_name: contact.full_name, campus: contact.campus, student_number: contact.student_number } : null,
    applications,
    history,
    knowledge,
    additional_context: body.context || null,
  };
  const highComplexity = body.complexity === "high" || (action === "email_draft" && message.length > 4000);
  const model = highComplexity ? (cfg.config?.complex_model || complexModel) : (cfg.config?.primary_model || routineModel);
  const userPrompt = `TASK: ${action}\nUSER MESSAGE:\n${message}\n\nTRUSTED CONTEXT JSON:\n${JSON.stringify(context).slice(0, Number(cfg.config?.cost_guard?.max_context_chars || 18000))}\n\nReturn only valid JSON with: answer:string, confidence:number 0..1, risk:green|amber|red, escalate:boolean, reason:string.`;

  const { data: run, error: runErr } = await service.from("adminos_agent_runs").insert({
    agent_key: "konnect_agent",
    trigger_type: action,
    trigger_id: body.thread_id || null,
    status: "running",
    input: { contact_id: contactId, message: message.slice(0, 2000), model },
    created_by: user?.id || null,
  }).select("id").single();
  if (runErr || !run) return json({ error: "Could not start agent run" }, 500);

  let provider = "";
  let usedModel = model;
  let raw = "";
  let usage: any = {};
  let lastError = "";

  if (openaiKey) {
    try {
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          input: [
            { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
            { role: "user", content: [{ type: "input_text", text: userPrompt }] },
          ],
          max_output_tokens: Number(cfg.config?.max_output_tokens || 700),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${r.status}`);
      raw = extractText(data);
      usage = data?.usage || {};
      provider = "openai";
      await service.from("adminos_integration_connections").update({ status: "connected", enabled: true, setup_step: 3, external_account_label: `OpenAI API · ${model}`, last_success_at: new Date().toISOString(), last_error: null, last_error_at: null }).eq("provider", "openai");
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      await service.from("adminos_integration_connections").update({ status: "error", enabled: false, setup_step: 2, last_error: lastError, last_error_at: new Date().toISOString() }).eq("provider", "openai");
    }
  }

  if (!raw && lovableKey) {
    try {
      usedModel = cfg.config?.fallback_model || "google/gemini-2.5-flash";
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: usedModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: Number(cfg.config?.max_output_tokens || 700) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error?.message || `AI gateway HTTP ${r.status}`);
      raw = extractText(data);
      usage = data?.usage || {};
      provider = "lovable_gateway";
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  if (!raw) {
    await service.from("adminos_agent_runs").update({ status: "failed", completed_at: new Date().toISOString(), output: { error: lastError || "No AI provider configured" } }).eq("id", run.id);
    await service.from("adminos_agent_errors").insert({ run_id: run.id, error_code: "provider_unavailable", error_message: lastError || "No AI provider configured", context: { action }, retryable: true });
    return json({ error: "AI provider unavailable", detail: lastError || null, escalate: true }, 503);
  }

  const result = parseAgentJson(raw);
  if (result.confidence < threshold) {
    result.escalate = true;
    if (result.risk === "green") result.risk = "amber";
    result.reason = result.reason || `Confidence below ${threshold}`;
  }
  if (/(bank\s*details|change\s*bank|lawyer|legal action|fraud|breach|liability|sign\s*(a|the)?\s*lease|refund dispute|threat)/i.test(message)) {
    result.escalate = true;
    if (result.risk === "green") result.risk = "amber";
  }

  await service.from("adminos_agent_runs").update({ status: result.escalate ? "awaiting_approval" : "succeeded", output: result, completed_at: new Date().toISOString() }).eq("id", run.id);
  await service.from("adminos_agent_actions").insert({
    run_id: run.id,
    agent_key: "konnect_agent",
    action_type: action,
    entity_type: body.entity_type || null,
    entity_id: body.entity_id || body.thread_id || null,
    authority_level: result.risk,
    confidence: result.confidence,
    reason: result.reason,
    tool_name: "reason_and_draft",
    request_payload: { provider, model: usedModel },
    response_payload: result,
    status: result.escalate ? "awaiting_approval" : "executed",
    executed_at: result.escalate ? null : new Date().toISOString(),
  });
  const inputTokens = Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0) || null;
  const outputTokens = Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0) || null;
  await service.from("adminos_agent_usage").insert({
    run_id: run.id,
    agent_key: "konnect_agent",
    provider,
    model: usedModel,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: provider === "openai" ? costFor(usedModel, inputTokens || 0, outputTokens || 0) : null,
    latency_ms: Date.now() - started,
  });
  return json({ ...result, run_id: run.id, provider, model: usedModel, threshold, release: 4, phase: 3 });
});
