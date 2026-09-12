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
expect(orchestrator.includes("luna_academic_supply_live")&&orchestrator.includes("luna_academic_demand_heat"),"RG2 must use year-isolated academic supply and demand");
expect(!orchestrator.includes('service.rpc("housing_intel_demand_heat"')&&!orchestrator.includes('service.rpc("housing_intel_supply_live"'),"Luna ranking must not reintroduce cross-year legacy supply/demand RPCs");
expect(growth.includes("luna_capture_attribution")&&growth.includes("luna_log_demand_event"),"client attribution and demand RPCs must be wired");
expect(growth.includes("ATTR_TTL_MS=30*24*60*60*1000")&&growth.includes("onAuthStateChange"),"campaign attribution must persist for 30 days and re-bind after authentication");
expect(filters.includes('captureLunaDemandEvent("residence_search"'),"Find My Res filters must emit debounced search intent");
expect(migration.includes("adminos_campaign_attributions")&&migration.includes("trg_luna_attribute_application")&&migration.includes("trg_luna_attribute_placement"),"campaign attribution must cover applications and placements");
expect(hardening.includes("exists(")&&hardening.includes("adminos_growth_campaigns"),"public campaign codes must be validated against the private growth registry");
expect(migration.includes("'luna-demand-cycle'")&&migration.includes("'*/15 * * * *'"),"Luna demand cycle must be scheduled every 15 minutes");
expect(migration.includes("'campaign_creation',false")&&migration.includes("'publishing',false"),"RG2 must not silently enable campaign creation or publishing");
expect(config.includes("[functions.luna-agent]")&&config.includes("[functions.luna-orchestrator]"),"Luna Edge Functions must be source-controlled in Supabase config");


const socialMigration=read("supabase/migrations/20260912131500_luna_rg3_rg5_social_demand_manual_publish.sql");
const growthUi=read("src/components/admin/AdminOSLunaGrowth.tsx");
const supplyQuality=read("supabase/migrations/20260912132000_luna_rg3_supply_quality_hardening.sql");

expect(orchestrator.includes('action==="content_cycle"')&&orchestrator.includes("manual_publish_required:true"),"RG3 must generate content packs without publishing");
expect(orchestrator.includes('provider:"manual"')&&!orchestrator.includes("api/v2/scheduler/posts"),"Luna orchestrator must not contain a Metricool scheduler/publishing path");
expect(orchestrator.includes('service.rpc("luna_academic_supply_live"')&&orchestrator.includes("academicYear"),"Luna demand must use year-isolated academic inventory");
expect(socialMigration.includes("adminos_social_demand_snapshots")&&socialMigration.includes("Metricool · Social Demand Intelligence"),"RG4 Metricool social-demand intelligence must be source-controlled");
expect(socialMigration.includes("'publishing_enabled',false")&&socialMigration.includes("'manual_posting',true"),"Metricool publishing must remain disabled by policy");
expect(socialMigration.includes("manual_publish_required boolean not null default true"),"social posts must default to manual publishing");
expect(socialMigration.includes("luna_mark_social_post_published"),"manual posting feedback must be captured in Supabase");
expect(growthUi.includes("Metricool = Demand Analysis")&&growthUi.includes("Posting = Manual"),"AdminOS must clearly display the Metricool analysis-only boundary");
expect(supplyQuality.includes("verified_available_spots")&&supplyQuality.includes("Pretoria West (Main Campus)"),"public inventory evidence must be verified and campus naming canonical");
expect(orchestrator.includes('inventory_evidence:verifiedInventoryCount>0?"verified":"reported_internal_only"'),"RG3 content must distinguish verified from internal-only reported inventory");
expect(orchestrator.includes("can_claim_exact_availability:verifiedInventoryCount>0"),"RG3 exact availability claims must require verified inventory");

console.log("Luna Growth QA passed: RG0–RG5 boundaries, year-isolated demand, Metricool analysis-only policy and manual publishing are protected.");
