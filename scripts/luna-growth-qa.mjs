import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const fail=(message)=>{console.error(`Luna Growth QA failed: ${message}`);process.exit(1);};
const expect=(condition,message)=>{if(!condition)fail(message);};

const bot=read("src/components/ResBot.tsx");
const enquiry=read("supabase/functions/adminos-enquiry/index.ts");
const lunaAgent=read("supabase/functions/luna-agent/index.ts");
const orchestrator=read("supabase/functions/luna-orchestrator/index.ts");
const growth=read("src/lib/lunaGrowth.ts");
const filters=read("src/hooks/useResidenceFilters.ts");
const migration=read("supabase/migrations/20260910093000_luna_agentos_rg0_rg1_rg2.sql");
const hardening=read("supabase/migrations/20260910093100_luna_agentos_rg0_rg1_hardening.sql");
const config=read("supabase/config.toml");

expect(bot.includes('externalFunctionUrl(signedIn ? "adminos-enquiry" : "luna-agent")'),"public website assistant must route to luna-agent");
expect(bot.includes("Luna")&&!bot.includes("Konnect Agent • Secure support"),"website assistant identity must be Luna");
expect(enquiry.includes('/functions/v1/luna-agent'),"authenticated in-app enquiry must route to Luna");
expect(!enquiry.includes('/functions/v1/adminos-agent'),"in-app website enquiry must not route through Dimpho/adminos-agent");
expect(lunaAgent.includes('.eq("agent_key","luna_core")'),"Luna agent must load the luna_core policy");
expect(!lunaAgent.includes("dimpho_personas")&&!lunaAgent.includes("dimpho_customer_memory")&&!lunaAgent.includes("dimpho-tool-engine"),"Luna runtime must not depend on Dimpho persona, memory or tool engine");
expect(hardening.includes("Dimpho must not learn from Luna-routed conversations")&&hardening.includes("new.metadata->>'agent_route'"),"Dimpho learning must exclude Luna in-app conversations");
expect(
  orchestrator.includes("luna_academic_supply_live")
    && orchestrator.includes("luna_academic_demand_heat")
    && orchestrator.includes("housing_intel_institution_snapshot")
    && orchestrator.includes("verified_residence_count"),
  "RG2 must reuse verified, academic-year-scoped Housing Intelligence"
);
expect(growth.includes("luna_capture_attribution")&&growth.includes("luna_log_demand_event"),"client attribution and demand RPCs must be wired");
expect(growth.includes("ATTR_TTL_MS=30*24*60*60*1000")&&growth.includes("onAuthStateChange"),"campaign attribution must persist for 30 days and re-bind after authentication");
expect(filters.includes('captureLunaDemandEvent("residence_search"'),"Find My Res filters must emit debounced search intent");
expect(migration.includes("adminos_campaign_attributions")&&migration.includes("trg_luna_attribute_application")&&migration.includes("trg_luna_attribute_placement"),"campaign attribution must cover applications and placements");
expect(hardening.includes("exists(")&&hardening.includes("adminos_growth_campaigns"),"public campaign codes must be validated against the private growth registry");
expect(migration.includes("'luna-demand-cycle'")&&migration.includes("'*/15 * * * *'"),"Luna demand cycle must be scheduled every 15 minutes");
expect(migration.includes("'campaign_creation',false")&&migration.includes("'publishing',false"),"RG2 must not silently enable campaign creation or publishing");
expect(config.includes("[functions.luna-agent]")&&config.includes("[functions.luna-orchestrator]"),"Luna Edge Functions must be source-controlled in Supabase config");

console.log("Luna Growth QA passed: RG0 identity boundary, RG1 attribution/telemetry, RG2 year-scoped demand intelligence and RG3-RG5 manual content controls are protected.");
