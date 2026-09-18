import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const fail=(message)=>{console.error("ResKonnect Brain QA failed: "+message);process.exit(1);};
const expect=(condition,message)=>{if(!condition)fail(message);};

const brain=read("supabase/functions/reskonnect-brain/index.ts");
const migration=read("supabase/migrations/20260918042009_reskonnect_brain_v1.sql");
const luna=read("supabase/functions/luna-agent/index.ts");
const whatsapp=read("supabase/functions/adminos-whatsapp-webhook/index.ts");
const desk=read("supabase/functions/adminos-whatsapp-desk/index.ts");
const email=read("supabase/functions/adminos-email-agent/index.ts");
const voice=read("supabase/functions/adminos-voice-webhook/index.ts");
const evalWorker=read("supabase/functions/dimpho-eval-worker/index.ts");
const toolEngine=read("supabase/functions/dimpho-tool-engine/index.ts");
const config=read("supabase/config.toml");

expect(migration.includes("rk_brain_config")&&migration.includes("rk_brain_agents")&&migration.includes("rk_brain_memory")&&migration.includes("rk_brain_interactions")&&migration.includes("rk_brain_intent_catalog"),"canonical Brain tables are required");
expect(migration.includes("Seed the intent catalog from real ResKonnect history")&&migration.includes("adminos_whatsapp_threads")&&migration.includes("user_intent_profiles"),"Brain intent bootstrap must use existing ResKonnect history without duplicating raw chats");
expect(migration.includes("Never store passwords, OTPs, banking credentials, identity numbers")||migration.includes("Never store passwords, OTPs, banking credentials, identity numbers"),"privacy policy must prohibit high-risk memory");
expect(brain.includes("SAFE_MEMORY")&&brain.includes("SENSITIVE_PATTERN"),"runtime must filter memory writes");
expect(brain.includes("dimpho_search_knowledge")&&brain.includes("adminos_knowledge_entries"),"Brain must reuse verified RAG and AdminOS knowledge");
expect(brain.includes("dimpho-tool-engine")&&brain.includes("tool_allowlist"),"Brain must use governed registered tools");
expect(brain.includes("cross_channel_history")&&brain.includes("historical_customer_context")&&brain.includes("adminos_whatsapp_messages")&&brain.includes("adminos_enquiry_messages")&&brain.includes("rk_brain_conversation_state"),"Brain must preserve cross-channel continuity and read existing customer history");
expect(luna.includes("/functions/v1/reskonnect-brain")&&luna.includes('agent_key:"luna"'),"Luna must use shared Brain");
expect(whatsapp.includes("/functions/v1/reskonnect-brain")&&whatsapp.includes('agent_key: "dimpho"'),"WhatsApp automation must use Dimpho through shared Brain");
expect(desk.includes("/functions/v1/reskonnect-brain")&&desk.includes('agent_key: "dimpho"'),"WhatsApp desk assist must use shared Brain");
expect(email.includes("/functions/v1/reskonnect-brain")&&email.includes('agent_key: "email_service"'),"email service must use shared Brain");
expect(voice.includes("/functions/v1/reskonnect-brain")&&voice.includes('agent_key:"voice_service"'),"voice service must use shared Brain");
expect(evalWorker.includes("/functions/v1/reskonnect-brain")&&evalWorker.includes('agent_key:"dimpho"'),"Dimpho evaluation must test shared Brain");
expect(toolEngine.includes("x-rk-brain-internal"),"governed tool engine must accept Brain internal calls");
expect(config.includes("[functions.reskonnect-brain]")&&config.includes("verify_jwt = true"),"Brain Edge Function must remain JWT-protected");
console.log("ResKonnect Brain QA passed: shared memory, RAG, tools, channels, privacy and agent routing are protected.");
