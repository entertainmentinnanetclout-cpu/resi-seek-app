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
const rg9=read("supabase/migrations/20260912172000_agentos_rg9_student_opportunities.sql");
const rg10=read("supabase/migrations/20260912174500_agentos_rg10_partnerships.sql");
const rg11=read("supabase/migrations/20260912181500_agentos_rg11_corporate_affairs.sql");
const rg11Announcement=read("supabase/migrations/20260912182500_rg11_announcement_state_hardening.sql");
const rgTaskReconciliation=read("supabase/migrations/20260912183500_rg9_rg11_task_reconciliation.sql");
const rg9Ui=read("src/components/admin/AdminStudentOpportunityAutomation.tsx");
const rg10Ui=read("src/components/admin/AdminPartnershipAutomation.tsx");
const rg11Ui=read("src/components/admin/AdminCorporateAffairsAutomation.tsx");
const studentOffice=read("src/pages/admin/AdminStudentOpportunities.tsx");
const partnershipsOffice=read("src/pages/admin/AdminPartnershipCommandCentre.tsx");
const corporateOffice=read("src/pages/admin/AdminCorporateAffairs.tsx");
const announcementsUi=read("src/components/admin/AdminSiteAnnouncementsManager.tsx");

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

expect(rg9.includes("adminos_student_opportunity_cases")&&rg9.includes("adminos_opportunity_catalog_health")&&rg9.includes("adminos_student_opportunity_matches"),"RG9 must keep unified student cases, catalog health and potential matches");
expect(rg9.includes("requires_official_confirmation")&&rg9.includes("'eligibility_claims',false"),"RG9 must never turn a potential match into an eligibility claim");
expect(rg9.includes("'placement_decisions','human_only'")&&rg9.includes("'funding_approvals','human_only'")&&rg9.includes("'institution_submission','human_only'"),"RG9 protected student outcomes must remain human-only");
expect(rg9.includes("set is_active=false")&&rg9.includes("set is_published=false"),"RG9 must automatically suppress expired bursaries and opportunities");
expect(rg9.includes("'adminos-rg9-student-opportunities'")&&rg9.includes("'*/20 * * * *'"),"RG9 automation must remain scheduled every 20 minutes");
expect(rg9Ui.includes("potential fit")||rg9Ui.includes("Potential opportunity matches"),"RG9 UI must explain potential-match semantics");
expect(studentOffice.includes('value="automation"')&&studentOffice.includes("AdminStudentOpportunityAutomation"),"Student Services must expose RG9 automation");

expect(rg10.includes("adminos_partnership_lead_intelligence")&&rg10.includes("adminos_partnership_relationship_health")&&rg10.includes("adminos_partnership_followup_drafts"),"RG10 must keep lead intelligence, relationship health and follow-up drafts");
expect(rg10.includes("'auto_send_external_messages',false")&&rg10.includes("'contracts','human_only'")&&rg10.includes("'commercial_terms','human_only'"),"RG10 must not autonomously send or bind commercial terms");
expect(rg10.includes("adminos_approve_partnership_draft")&&rg10.includes("Executive approval required"),"RG10 external drafts must require Executive approval");
expect(rg10.includes("'adminos-rg10-partnerships'")&&rg10.includes("'*/30 * * * *'"),"RG10 automation must remain scheduled every 30 minutes");
expect(rg10Ui.includes("No autonomous external send")&&rg10Ui.includes("Executive approve"),"RG10 UI must surface manual-send and Executive approval controls");
expect(partnershipsOffice.includes("AdminPartnershipAutomation"),"Partnerships office must expose RG10 automation");

expect(rg11.includes("adminos_reputation_signals")&&rg11.includes("adminos_corporate_affairs_briefs")&&rg11.includes("adminos_corporate_affairs_drafts"),"RG11 must keep reputation signals, briefs and approval-gated drafts");
expect(rg11.includes("'social_sentiment_inference',false")&&rg11.includes("'manual_publish_required',true")&&rg11.includes("'auto_publish',false"),"RG11 must not infer social sentiment or auto-publish");
expect(rg11.includes("adminos_rg11_site_announcement_guard")&&rg11.includes("requires_executive_approval"),"RG11 must govern public site announcements");
expect(rg11Announcement.includes("approval_status='pending'")&&rg11Announcement.includes("is_active=false"),"Sensitive announcements must be pending and inactive until approval");
expect(rg11.includes("'adminos-rg11-reputation'")&&rg11.includes("'*/15 * * * *'"),"RG11 reputation cycle must remain scheduled every 15 minutes");
expect(rg11Ui.includes("Manual publishing only")&&rg11Ui.includes("Executive approve"),"RG11 UI must keep public communications manual and approval-gated");
expect(corporateOffice.includes('value="reputation"')&&corporateOffice.includes("AdminCorporateAffairsAutomation"),"Corporate Affairs must expose RG11 reputation automation");
expect(announcementsUi.includes("adminos_approve_site_announcement")&&announcementsUi.includes("Executive approval is required"),"Site-announcement UI must enforce Executive approval for sensitive content");
expect(rgTaskReconciliation.includes("automation_key")&&rgTaskReconciliation.includes("adminos_rg9_reconcile_tasks")&&rgTaskReconciliation.includes("adminos_rg10_reconcile_tasks")&&rgTaskReconciliation.includes("adminos_rg11_reconcile_tasks"),"RG9-RG11 task queues must remain state-keyed and idempotent");

console.log("Luna/AgentOS QA passed: RG0-RG11 identity, demand, conversion, application, occupancy, student-opportunity, partnership and Corporate Affairs governance are protected.");
