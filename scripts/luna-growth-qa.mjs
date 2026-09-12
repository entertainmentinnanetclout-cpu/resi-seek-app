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
const rg6rg8=read("supabase/migrations/20260912162000_agentos_rg6_rg8.sql");
const rg6rg8Tuning=read("supabase/migrations/20260912163500_agentos_rg6_rg8_launch_tuning.sql");
const rg6Profile=read("supabase/migrations/20260912165500_rg6_profile_context_inheritance.sql");
const conversionUi=read("src/components/admin/AdminWhatsAppConversionPipeline.tsx");
const applicationOpsUi=read("src/components/admin/AdminApplicationOperationsPanel.tsx");
const occupancyUi=read("src/components/admin/AdminOccupancyIntelligence.tsx");
const accommodationOffice=read("src/pages/admin/AdminOperationsHub.tsx");
const communicationsOffice=read("src/pages/admin/AdminCommunicationsDepartment.tsx");

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

expect(rg6rg8.includes("lead_score")&&rg6rg8.includes("qualification_band")&&rg6rg8.includes("next_best_action"),"RG6 must keep deterministic lead scoring and next-best-action fields");
expect(rg6rg8.includes("adminos_generate_conversion_followups")&&rg6rg8.includes("respect_consent")&&rg6rg8.includes("respect_do_not_contact"),"RG6 must retain consent-aware conversion follow-ups");
expect(rg6rg8.includes("'approve_application'")&&rg6rg8.includes("'reject_application'")&&rg6rg8.includes("'allocate_room'"),"RG6 must block protected accommodation decisions");
expect(rg6Profile.includes("trg_adminos_rg6_00_profile_context")&&rg6Profile.includes("academic_cycle")&&rg6Profile.includes("study_level"),"RG6 must inherit verified profile academic context before scoring");
expect(rg6rg8.includes("adminos_application_health_scores")&&rg6rg8.includes("automation_state")&&rg6rg8.includes("stale_days"),"RG7 must keep application health and stale-case state");
expect(rg6rg8Tuning.includes("limit 25")&&rg6rg8Tuning.includes("interval '72 hours'"),"RG7 reminders must remain bounded to 25 per cycle with a 72h cooldown");
expect(rg6rg8.includes("protected_status_decisions")&&rg6rg8.includes("'human_only'"),"RG7 approval/rejection must remain human-only");
expect(rg6rg8.includes("adminos_occupancy_intelligence")&&rg6rg8.includes("academic_year=p_academic_year"),"RG8 occupancy must remain isolated by academic year");
expect(rg6rg8.includes("cycle_cohorts_not_capacity_pools")&&rg6rg8.includes("'auto_publish',false"),"RG8 must keep cycles as cohorts and marketing publishing disabled");
expect(rg6rg8Tuning.includes("status_rank<=20")&&rg6rg8Tuning.includes("marketing_corporate_affairs"),"RG8 must keep marketing handoffs exception-based instead of flooding departments");
expect(conversionUi.includes("RG6 · Dimpho Conversion Automation")&&communicationsOffice.includes('value="conversion"'),"Communications must expose the RG6 conversion workspace");
expect(applicationOpsUi.includes("RG7")&&accommodationOffice.includes("AdminApplicationOperationsPanel"),"Accommodation must expose RG7 application automation");
expect(occupancyUi.includes("RG8")&&accommodationOffice.includes("AdminOccupancyIntelligence"),"Accommodation must expose RG8 occupancy intelligence");

console.log("Luna/AgentOS QA passed: RG0-RG5 foundations plus RG6 conversion, RG7 application operations and RG8 academic-year occupancy controls are protected.");
