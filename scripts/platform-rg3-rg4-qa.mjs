import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const checks=[];
const expect=(condition,message)=>{checks.push({condition:Boolean(condition),message});if(!condition){console.error("FAIL:",message);process.exitCode=1;}else console.log("PASS:",message);};

const app=read("src/App.tsx");
const opportunities=read("src/pages/public/Opportunities.tsx");
const engine=read("src/components/opportunities/OpportunityEngine.tsx");
const service=read("src/pages/ServiceCentre.tsx");
const my=read("src/components/MyResKonnectCommandCentre.tsx");
const studentOffice=read("src/pages/admin/AdminStudentOpportunities.tsx");
const opsOffice=read("src/pages/admin/AdminOperationsOffice.tsx");
const migration=read("supabase/migrations/20260913192000_rg3_rg4_opportunity_service_engine.sql");
const seo=read("src/lib/seo/seoConfig.ts");
const wil=read("src/pages/public/OpportunitiesWil.tsx");

expect(app.includes('path="/opportunity/:slug"'),"RG3 public opportunity detail route is registered");
expect(app.includes('path="/dashboard/services"'),"RG4 protected Service Centre route is registered");
expect(opportunities.includes("OpportunityEngine"),"Opportunity pillar renders the live RG3 engine");
expect(engine.includes('rpc("reskonnect_opportunity_feed"'),"RG3 feed uses server-side verified opportunity RPC");
expect(engine.includes('rpc("set_student_opportunity_action"'),"RG3 saves user opportunity state through controlled RPC");
expect(service.includes('rpc("create_my_reskonnect_request"'),"RG4 request creation uses controlled RPC");
expect(service.includes('rpc("my_reskonnect_service_centre"'),"RG4 Service Centre reads scoped server state");
expect(my.includes("service_centre")&&my.includes("opportunity_engine"),"My ResKonnect consumes RG3 and RG4 summaries");
expect(studentOffice.includes("AdminOpportunityRegistry")&&studentOffice.includes("AdminServiceRequestQueue"),"Student Opportunities AdminOS owns registry and service queue");
expect(opsOffice.includes("AdminServiceRequestQueue"),"Operations Office can execute cross-company service requests");
expect(migration.includes("create or replace function public.reskonnect_opportunity_feed"),"RG3 verified opportunity feed exists in migration");
expect(migration.includes("create or replace function public.create_my_reskonnect_request"),"RG4 tracked request creation exists in migration");
expect(migration.includes("drop policy if exists \"Users can update own requests\""),"RG4 removes direct customer update policy");
expect(migration.includes("revoke insert,delete on public.student_requests from authenticated"),"RG4 blocks direct customer request insertion/deletion");
expect(migration.includes("rg4_student_request_after_update"),"RG4 status changes create customer-visible service events");
expect(migration.includes("student_opportunity_actions"),"RG3 saved/interested/applied state is persisted");
expect(seo.includes("Student Opportunities, Bursaries & WIL | ResKonnect Opportunity"),"Canonical Opportunity SEO describes live RG3 product");
expect(!wil.includes("verified SETA compliance")&&!wil.includes("We inspect workplaces to ensure COIDA compliance"),"WIL public copy contains no unsupported compliance claims");

if(process.exitCode) process.exit(process.exitCode);
console.log(`RG3/RG4 QA complete: ${checks.length} checks passed.`);
