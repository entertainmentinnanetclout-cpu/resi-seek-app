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
const openaiKey = env("OPENAI_API_KEY");
const githubToken = env("GITHUB_TOKEN");
const REPO = "entertainmentinnanetclout-cpu/resi-seek-app";
const PUBLIC_BASE = "https://www.reskonnect.org";

const service = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const normalize = (value: string) => String(value || "").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function redactPII(value: string) {
  let text = String(value || "");
  let pii = false;
  const replace = (re: RegExp, token: string) => {
    text = text.replace(re, () => { pii = true; return token; });
  };
  replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");
  replace(/(?:\+27|0)[6-8][0-9](?:[\s-]?[0-9]){7}\b/g, "[PHONE]");
  replace(/\b\d{13}\b/g, "[ID_NUMBER]");
  replace(/\b(?:2\d{8,11}|\d{9,12})\b/g, "[IDENTIFIER]");
  replace(/\b(?:password|otp|pin)\s*[:=-]?\s*\S+/gi, "[SECRET]");
  return { text: text.slice(0, 8000), pii };
}

const extractText = (data: any) => {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) for (const part of item?.content || []) if (part?.type === "output_text" && typeof part?.text === "string") return part.text;
  return data?.choices?.[0]?.message?.content || "";
};

async function getSettings() {
  const { data } = await service!.from("dimpho_intelligence_settings").select("*").eq("id", 1).maybeSingle();
  return data || {
    learning_enabled: true,
    pii_redaction_enabled: true,
    auto_promote_style_examples: true,
    auto_promote_fact_updates: false,
    min_auto_promote_score: 0.94,
    min_repeated_occurrences: 2,
    knowledge_index_enabled: true,
    app_sync_enabled: true,
    embedding_model: "text-embedding-3-small",
    reasoning_model: "gpt-5.6-luna",
  };
}

function chunkText(input: string, maxChars = 1800, overlap = 220) {
  const clean = String(input || "").replace(/\r/g, "").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + maxChars);
    if (end < clean.length) {
      const preferred = Math.max(clean.lastIndexOf("\n\n", end), clean.lastIndexOf(". ", end), clean.lastIndexOf("\n", end));
      if (preferred > start + Math.floor(maxChars * 0.55)) end = preferred + 1;
    }
    const part = clean.slice(start, end).trim();
    if (part) chunks.push(part);
    if (end >= clean.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks.slice(0, 120);
}

