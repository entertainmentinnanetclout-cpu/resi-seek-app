import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sitemapHandler from "../api/sitemap.js";

const read=(path)=>readFileSync(path,"utf8");
const vercel=JSON.parse(read("vercel.json"));

test("Physical homepage is crawlable and OAuth-readable, while fallback remains an empty SPA shell",()=>{
 const root=read("dist/index.html");
 const home=read("dist/_seo/home.html");
 const fallback=read("dist/_spa/fallback.html");
 assert.equal(root,home,"Vercel serves physical index before / rewrite");
 assert.match(root,/ResKonnect — Building Africa&#39;s First AI\\/SI-Powered Student Platform/);
 assert.match(root,/Student accommodation by city/);
 assert.match(root,/Soshanguve/);
 assert.match(root,/Why ResKonnect requests Gmail permission/);
 assert.match(root,/rel="canonical" href="https:\\/\\/www.reskonnect.org"/);
 assert.match(fallback,/<div id="root"><\\/div>/);
 assert.doesNotMatch(fallback,/Student accommodation by city/);
 assert.match(read("dist/360-studio.html"),/noindex, nofollow/);
 assert.equal(vercel.rewrites.find(r=>r.source==="/(.*)")?.destination,"/_spa/fallback");
 assert.match(read("dist/_seo/student-accommodation-mbombela.html"),/name="geo.region" content="ZA-MP"/);
 assert.match(read("dist/_seo/student-accommodation-polokwane.html"),/name="geo.region" content="ZA-LP"/);
 assert.match(read("dist/_seo/student-accommodation-soshanguve.html"),/name="geo.region" content="ZA-GT"/);
 assert.doesNotMatch(root,/name="geo.region" content="ZA-GT"/);
 assert.doesNotMatch(fallback,/name="geo.placename" content="Pretoria"/);
});

function fakeResponse(){
 const headers={};let status=200,body;
 return {
  headers,
  setHeader(name,value){headers[name.toLowerCase()]=value;},
  status(value){status=value;return this;},
  send(value){body=value;return this;},
  result(){return {status,body,headers};},
 };
}

test("Public pages sitemap stays readable when upstream REST is offline; dynamic feeds correctly signal 503",async()=>{
 const fetchBefore=globalThis.fetch;
 const oldUrl=process.env.SUPABASE_URL;
 const oldKey=process.env.SUPABASE_ANON_KEY;
 try {
  process.env.SUPABASE_URL="https://example.invalid";
  process.env.SUPABASE_ANON_KEY="test-public-key";
  globalThis.fetch=async()=>{throw new Error("fetch failed");};
  const pages=fakeResponse();
  await sitemapHandler({query:{type:"pages"}},pages);
  const p=pages.result();
  assert.equal(p.status,200);
  assert.equal(p.headers["x-seo-sitemap-source"],"network");
  assert.match(p.body,/https:\\/\\/www.reskonnect.org\\/student-accommodation\\/soshanguve/);
  assert.match(p.body,/https:\\/\\/www.reskonnect.org\\/student-accommodation\\/nsfas-no-top-up/);
  assert.match(p.body,/https:\\/\\/www.reskonnect.org\\/opportunities\\/wil/);
  const dynamic=fakeResponse();
  await sitemapHandler({query:{type:"residences"}},dynamic);
  assert.equal(dynamic.result().status,503,"keep source outages retryable");
  assert.equal(dynamic.result().headers["cache-control"],"no-store");
 } finally {
  globalThis.fetch=fetchBefore;
  if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
  if(oldKey===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=oldKey;
 }
});
