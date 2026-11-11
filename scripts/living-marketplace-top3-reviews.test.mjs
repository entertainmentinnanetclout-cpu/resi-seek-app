import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(path,"utf8");
const sql=read("supabase/migrations/20261111053000_reskonnect_mobile_living_monthly_and_student_reviews.sql");
const landing=read("src/pages/Landing.tsx");
const find=read("src/pages/FindMyRes.tsx");
const monthly=read("src/components/findmyres/MonthlyTopThree.tsx");
const card=read("src/components/findmyres/ResidenceDiscoveryCard.tsx");
const signals=read("src/hooks/usePublicLivingSignals.ts");
const review=read("src/components/ReviewForm.tsx");
const detail=read("src/pages/ResidenceDetail.tsx");
const moderator=read("src/components/admin/residences/AdminResidenceReviewModeration.tsx");
const admin=read("src/pages/admin/AdminResidences.tsx");
const portal=read("src/pages/residence/ResidenceLayout.tsx");
const dashboard=read("src/pages/residence/ResidenceDashboard.tsx");
const profile=read("src/pages/residence/ResidenceListingProfile.tsx");
const spotlight=read("src/components/findmyres/PremiumResidenceShowcase.tsx");
const trusted=read("src/components/landing/TrustedLivingShowcase.tsx");
const finder=read("src/components/findmyres/LivingSearchDock.tsx");
const smart=read("src/components/findmyres/SmartSearchBar.tsx");

test("organic Top 3 uses monthly distinct-account activity and excludes paid placements",()=>{
 assert.match(sql,/reskonnect_public_top3_monthly/);
 assert.match(sql,/date_trunc\('month',now\(\)\)/);
 assert.match(sql,/count\(distinct a.user_id\)/);
 assert.match(sql,/count\(distinct b.user_id\)/);
 assert.match(sql,/coalesce\(a.n,0\)\+2\*coalesce\(b.n,0\)/);
 const leaderboardBody=sql.slice(sql.indexOf("create or replace function public.reskonnect_public_top3_monthly")).split("$;")[0];
 assert.doesNotMatch(leaderboardBody,/sponsor|featured_rank|is_spotlight|view_count/);
 assert.match(sql,/limit 3;/);
 assert.match(landing,/MonthlyTopThree signals=\{livingSignals\} surface="landing"/);
 assert.match(find,/MonthlyTopThree residences=\{realResidences\} signals=\{livingSignals\} surface="find"/);
 assert.match(monthly,/Organic student demand/);
 assert.match(monthly,/two points per unique reservation-interest account plus one per unique applicant account/);
});

test("student ratings are one approved-applicant vote per property with no seed/fake average",()=>{
 assert.match(sql,/unique\(residence_id,user_id\)/);
 assert.match(sql,/a.status='approved'/);
 assert.match(sql,/alter table public.reskonnect_student_residence_reviews enable row level security/);
 assert.match(sql,/count\(distinct r.user_id\)/);
 assert.match(sql,/having count\(distinct r.user_id\)>0/);
 assert.match(sql,/revoke all on public.reskonnect_student_residence_reviews from public,anon,authenticated/);
 assert.match(review,/reskonnect_can_student_rate_residence/);
 assert.match(review,/reskonnect_student_residence_reviews/);
 assert.match(review,/onConflict:"residence_id,user_id"/);
 assert.match(card,/rating&&rating.count>0/);
 assert.match(card,/No student ratings yet/);
 assert.match(detail,/reskonnect_public_residence_review_excerpts/);
 assert.doesNotMatch(detail,/from\("reviews"\)/);
});

test("no self-accreditation or official logo from funding-acceptance switch",()=>{
 assert.match(signals,/get_public_accreditation_residences/);
 assert.match(signals,/row.accreditation_verified===true/);
 assert.match(signals,/row.accreditation_status==="accredited_active"/);
 assert.match(signals,/nsfasAccreditedIds/);
 assert.match(signals,/nsfas\/i\.test/);
 assert.match(card,/nsfasAccredited&&/);
 assert.match(card,/Accepts NSFAS funding/);
 assert.match(profile,/cannot self-assign trust, accreditation or verified-price status/);
});

