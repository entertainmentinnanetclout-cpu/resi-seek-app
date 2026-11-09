import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read=(p)=>readFileSync(p,"utf8");
const routes=JSON.parse(read("vercel.json")).rewrites;
const discoveries=JSON.parse(read("src/data/seo/discoveryPages.json"));
const app=read("src/App.tsx"),sitemap=read("api/sitemap.js");
const landing=read("src/pages/Landing.tsx");
const filters=read("src/pages/FindMyRes.tsx");
const cards=read("src/components/seo/SeoListingResults.tsx");
const detail=read("src/pages/ResidenceDetail.tsx");
const prerender=read("scripts/prerender-seo.mjs");
const cities=["pretoria","soshanguve","ga-rankuwa","mbombela","polokwane"];
const intents=["single-rooms","nsfas-no-top-up","r1500-to-budget","private-paying","room-types"];

test("10 unique grounded city and housing-intent pages have real routes, rewrites and canonical sitemap URLs",()=>{
 const expected=[...cities,...intents].map(slug=>"/student-accommodation/"+slug);
 assert.equal(discoveries.length,10);
 assert.deepEqual(new Set(discoveries.map(page=>page.path)),new Set(expected));
 for(const path of expected){
   const page=discoveries.find(p=>p.path===path);
   assert.ok(page&&page.intro.length>=2&&page.benefits.length>=4&&page.faqs.length>=3);
   assert.match(page.title,/ResKonnect/);
   assert.ok(app.includes(`pageKey="${path}"`),`missing React route ${path}`);
   assert.equal(routes.find(r=>r.source===path)?.destination,
     "/_seo/"+path.slice(1).replaceAll("/","-"),`missing prerender route ${path}`);
   assert.ok(sitemap.includes(`"${path}"`),`missing sitemap ${path}`);
 }
});

test("No fabricated price, first-place rank, NSFAS accreditation or no-top-up promise",()=>{
 assert.match(landing,/Building Africa's First/);
 assert.match(landing,/Artificial Intelligence \(AI\).*Service Intelligence \(SI\)/);
 assert.ok(prerender.includes("Our vision is to build Africa’s first"));
 const budget=discoveries.find(p=>p.path.endsWith("r1500-to-budget"));
 const noTopUp=discoveries.find(p=>p.path.endsWith("nsfas-no-top-up"));
 assert.match(budget.intro.join(" "),/does not currently promise rooms at R1,500/);
 assert.match(noTopUp.intro.join(" "),/not automatically no-top-up/);
 assert.ok(!noTopUp.listings,"unverified no-top-up inventory must not be advertised");
 assert.match(cards,/\.eq\("is_visible", true\)/);
 assert.match(cards,/\.eq\("city", query.city\)/);
 assert.match(cards,/monthly > 0/);
 assert.match(cards,/query.singlesOnly/);
 assert.match(filters,/searchParams\.get\("minPrice"\)/);
 assert.match(filters,/searchParams\.get\("maxPrice"\)/);
 assert.match(filters,/searchParams\.get\("singlesOnly"\)/);
 assert.match(filters,/searchParams\.get\("nsfasOnly"\)/);
 assert.match(detail,/canonicalPath=\{canonicalPath\}/);
 assert.match(detail,/verifiedMonthlyOffer/);
 assert.match(detail,/noIndex=\{residence.is_visible === false\}/);
});

test("Production build emits non-empty, unique HTML content for every public discovery page",()=>{
 for(const page of discoveries){
   const file="dist/_seo/"+page.path.slice(1).replaceAll("/","-")+".html";
   assert.ok(existsSync(file),`not generated: ${file}`);
   const html=read(file);
   assert.ok(html.length>3800,`thin static HTML: ${page.path}`);
   assert.ok(html.includes(page.h1));
   const snippet=page.intro[0].slice(0,55).replaceAll("&","&amp;").replaceAll("'","&#39;").replaceAll('"',"&quot;");
   assert.ok(html.includes(snippet),`missing unique local prose: ${page.path}`);
   assert.ok(html.includes("https://www.reskonnect.org"+page.path));
   assert.match(html,/BreadcrumbList/);
   assert.match(html,/What you can compare/);
   assert.match(html,/Continue searching/);
   assert.match(html,/rel="canonical"/);
   assert.doesNotMatch(html, /<meta name="robots" content="noindex/i);
 }
 const home=read("dist/_seo/home.html");
 assert.match(home,/Student accommodation by city/);
 assert.match(home,/Soshanguve/);
 assert.match(home,/WIL placements/);
 assert.match(home,/AI\/SI-powered student journey platform/i);
});
