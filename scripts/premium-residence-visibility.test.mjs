import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(path,"utf8");
const landing=read("src/pages/Landing.tsx");
const find=read("src/pages/FindMyRes.tsx");
const showcase=read("src/components/findmyres/PremiumResidenceShowcase.tsx");
const ranking=read("src/lib/residenceSpotlight.ts");
const hook=read("src/hooks/useLandingSpotlightResidences.ts");
const admin=read("src/pages/admin/AdminResidences.tsx");
const manager=read("src/components/admin/residences/SpotlightPlacementManager.tsx");
const sponsored=read("src/components/findmyres/SponsoredResidenceRail.tsx");
const pricing=read("src/lib/residenceListingEvidence.ts");

test("highest-visibility residence showcase is shared across public entry points",()=>{
 assert.match(landing,/PremiumResidenceShowcase residences=\{spotlightResidences\}/);
 assert.match(find,/PremiumResidenceShowcase residences=\{realResidences\}/);
 assert.ok(landing.indexOf("<PremiumResidenceShowcase")<landing.indexOf('id="discover-reskonnect"'));
 assert.ok(find.indexOf("<PremiumResidenceShowcase")<find.indexOf('id="results"'));
 assert.ok(find.indexOf('id="results"')<find.indexOf("Broader editorial discovery"));
 assert.match(showcase,/LeadResidence residence=\{lead\}/);
 assert.match(showcase,/SupportingResidence residence=\{residence\} index=\{index\}/);
 assert.match(showcase,/key=\{residence\.id\} className="min-w-\[245px\]/);
});

test("editorial prominence is opt-in, photo-backed, visible and stable, not a popularity score",()=>{
 assert.match(ranking,/r\.is_visible!==false&&r\.is_spotlight===true&&hasPropertyPhotoReference\(r\)/);
 assert.match(ranking,/spotlightPriority\(a\)-spotlightPriority\(b\)/);
 assert.match(ranking,/\.slice\(0,limit\)/);
 assert.match(showcase,/rankSpotlightResidences\(residences,5\)/);
 assert.doesNotMatch(showcase,/application_count|view_count|mockResidence/i);
 assert.match(hook,/\.eq\("is_visible",true\)\.eq\("is_spotlight",true\)/);
 assert.match(find,/!hasActiveFilters&&<PremiumResidenceShowcase/);
});

test("reported availability, funding and pricing are not invented",()=>{
 assert.match(ranking,/publicPrivateMonthlyRent\(residence\)/);
 assert.match(ranking,/hasVerifiedPrivateRent\(residence\)/);
 assert.match(ranking,/Landlord-reported private rent/);
 assert.match(ranking,/No confirmed monthly rent supplied/);
 assert.match(showcase,/reported spaces/);
 assert.match(showcase,/residence\.accepts_nsfas===true/);
 assert.match(showcase,/residence\.is_tut_accredited===true/);
 assert.match(showcase,/Spotlight is a ResKonnect editorial placement/);
 assert.match(pricing,/hasVerifiedPrivateRent/);
 assert.doesNotMatch(showcase,/guaranteed vacancy|100% verified/);
});

test("paid placements remain in a separately disclosed section",()=>{
 assert.match(find,/SponsoredResidenceRail residences=\{realResidences\}/);
 assert.match(sponsored,/disclosure_label==="Sponsored"/);
 assert.match(sponsored,/Sponsorship is not an accreditation/);
 assert.match(find,/\.filter\(\(r:any\)=>r\.is_visible!==false&&\(r\.is_featured===true\|\|r\.featured===true\)\&\&r\.is_spotlight!==true\)/);
});

test("admin can select and reorder editorial hero placements without new public mutation rights",()=>{
 assert.match(admin,/SpotlightPlacementManager residences=\{residences\}/);
 assert.match(admin,/toggleSpotlight/);
 assert.match(admin,/spotlight_rank: null/);
 assert.match(manager,/\.update\(\{spotlight_rank:i\+1\}\)\.eq\("id",next\[i\]\.id\)/);
 assert.match(manager,/Priority #1 gets the large hero card/);
 assert.match(manager,/Paid sponsorships are managed separately/);
 assert.doesNotMatch(manager,/service.role|SUPABASE_SERVICE_ROLE_KEY|getPublicUrl\(/i);
});

test("featured placement always routes to a real residence detail page",()=>{
 assert.match(showcase,/\/find-my-res\/\$\{encodeURIComponent\(slug\)\}/);
 assert.match(manager,/\/find-my-res\/\$\{encodeURIComponent\(r\.slug\|\|r\.id\)\}/);
 assert.match(showcase,/Browse every residence/);
 assert.match(find,/Discover student living the ResKonnect way/);
});
