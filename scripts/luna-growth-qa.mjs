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
const rg12=read("supabase/migrations/20260912194000_agentos_rg12_seo_aeo_growth.sql");
const rg13=read("supabase/migrations/20260912201000_agentos_rg13_finance_admin.sql");
const rg14=read("supabase/migrations/20260912204000_agentos_rg14_reliability.sql");
const rg15=read("supabase/migrations/20260912211000_agentos_rg15_executive_operating_layer.sql");
const indexNowWorker=read("supabase/functions/seo-indexnow-worker/index.ts");
const searchConsoleWorker=read("supabase/functions/seo-search-console-sync/index.ts");
const rg12Ui=read("src/components/admin/AdminSeoAeoAutomation.tsx");
const rg13Ui=read("src/components/admin/AdminFinanceAutomation.tsx");
const rg14Ui=read("src/components/admin/AdminReliabilityAutomation.tsx");
const rg15Ui=read("src/components/admin/AdminExecutiveOperatingLayer.tsx");
const intelligenceOffice=read("src/pages/admin/AdminIntelligenceAnalytics.tsx");
const financeOffice=read("src/pages/admin/AdminFinanceAdmin.tsx");
const technologyOffice=read("src/pages/admin/AdminTechnologySystems.tsx");
const executiveOffice=read("src/pages/admin/AdminExecutiveOffice.tsx");

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

expect(rg12.includes("adminos_search_console_query_metrics")&&rg12.includes("adminos_seo_growth_signals")&&rg12.includes("adminos_seo_growth_snapshots"),"RG12 must retain Search Console evidence, growth signals and snapshots");
expect(rg12.includes("adminos_rg12_safe_metadata_hygiene")&&rg12.includes("'auto_rewrite_public_claims',false")&&rg12.includes("'auto_publish_content',false"),"RG12 may automate mechanical metadata but not public factual claims/content");
expect(rg12.includes("'adminos-rg12-indexnow-worker'")&&rg12.includes("'*/5 * * * *'")&&rg12.includes("'adminos-rg12-search-console-sync'"),"RG12 IndexNow and Search Console workers must remain scheduled");
expect(indexNowWorker.includes("https://api.indexnow.org/indexnow")&&indexNowWorker.includes('HOST="www.reskonnect.org"'),"RG12 must submit canonical ResKonnect URLs through IndexNow");
expect(searchConsoleWorker.includes("webmasters.readonly")&&searchConsoleWorker.includes("searchAnalytics/query"),"RG12 Search Console sync must remain read-only and use Search Analytics");
expect(config.includes("[functions.seo-indexnow-worker]")&&config.includes("[functions.seo-search-console-sync]"),"RG12 search workers must be source-controlled in Supabase config");
expect(rg12Ui.includes("Mechanical indexing autonomous")&&rg12Ui.includes("does not invent market-superlative claims"),"RG12 UI must expose safe search-growth authority");
expect(intelligenceOffice.includes("AdminSeoAeoAutomation")&&intelligenceOffice.includes('value="search-growth"'),"Intelligence office must expose RG12");

expect(rg13.includes("adminos_finance_snapshots")&&rg13.includes("adminos_finance_anomalies"),"RG13 must retain finance snapshots and anomaly controls");
expect(rg13.includes("adminos_rg13_payout_status_guard")&&rg13.includes("Executive approval is required before payout status can advance"),"RG13 payout progression must be Executive-gated");
expect(rg13.includes("'bank_transfers',false")&&rg13.includes("'payout_execution',false")&&rg13.includes("'refund_execution',false")&&rg13.includes("'banking_changes',false"),"RG13 must prohibit autonomous money movement and banking changes");
expect(rg13.includes("'adminos-rg13-finance-admin'")&&rg13.includes("'*/30 * * * *'"),"RG13 finance controls must remain scheduled every 30 minutes");
expect(rg13Ui.includes("No autonomous money movement")&&rg13Ui.includes("never executes a bank transfer"),"RG13 UI must make money-movement controls explicit");
expect(financeOffice.includes("AdminFinanceAutomation")&&financeOffice.includes('value="automation"'),"Finance office must expose RG13");

expect(rg14.includes("adminos_reliability_incidents")&&rg14.includes("adminos_reliability_snapshots")&&rg14.includes("adminos_reliability_expectations"),"RG14 must keep reliability incidents, snapshots and expectations");
expect(rg14.includes("'production_patch',false")&&rg14.includes("'production_deploy',false")&&rg14.includes("'delete_production_data',false")&&rg14.includes("'credential_rotation',false"),"RG14 must keep production remediation release-gated");
expect(rg14.includes("'adminos-rg14-reliability'")&&rg14.includes("'*/10 * * * *'"),"RG14 reliability cycle must remain scheduled every 10 minutes");
expect(rg14Ui.includes("Release-gated remediation")&&rg14Ui.includes("production patches, deployments, credential rotation"),"RG14 UI must disclose diagnostic vs deployment authority");
expect(technologyOffice.includes("AdminReliabilityAutomation")&&technologyOffice.includes('value="reliability"'),"Technology office must expose RG14");

expect(rg15.includes("adminos_executive_authority_policy")&&rg15.includes("adminos_executive_priorities")&&rg15.includes("adminos_company_operating_snapshots"),"RG15 must retain explicit authority policy, priorities and company operating snapshots");
expect(rg15.includes("'persona','Luna'")||rg15.includes("'Luna',priorities_value"),"RG15 executive brief must use Luna rather than Dimpho");
expect(rg15.includes("'contract_signature'")&&rg15.includes("'banking_change'")&&rg15.includes("'ownership_or_shareholding'")&&rg15.includes("'public_crisis_statement'"),"RG15 must explicitly constitutionally restrict material founder actions");
expect(rg15.includes("'adminos-rg15-executive-operating-cycle'")&&rg15.includes("'*/15 * * * *'"),"RG15 executive operating cycle must remain scheduled every 15 minutes");
expect(rg15Ui.includes("Exception-based founder control")&&rg15Ui.includes("contracts, banking, ownership/legal admissions"),"RG15 UI must preserve founder exception authority");
expect(executiveOffice.includes("AdminExecutiveOperatingLayer")&&executiveOffice.includes('value="agentos"'),"Executive Office must expose RG15 AgentOS");
expect(rg15Ui.includes("adminos_rg13_decide_payout_approval")&&rg15Ui.includes("adminos_decide_approval"),"RG15 Executive Office must support approval decisions including guarded seller payouts");

console.log("Luna/AgentOS QA passed: RG0-RG15 full operating architecture and governance invariants are protected.");