async function embed(input: string[], model: string): Promise<(number[] | null)[]> {
  if (!openaiKey || !input.length) return input.map(() => null);
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Embedding HTTP ${response.status}`);
  const ordered = [...(data.data || [])].sort((a: any, b: any) => a.index - b.index);
  return input.map((_, i) => ordered[i]?.embedding || null);
}

async function processKnowledgeJobs(settings: any, limit = 12) {
  if (!settings.knowledge_index_enabled) return { processed: 0, failed: 0, embedded: 0 };
  const { data: jobs } = await service!.from("dimpho_knowledge_jobs").select("id,document_id,job_type,attempts").eq("status", "queued").lte("available_at", new Date().toISOString()).order("created_at").limit(limit);
  let processed = 0, failed = 0, embedded = 0;
  for (const job of jobs || []) {
    await service!.from("dimpho_knowledge_jobs").update({ status: "processing", attempts: Number(job.attempts || 0) + 1 }).eq("id", job.id);
    try {
      const { data: doc, error } = await service!.from("dimpho_knowledge_documents").select("*").eq("id", job.document_id).maybeSingle();
      if (error) throw error;
      if (!doc || doc.status !== "published" || job.job_type === "delete") {
        await service!.from("dimpho_knowledge_chunks").delete().eq("document_id", job.document_id);
      } else {
        const parts = chunkText(doc.content);
        const embeddings: (number[] | null)[] = [];
        for (let i = 0; i < parts.length; i += 24) embeddings.push(...await embed(parts.slice(i, i + 24), settings.embedding_model || "text-embedding-3-small"));
        await service!.from("dimpho_knowledge_chunks").delete().eq("document_id", doc.id);
        const rows = [];
        for (let i = 0; i < parts.length; i++) {
          const content = parts[i];
          const checksum = await sha256(content);
          const vector = embeddings[i];
          if (vector) embedded++;
          rows.push({
            document_id: doc.id,
            chunk_index: i,
            title: doc.title,
            content,
            token_estimate: Math.ceil(content.length / 4),
            embedding: vector ? `[${vector.join(",")}]` : null,
            embedding_model: vector ? settings.embedding_model : null,
            checksum,
            metadata: { source_type: doc.source_type, source_ref: doc.source_ref },
          });
        }
        if (rows.length) {
          const { error: insertError } = await service!.from("dimpho_knowledge_chunks").insert(rows);
          if (insertError) throw insertError;
        }
        await service!.from("dimpho_knowledge_documents").update({ checksum: await sha256(doc.content), updated_at: new Date().toISOString() }).eq("id", doc.id);
      }
      await service!.from("dimpho_knowledge_jobs").update({ status: "succeeded", completed_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
      processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await service!.from("dimpho_knowledge_jobs").update({ status: Number(job.attempts || 0) >= 2 ? "failed" : "queued", available_at: new Date(Date.now() + 5 * 60_000).toISOString(), last_error: message }).eq("id", job.id);
      failed++;
    }
  }
  return { processed, failed, embedded };
}

async function fetchConversation(channel: string, threadId: string) {
  if (channel === "whatsapp") {
    const { data } = await service!.from("adminos_whatsapp_messages").select("id,direction,body_text,created_at,received_at,sent_at,status,confidence,risk_level").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(40);
    return (data || []).map((m: any) => ({ id: m.id, role: m.direction === "inbound" ? "user" : "assistant", text: m.body_text || "", at: m.received_at || m.sent_at || m.created_at, meta: { status: m.status, confidence: m.confidence, risk: m.risk_level } }));
  }
  if (channel === "in_app") {
    const { data } = await service!.from("adminos_enquiry_messages").select("id,sender_type,direction,content,created_at,status,confidence,risk_level").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(40);
    return (data || []).map((m: any) => ({ id: m.id, role: m.sender_type === "customer" || m.direction === "inbound" ? "user" : "assistant", text: m.content || "", at: m.created_at, meta: { status: m.status, confidence: m.confidence, risk: m.risk_level } }));
  }
  if (channel === "email") {
    const { data } = await service!.from("adminos_email_messages").select("id,direction,subject,body_text,snippet,created_at,received_at,sent_at").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(30);
    return (data || []).map((m: any) => ({ id: m.id, role: m.direction === "inbound" ? "user" : "assistant", text: `${m.subject ? `Subject: ${m.subject}\n` : ""}${m.body_text || m.snippet || ""}`, at: m.received_at || m.sent_at || m.created_at, meta: {} }));
  }
  return [];
}

function safeJson(raw: string) {
  const clean = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

async function inferLesson(channel: string, messages: any[], settings: any) {
  const redacted = messages.map((m) => {
    const r = redactPII(m.text);
    return { role: m.role, text: r.text, pii: r.pii };
  });
  const piiDetected = redacted.some((m) => m.pii);
  const transcript = redacted.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n").slice(-14000);
  if (!openaiKey) {
    const user = [...redacted].reverse().find((m) => m.role === "user")?.text || "";
    const assistant = [...redacted].reverse().find((m) => m.role === "assistant")?.text || "";
    return {
      lesson_type: "successful_resolution",
      category: "general",
      candidate_text: "Conversation captured for later quality review.",
      ideal_response: assistant,
      user_excerpt: user,
      assistant_excerpt: assistant,
      quality_score: 0.55,
      confidence: 0.55,
      safety_score: 0.95,
      sensitive_topic: true,
      pii_detected: piiDetected,
      tags: [channel, "unscored"],
    };
  }

  const prompt = `You are the Dimpho conversation-learning evaluator. Extract ONE reusable lesson from this ResKonnect conversation. The goal is to improve a future ResKonnect-specific model without memorising customers.\n\nRules:\n- Never reproduce names, phone numbers, emails, student numbers, IDs, addresses, passwords, OTPs, payment credentials or other personal identifiers. Replace any missed identifier with [REDACTED].\n- Do not invent ResKonnect facts. New factual claims are knowledge_gap unless supported inside the conversation by a verified backend/tool result.\n- Prefer lessons about excellent service style, workflow continuity, tool selection, resolving a task, avoiding repetition, escalation quality or conversion quality.\n- Mark sensitive_topic=true for legal, safety, fraud, banking, medical, identity, disciplinary, admission/funding decisions or highly personal matters.\n- A lesson can be auto-trained only if it is reusable, non-sensitive, non-personal and high quality.\n\nReturn JSON only with keys: lesson_type (style|workflow|knowledge_gap|successful_resolution|failed_resolution|tool_selection|safety|conversion), category, candidate_text, ideal_response, user_excerpt, assistant_excerpt, quality_score 0..1, confidence 0..1, safety_score 0..1, sensitive_topic boolean, tags string[].\n\nCHANNEL: ${channel}\nTRANSCRIPT:\n${transcript}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: settings.reasoning_model || "gpt-5.6-luna", input: prompt, reasoning: { effort: "none" }, max_output_tokens: 650 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Learning model HTTP ${response.status}`);
  const parsed = safeJson(extractText(data));
  if (!parsed) throw new Error("Learning evaluator returned invalid JSON");
  return {
    lesson_type: ["style","workflow","knowledge_gap","successful_resolution","failed_resolution","tool_selection","safety","conversion"].includes(parsed.lesson_type) ? parsed.lesson_type : "knowledge_gap",
    category: String(parsed.category || "general").slice(0, 120),
    candidate_text: redactPII(String(parsed.candidate_text || "")).text.slice(0, 5000),
    ideal_response: redactPII(String(parsed.ideal_response || "")).text.slice(0, 5000),
    user_excerpt: redactPII(String(parsed.user_excerpt || "")).text.slice(0, 3000),
    assistant_excerpt: redactPII(String(parsed.assistant_excerpt || "")).text.slice(0, 3000),
    quality_score: Math.max(0, Math.min(1, Number(parsed.quality_score || 0))),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
    safety_score: Math.max(0, Math.min(1, Number(parsed.safety_score ?? 1))),
    sensitive_topic: Boolean(parsed.sensitive_topic),
    pii_detected: piiDetected,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((x: any) => String(x).slice(0, 60)).slice(0, 12) : [],
  };
}

async function processLearning(settings: any, maxThreads = 8) {
  if (!settings.learning_enabled) return { threads: 0, candidates: 0, promoted: 0, failed: 0 };
  const { data: events } = await service!.from("dimpho_conversation_events").select("id,channel,thread_id,message_id,attempts").eq("status", "queued").lte("available_at", new Date().toISOString()).not("thread_id", "is", null).order("occurred_at").limit(80);
  const groups = new Map<string, any[]>();
  for (const event of events || []) {
    const key = `${event.channel}:${event.thread_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }
  let threads = 0, candidates = 0, promoted = 0, failed = 0;
  for (const [key, group] of [...groups.entries()].slice(0, maxThreads)) {
    const [channel, threadId] = key.split(":");
    const ids = group.map((e) => e.id);
    await service!.from("dimpho_conversation_events").update({ status: "processing", attempts: Math.max(...group.map((e) => Number(e.attempts || 0))) + 1 }).in("id", ids);
    try {
      const messages = await fetchConversation(channel, threadId);
      if (messages.length < 2 || !messages.some((m) => m.role === "user") || !messages.some((m) => m.role === "assistant")) {
        await service!.from("dimpho_conversation_events").update({ status: "skipped", processed_at: new Date().toISOString(), error_message: "Insufficient two-sided conversation" }).in("id", ids);
        continue;
      }
      const lesson = await inferLesson(channel, messages, settings);
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.text || "";
      const fingerprint = await sha256(`${lesson.lesson_type}|${lesson.category}|${normalize(lastUser).slice(0, 500)}|${normalize(lesson.candidate_text).slice(0, 500)}`);
      const { data: existing } = await service!.from("dimpho_lesson_candidates").select("id,occurrence_count,status,auto_promoted").eq("fingerprint", fingerprint).maybeSingle();
      let candidateId = existing?.id;
      let occurrence = Number(existing?.occurrence_count || 0) + 1;
      if (existing) {
        const threadIds = [threadId];
        await service!.from("dimpho_lesson_candidates").update({
          occurrence_count: occurrence,
          last_seen_at: new Date().toISOString(),
          quality_score: Math.max(Number(lesson.quality_score), 0),
          confidence: Math.max(Number(lesson.confidence), 0),
          safety_score: Math.max(Number(lesson.safety_score), 0),
          source_thread_ids: threadIds,
          candidate_text: lesson.candidate_text,
          ideal_response: lesson.ideal_response,
          user_excerpt_redacted: lesson.user_excerpt,
          assistant_excerpt_redacted: lesson.assistant_excerpt,
          pii_detected: lesson.pii_detected,
          sensitive_topic: lesson.sensitive_topic,
          metadata: { tags: lesson.tags, last_channel: channel },
        }).eq("id", existing.id);
      } else {
        const { data: inserted, error } = await service!.from("dimpho_lesson_candidates").insert({
          fingerprint,
          lesson_type: lesson.lesson_type,
          category: lesson.category,
          user_excerpt_redacted: lesson.user_excerpt,
          assistant_excerpt_redacted: lesson.assistant_excerpt,
          candidate_text: lesson.candidate_text,
          ideal_response: lesson.ideal_response,
          quality_score: lesson.quality_score,
          confidence: lesson.confidence,
          safety_score: lesson.safety_score,
          pii_detected: lesson.pii_detected,
          sensitive_topic: lesson.sensitive_topic,
          source_channel: channel,
          source_thread_ids: [threadId],
          metadata: { tags: lesson.tags },
        }).select("id").single();
        if (error) throw error;
        candidateId = inserted.id;
      }
      candidates++;

      const autoEligibleType = ["style", "workflow", "successful_resolution", "tool_selection", "conversion"].includes(lesson.lesson_type);
      const canPromote = Boolean(settings.auto_promote_style_examples) && autoEligibleType && !lesson.sensitive_topic && !lesson.pii_detected && lesson.safety_score >= 0.98 && lesson.quality_score >= Number(settings.min_auto_promote_score || 0.94) && lesson.confidence >= 0.90 && occurrence >= Number(settings.min_repeated_occurrences || 2) && lesson.ideal_response?.trim();
      if (canPromote && candidateId && !existing?.auto_promoted) {
        const input = lesson.user_excerpt?.trim() || "Representative ResKonnect user request";
        const { error: trainingError } = await service!.from("dimpho_training_examples").upsert({
          source_candidate_id: candidateId,
          category: lesson.category,
          channel,
          user_input: input,
          ideal_output: lesson.ideal_response,
          tags: [...new Set([...(lesson.tags || []), lesson.lesson_type, "auto_promoted"])],
          quality_score: lesson.quality_score,
          provenance: "conversation_learning",
          active: true,
          metadata: { fingerprint, occurrence_count: occurrence, safety_score: lesson.safety_score },
        }, { onConflict: "source_candidate_id" });
        if (trainingError) throw trainingError;
        await service!.from("dimpho_lesson_candidates").update({ status: "auto_promoted", auto_promoted: true, reviewed_at: new Date().toISOString(), metadata: { tags: lesson.tags, auto_reason: "high_confidence_repeated_non_sensitive_pattern" } }).eq("id", candidateId);
        promoted++;
      }

      if (lesson.lesson_type === "knowledge_gap") {
        await service!.rpc("adminos_record_learning_gap", {
          p_question: lesson.user_excerpt || lastUser,
          p_thread_id: threadId,
          p_contact_id: null,
          p_reason: lesson.candidate_text,
          p_category: "dimpho_knowledge_gap",
          p_metadata: { source: "dimpho_intelligence_worker", confidence: lesson.confidence },
        }).catch(() => null);
      }

      await service!.from("dimpho_conversation_events").update({ status: "processed", processed_at: new Date().toISOString(), error_message: null }).in("id", ids);
      threads++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = Math.max(...group.map((e) => Number(e.attempts || 0))) + 1;
      await service!.from("dimpho_conversation_events").update({ status: attempts >= 3 ? "failed" : "queued", available_at: new Date(Date.now() + 10 * 60_000).toISOString(), error_message: message }).in("id", ids);
      failed++;
    }
  }
  return { threads, candidates, promoted, failed };
}

