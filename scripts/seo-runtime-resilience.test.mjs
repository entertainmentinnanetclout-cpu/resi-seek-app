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
 assert.ok(root.includes("ResKonnect — Building Africa&#39;s First AI/SI-Powered Student Platform"));
 assert.match(root,/Student accommodation by city/);
 assert.match(root,/Soshanguve/);
 assert.match(root,/Why ResKonnect requests Gmail permission/);
 assert.ok(root.includes('rel="canonical" href="https://www.reskonnect.org"'));
 assert.ok(fallback.includes('<div id="root"></div>'));
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
  assert.ok(p.body.includes("https://www.reskonnect.org/student-accommodation/soshanguve"));
  assert.ok(p.body.includes("https://www.reskonnect.org/student-accommodation/nsfas-no-top-up"));
  assert.ok(p.body.includes("https://www.reskonnect.org/opportunities/wil"));
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

test("Live Hub sitemap supports publishable keys without a forged bearer JWT",async()=>{
 const names=["SUPABASE_URL","VITE_SUPABASE_URL","SUPABASE_ANON_KEY","VITE_SUPABASE_ANON_KEY",
   "NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_PUBLISHABLE_KEY",
   "VITE_SUPABASE_PUBLISHABLE_KEY","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
 const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;
 const calls=[];
 try {
   for(const key of names)delete process.env[key];
   process.env.VITE_SUPABASE_URL="https://mefjzkhobkltlbmhusdh.supabase.co";
   process.env.VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test_fake_for_unit_test";
   globalThis.fetch=async(url,request)=>{
     calls.push({url,headers:request.headers});
     let rows=[];
     if(url.includes("seo_public_pages_v"))rows=[{path:"/student-accommodation/soshanguve",updated_at:null}];
     if(url.includes("/residences?"))rows=[{slug:"public-residence",updated_at:null}];
     if(url.includes("/property_opportunities?"))rows=[{slug:"published-property",updated_at:null}];
     if(url.includes("/public_opportunities?"))rows=[{slug:"public-opportunity",updated_at:null}];
     return {ok:true,json:async()=>rows};
   };
   for (const type of ["pages","residences","properties","opportunities"]) {
     const output=fakeResponse();
     await sitemapHandler({query:{type}},output);
     assert.equal(output.result().status,200,`${type} should return 200`);
     assert.match(output.result().body,/https:\/\/www\.reskonnect\.org/);
   }
   assert.equal(calls.length,4);
   for(const call of calls){
     assert.ok(call.url.startsWith("https://mefjzkhobkltlbmhusdh.supabase.co/rest/v1/"));
     assert.equal(call.headers.apikey,"sb_publishable_test_fake_for_unit_test");
     assert.equal(call.headers.Authorization,undefined,"do not send non-JWT publishable key as Bearer");
   }
 } finally {
   globalThis.fetch=originalFetch;
   for(const key of names){
     if(before[key]===undefined)delete process.env[key];
     else process.env[key]=before[key];
   }
 }
});

test("Legacy anon JWT deployments remain compatible with a bearer token",async()=>{
 const names=["SUPABASE_URL","VITE_SUPABASE_URL","SUPABASE_ANON_KEY","VITE_SUPABASE_ANON_KEY",
   "NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_PUBLISHABLE_KEY",
   "VITE_SUPABASE_PUBLISHABLE_KEY","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
 const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;
 let headers;
 try{
   for(const key of names)delete process.env[key];
   process.env.SUPABASE_URL="https://mefjzkhobkltlbmhusdh.supabase.co";
   process.env.SUPABASE_ANON_KEY="eyJlegacy.eyJanon.example_sig";
   globalThis.fetch=async(_url,request)=>{
     headers=request.headers;
     return {ok:true,json:async()=>[]};
   };
   const response=fakeResponse();
   await sitemapHandler({query:{type:"residences"}},response);
   assert.equal(response.result().status,200);
   assert.equal(headers.apikey,process.env.SUPABASE_ANON_KEY);
   assert.equal(headers.Authorization,"Bearer "+process.env.SUPABASE_ANON_KEY);
 }finally{
   globalThis.fetch=originalFetch;
   for(const key of names){
     if(before[key]===undefined)delete process.env[key];
     else process.env[key]=before[key];
   }
 }
});