test("unmoderated review text is withheld from public and only admin controls visibility",()=>{
 assert.match(sql,/comment_public boolean not null default false/);
 assert.match(sql,/if not public.has_role/);
 assert.match(sql,/new.comment_public:=false/);
 assert.match(sql,/case when rv.comment_public then rv.title else 'Student rating' end/);
 assert.match(sql,/case when rv.comment_public then rv.comment else null end/);
 assert.match(admin,/AdminResidenceReviewModeration/);
 assert.match(moderator,/\.update\(\{comment_public:approved\}\)/);
 assert.match(moderator,/Landlords cannot approve or edit student comments/);
});

test("premium mobile search, display modes and landlord pathways retain functional navigation",()=>{
 assert.match(landing,/LivingSearchDock/);
 assert.match(finder,/AI-assisted finder/);
 assert.match(smart,/AI Finder/);
 assert.match(find,/listingStyle==="details"/);
 assert.match(find,/Photo cards/);
 assert.match(find,/Compact list/);
 assert.match(find,/Detailed cards/);
 assert.match(spotlight,/bg-\[linear-gradient\(130deg,#f8fafc/);
 assert.match(portal,/Residence quick navigation/);
 assert.match(portal,/mobileQuickNav/);
 assert.match(dashboard,/Everything connected/);
 assert.match(profile,/Your live property presentation/);
 assert.match(profile,/ResidenceDiscoveryCard/);
 assert.match(trusted,/ResKonnect curated network/);
 assert.match(trusted,/\.eq\("is_trusted",true\)/);
});


test("monthly editorial selection is admin-only, isolated from organic analytics and truthfully labelled",()=>{
 const editorialSql=read("supabase/migrations/20261111061500_monthly_top3_admin_curation.sql");
 const manager=read("src/components/admin/residences/MonthlyTopThreeManager.tsx");
 const card=read("src/components/findmyres/ResidenceDiscoveryCard.tsx");
 assert.match(editorialSql,/reskonnect_monthly_top3_editorial enable row level security/);
 assert.match(editorialSql,/revoke all on public.reskonnect_monthly_top3_editorial from public,anon,authenticated/);
 assert.match(editorialSql,/has_role\(\(select auth.uid\(\)\),'admin'/);
 assert.match(editorialSql,/updated_by=\(select auth.uid\(\)\)/);
 assert.match(editorialSql,/unique \(month_start,residence_id\)/);
 assert.match(editorialSql,/reskonnect_public_monthly_showcase/);
 assert.match(editorialSql,/from public.reskonnect_public_top3_monthly\(\)/);
 assert.match(editorialSql,/'editorial'::text/);
 assert.match(editorialSql,/from generate_series\(1,3\)/);
 assert.match(admin,/MonthlyTopThreeManager residences=\{residences\}/);
 assert.match(manager,/onConflict:"month_start,position"/);
 assert.match(manager,/Automatic · student demand/);
 assert.match(manager,/reset\(\)/);
 assert.match(signals,/reskonnect_public_monthly_showcase/);
 assert.match(monthly,/rankLabel=\{item.rank.selection_type==="editorial"/);
 assert.match(monthly,/Selected by the ResKonnect team/);
 assert.match(card,/rankLabel/);
});
test("monthly showcase and search use ResKonnect navy, blue and gold instead of imported competitor accents",()=>{
 const finder=read("src/components/findmyres/LivingSearchDock.tsx");
 const spotlight=read("src/components/findmyres/PremiumResidenceShowcase.tsx");
 const branded=[finder,spotlight,monthly];
 for(const body of branded){
  assert.doesNotMatch(body,/#e94478|#c62c62|#f6f0ff|#61379a|#e6786a|#d77858|#fff6ef/i);
 }
 assert.match(spotlight,/ResKonnect Living/);
 assert.match(finder,/Search student living with ResKonnect/);
 assert.match(monthly,/ResKonnect Top 3/);
});
