import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const migration=read("supabase/migrations/20261121152000_residence_discovery_curation_tiers.sql");
const policy=read("src/lib/residenceDiscoveryPolicy.ts");
const finder=read("src/pages/FindMyRes.tsx");
const admin=read("src/pages/admin/AdminResidences.tsx");
const spotlight=read("src/lib/residenceSpotlight.ts");
const landing=read("src/hooks/useLandingSpotlightResidences.ts");
const trusted=read("src/components/landing/TrustedLivingShowcase.tsx");
const monthly=read("src/components/findmyres/MonthlyTopThree.tsx");
const sponsored=read("src/components/findmyres/SponsoredResidenceRail.tsx");
const nearby=read("src/components/findmyres/NearbySuggestedResidences.tsx");
const hook=read("src/hooks/useRealtimeResidences.ts");
const detail=read("src/pages/ResidenceDetail.tsx");
const directory=read("src/pages/ResidenceDirectory.tsx");
const app=read("src/App.tsx");
const sitemap=read("api/sitemap.js");
const prerender=read("scripts/prerender-seo.mjs");

test("commercial classification and browse placement never change publication, application or payment state",()=>{
 assert.match(migration,/ADD COLUMN IF NOT EXISTS listing_relationship text NOT NULL DEFAULT 'unclassified'/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS discovery_placement text NOT NULL DEFAULT 'automatic'/);
 assert.match(migration,/listing_relationship IN \('unclassified','free','partner','paying'\)/);
 assert.match(migration,/discovery_placement IN \('automatic','promote','directory_only'\)/);
 assert.doesNotMatch(migration,/UPDATE public\.residences SET is_visible|UPDATE public\.applications|UPDATE public\.accommodation_reservations/i);
 assert.match(migration,/do not backfill|Do not backfill/i);
 assert.match(policy,/residence\.discovery_placement==="directory_only"/);
 assert.match(policy,/residence\.discovery_placement==="promote"/);
 assert.match(policy,/hasMarketableResidencePhoto\(residence\)/);
 assert.match(policy,/listing_relationship\|\|"unclassified"/);
 assert.doesNotMatch(policy,/hasVerifiedPrivateRent\(residence\).*paid|acc?redit.*paying/i);
});

test("all published properties remain name-searchable, direct-link accessible and indexable",()=>{
 assert.match(finder,/const searchingByName=filters\.searchQuery\.trim\(\)\.length>0/);
 assert.match(finder,/const mainResults=searchingByName\?filteredResidences:promotedMatches/);
 assert.match(finder,/const directoryMatches=filteredResidences\.filter\(isDirectoryOnlyResidence\)/);
 assert.match(finder,/directoryResults\.slice\(0,directoryCount\)/);
 assert.match(finder,/Searchable A–Z|Full searchable A–Z residence directory/);
 assert.match(hook,/\.from\('residences'\)\.select\('\*'\)\.eq\('is_visible', true\)/);
 assert.match(detail,/noIndex=\{residence\.is_visible === false\}/);
 assert.match(directory,/\.from\("residences"\)/);
 assert.match(directory,/\.eq\("is_visible",true\)/);
 assert.match(directory,/\/find-my-res\/\$\{encodeURIComponent\(residence\.slug\|\|residence\.id\)\}/);
 assert.match(app,/path="\/directory\/residences"/);
 assert.match(sitemap,/"\/directory\/residences"/);
 assert.match(sitemap,/residences\?select=slug,updated_at&is_visible=eq\.true/);
 assert.match(prerender,/"\/directory\/residences"/);
});

test("broad browse, suggestions and editorial rails all respect directory-only overrides",()=>{
 assert.match(finder,/realResidences = residences\.filter/);
 assert.match(finder,/isPromotedResidence\(r\)/);
 assert.match(finder,/NearbySuggestedResidences residences=\{realResidences\}/);
 assert.match(finder,/MonthlyTopThree residences=\{realResidences\}/);
 assert.match(finder,/SponsoredResidenceRail residences=\{realResidences\}/);
 assert.match(spotlight,/isPromotedResidence\(r\)/);
 assert.match(landing,/discovery_placement,listing_relationship/);
 assert.match(trusted,/data\.filter\(isPromotedResidence\)/);
 assert.match(monthly,/isPromotedResidence\(r\)/);
 assert.match(sponsored,/isPromotedResidence\(r\)/);
 assert.match(nearby,/isPromotedResidence\(r\)/);
});

test("admin can classify and override each listing and bulk-label free directory entries safely",()=>{
 assert.match(admin,/listing_relationship: editingResidence\.listing_relationship/);
 assert.match(admin,/discovery_placement: editingResidence\.discovery_placement/);
 assert.match(admin,/updateDirectoryControl/);
 assert.match(admin,/bulkUpdateListingControls/);
 assert.match(admin,/ids\.slice\(i,i\+50\)/);
 assert.match(admin,/window\.confirm/);
 assert.match(admin,/Mark selected as Free directory/);
 assert.match(admin,/Move selected to search & map/);
 assert.match(admin,/Restore automatic photo-first/);
 assert.match(admin,/\/admin\/studio\?tab=showcases/);
 assert.match(admin,/Paid placement requires separate verified billing/);
 assert.match(admin,/paid|paying/i);
 assert.match(admin,/hasMarketableResidencePhoto\(residence\)/);
});