const githubHeaders = () => ({
  Accept: "application/vnd.github+json",
  "User-Agent": "ResKonnect-Dimpho-Intelligence",
  ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
});

async function githubJson(url: string) {
  const response = await fetch(url, { headers: githubHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `GitHub HTTP ${response.status}`);
  return data;
}

function routeAccess(path: string) {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/partner")) return "partner";
  if (path.startsWith("/recruiter")) return "recruiter";
  if (path.startsWith("/residence")) return "residence";
  if (["/dashboard","/profile","/applications","/my-wil","/referrals"].some((x) => path.startsWith(x))) return "authenticated";
  return "public";
}

function featureFor(path: string) {
  if (/^\/(find|findmyres|find-my-res)/.test(path)) return "find-my-res";
  if (path.startsWith("/applications")) return "applications";
  if (path.startsWith("/profile")) return "profile";
  if (path.startsWith("/opportunities") || path.includes("wil") || path.includes("bursar")) return "opportunities";
  if (path.includes("career") || path.includes("tumelo")) return "career-education";
  if (path.startsWith("/admin")) return "adminos";
  if (path.startsWith("/recruit")) return "recruitment";
  if (path.startsWith("/product") || path.startsWith("/marketplace")) return "marketplace";
  return path.split("/").filter(Boolean)[0] || "home";
}

function componentForRoute(snippet: string) {
  const match = snippet.match(/element\s*=\s*\{\s*<([A-Za-z0-9_]+)/);
  return match?.[1] || null;
}

async function appSync(source = "scheduled", forcedCommit?: string) {
  const settings = await getSettings();
  if (!settings.app_sync_enabled) return { skipped: true, reason: "app_sync_disabled" };
  const { data: recent } = await service!.from("dimpho_app_sync_runs").select("completed_at,commit_sha,status").in("status", ["succeeded", "partial"]).order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (source === "supabase_cron" && recent?.completed_at && Date.now() - new Date(recent.completed_at).getTime() < 55 * 60_000) return { skipped: true, reason: "fresh_sync", commit: recent.commit_sha };

  const runInsert = await service!.from("dimpho_app_sync_runs").insert({ repository: REPO, commit_sha: forcedCommit || null, source, status: "running" }).select("id").single();
  const runId = runInsert.data?.id;
  try {
    const commitData = forcedCommit ? { sha: forcedCommit } : await githubJson(`https://api.github.com/repos/${REPO}/commits/main`);
    const commit = String(commitData.sha || forcedCommit || "");
    const treeData = await githubJson(`https://api.github.com/repos/${REPO}/git/trees/${commit}?recursive=1`);
    const tree = Array.isArray(treeData.tree) ? treeData.tree : [];
    const appPath = "src/App.tsx";
    const appResponse = await fetch(`https://raw.githubusercontent.com/${REPO}/${commit}/${appPath}`);
    if (!appResponse.ok) throw new Error(`Could not read ${appPath}`);
    const appSource = await appResponse.text();

    const routeRegex = /<Route\s+path=["']([^"']+)["'][\s\S]{0,450}?(?:\/>|<\/Route>)/g;
    const routes: any[] = [];
    let match: RegExpExecArray | null;
    while ((match = routeRegex.exec(appSource))) {
      const path = match[1];
      if (!path.startsWith("/")) continue;
      const component = componentForRoute(match[0]);
      const feature = featureFor(path);
      routes.push({
        route_path: path,
        feature_key: feature,
        page_component: component,
        access_level: routeAccess(path),
        purpose: `Production ResKonnect route for ${component || feature}.`,
        canonical_url: `${PUBLIC_BASE}${path.includes(":") ? path.replace(/:[^/]+/g, "{id}") : path}`,
        source_file: appPath,
        last_seen_commit: commit,
        metadata: { synced_from: "github", dynamic: path.includes(":"), commit },
        updated_at: new Date().toISOString(),
      });
    }
    if (routes.length) await service!.from("dimpho_app_routes").upsert(routes, { onConflict: "route_path" });

    const featureKeys = [...new Set(routes.map((r) => r.feature_key))];
    const featureRows = featureKeys.filter((k) => !["find-my-res","applications","profile","opportunities","career-education"].includes(k)).map((key) => ({
      feature_key: key,
      name: key === "adminos" ? "AdminOS" : key.split("-").map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(" "),
      description: `ResKonnect production feature inferred from current application routes under ${key}.`,
      source: "github_sync",
      last_seen_commit: commit,
      metadata: { route_count: routes.filter((r) => r.feature_key === key).length },
      updated_at: new Date().toISOString(),
    }));
    if (featureRows.length) await service!.from("dimpho_app_features").upsert(featureRows, { onConflict: "feature_key" });
    await service!.from("dimpho_app_features").update({ last_seen_commit: commit, updated_at: new Date().toISOString() }).in("feature_key", featureKeys);

    const interesting = tree.filter((x: any) => x.type === "blob" && (
      x.path === "src/App.tsx" || x.path === "supabase/config.toml" || x.path === "vercel.json" ||
      x.path.startsWith("supabase/functions/") && x.path.endsWith("/index.ts") ||
      x.path.startsWith("src/pages/") && x.path.endsWith(".tsx") ||
      x.path.startsWith("src/components/admin/") && x.path.endsWith(".tsx")
    )).slice(0, 450);
    const artifacts = interesting.map((x: any) => ({
      artifact_key: x.path,
      artifact_type: x.path === "src/App.tsx" ? "route_file" : x.path.startsWith("supabase/functions/") ? "edge_function" : x.path.startsWith("src/pages/") ? "page" : x.path.endsWith("config.toml") || x.path.endsWith("vercel.json") ? "config" : "component",
      path: x.path,
      sha: x.sha,
      summary: x.path.startsWith("supabase/functions/") ? `Supabase Edge Function ${x.path.split("/")[2]}` : `Production code artifact ${x.path}`,
      last_seen_commit: commit,
      metadata: { size: x.size || null },
      updated_at: new Date().toISOString(),
    }));
    if (artifacts.length) await service!.from("dimpho_code_artifacts").upsert(artifacts, { onConflict: "artifact_key" });

    for (const route of routes.slice(0, 180)) {
      const sourceRef = `route:${route.route_path}`;
      const content = `Route: ${route.route_path}\nCanonical URL: ${route.canonical_url}\nAccess: ${route.access_level}\nFeature: ${route.feature_key}\nPage component: ${route.page_component || "unknown"}\nPurpose: ${route.purpose}\nThis route was observed in the production application code at commit ${commit}.`;
      await service!.from("dimpho_knowledge_documents").upsert({ title: `App route ${route.route_path}`, source_type: "app_route", source_ref: sourceRef, source_url: route.canonical_url, content, status: "published", sensitivity: route.access_level === "public" ? "public" : "internal", confidence: 0.99, metadata: { route_path: route.route_path, feature_key: route.feature_key, commit } }, { onConflict: "source_type,source_ref" });
    }
    const { data: features } = await service!.from("dimpho_app_features").select("feature_key,name,description,audience,capabilities,requirements,common_issues,related_feature_keys,status").in("feature_key", featureKeys);
    for (const feature of features || []) {
      const content = `Feature: ${feature.name}\nKey: ${feature.feature_key}\nStatus: ${feature.status}\nDescription: ${feature.description}\nAudience: ${(feature.audience || []).join(", ")}\nCapabilities: ${(feature.capabilities || []).join(", ")}\nRequirements: ${(feature.requirements || []).join(", ")}\nCommon issues: ${(feature.common_issues || []).join(", ")}\nRelated features: ${(feature.related_feature_keys || []).join(", ")}.`;
      await service!.from("dimpho_knowledge_documents").upsert({ title: `App feature ${feature.name}`, source_type: "app_feature", source_ref: `feature:${feature.feature_key}`, content, status: "published", sensitivity: "internal", confidence: 0.98, metadata: { feature_key: feature.feature_key, commit } }, { onConflict: "source_type,source_ref" });
    }

    if (runId) await service!.from("dimpho_app_sync_runs").update({ commit_sha: commit, status: "succeeded", routes_found: routes.length, features_found: featureKeys.length, workflows_found: 0, artifacts_found: artifacts.length, completed_at: new Date().toISOString(), metadata: { tree_truncated: Boolean(treeData.truncated) } }).eq("id", runId);
    return { skipped: false, commit, routes: routes.length, features: featureKeys.length, artifacts: artifacts.length, run_id: runId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) await service!.from("dimpho_app_sync_runs").update({ status: "failed", error_message: message, completed_at: new Date().toISOString() }).eq("id", runId);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!service) return json({ error: "Supabase service runtime is not configured" }, 500);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "cycle");
  if (!["cycle", "knowledge", "learning", "app_sync", "health"].includes(action)) return json({ error: "Unsupported task" }, 400);
  if (action === "health") {
    const { data } = await service.rpc("dimpho_intelligence_overview");
    return json({ ok: true, worker: "dimpho-intelligence-worker", release: 4, overview: data });
  }
  try {
    const settings = await getSettings();
    const result: any = { ok: true, action, release: 4, started_at: new Date().toISOString() };
    if (action === "cycle" || action === "knowledge") result.knowledge = await processKnowledgeJobs(settings);
    if (action === "cycle" || action === "learning") result.learning = await processLearning(settings);
    if (action === "cycle" || action === "app_sync") result.app_sync = await appSync(String(body.source || "manual"), body.commit ? String(body.commit) : undefined);
    result.completed_at = new Date().toISOString();
    return json(result);
  } catch (error) {
    return json({ ok: false, action, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
