import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const city = readFileSync("src/components/seo/CityEvidenceSnapshot.tsx","utf8");
const sql = readFileSync("supabase/migrations/20261110040000_city_coverage_evidence.sql","utf8");
const results = readFileSync("src/components/seo/SeoListingResults.tsx","utf8");
const seo = readFileSync("src/pages/seo/SeoLandingPage.tsx","utf8");
const landing = readFileSync("src/lib/seo/landingContent.ts","utf8");
test("city footprint respects RLS and contains no user or street-level details",()=>{
  assert.match(sql,/security_invoker = true/);
  assert.match(sql,/is_visible IS TRUE/);
  assert.match(sql,/GRANT SELECT ON public\.reskonnect_city_coverage_v TO anon, authenticated/);
  assert.doesNotMatch(sql,/email|phone|student_id|user_id|address/i);
  assert.match(city,/reskonnect_city_coverage_v/);
  assert.match(city,/published_residences/);
  assert.match(seo,/CityEvidenceSnapshot/);
});
test("SEO never invents rents, verified vacancies or search errors as zero inventory",()=>{
  assert.match(results,/publicPrivateMonthlyRent/);
  assert.match(results,/Price on request/);
  assert.match(results,/landlord-reported/);
  assert.match(results,/could not be retrieved/i);
  assert.doesNotMatch(landing,/Verified listings only/);
  assert.doesNotMatch(landing,/Every listing shows the room types, monthly price, distance from campus and current availability/);
});
