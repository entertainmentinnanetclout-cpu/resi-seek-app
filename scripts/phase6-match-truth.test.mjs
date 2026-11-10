import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTs(path, imports=()=>{throw new Error("Unexpected import");}) {
  const source=readFileSync(path,"utf8");
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{exports:module.exports,module,require:imports,Number,String,Array,Object,Date,Math,parseFloat});
  return module.exports;
}
const evidence=loadTs("src/lib/residenceListingEvidence.ts");
const {scoreResidenceForDNA,DEFAULT_DNA}=loadTs("src/lib/resmap/match.ts",(name)=>{
  assert.equal(name,"@/lib/residenceListingEvidence");
  return evidence;
});
const base={id:"res1",city:"Pretoria",campus:"TUT Pretoria West",available_spots:8,accepts_private:true,accepts_nsfas:false,price:0,private_price:0,nsfas_price:null,room_types:["single"]};
const dna={...DEFAULT_DNA,campus:"TUT Pretoria West",budgetMin:0,budgetMax:2500,fundingType:"private"};

test("unpriced accommodation cannot score as a perfect affordable offer",()=>{
  const result=scoreResidenceForDNA(base,dna);
  assert.equal(result.hasQuotedRent,false);
  assert.ok(result.score<=65);
  assert.match(result.misses.join(" "),/Monthly rent unknown/);
  assert.equal(result.confidence,"limited");
});
test("an NSFAS accreditation field alone cannot imply acceptance",()=>{
  const result=scoreResidenceForDNA({...base,is_tut_accredited:true,nsfas_accredited:true}, {...dna,fundingType:"nsfas"});
  assert.match(result.misses.join(" "),/has not confirmed/);
  assert.doesNotMatch(result.reasons.join(" "),/accepting NSFAS/i);
  assert.equal(result.hasQuotedRent,false);
});
test("funding not yet decided must not grant an unearned match bonus",()=>{
  const undecided=scoreResidenceForDNA(base,{...dna,fundingType:"undecided"});
  const omitted=scoreResidenceForDNA(base,{...dna,fundingType:undefined});
  assert.equal(undecided.score,omitted.score);
});
test("expired promotional prices do not make a residence affordable",()=>{
  const residence={...base,private_price:3200,promo_active:true,promo_price:1000,promo_ends_at:"2026-01-01"};
  const result=scoreResidenceForDNA(residence,{...dna,budgetMax:1500});
  assert.match(result.misses.join(" "),/outside your selected budget/);
});
test("evidence confidence only becomes supported with independently verified price, location and a configured room",()=>{
  const verified={...base,private_price:2400,latitude:-25.75,longitude:28.2,location_verification_status:"verified",
    cover_image_url:"https://example.com/genuine-property-evidence.jpg",
    room_pricing:[{name:"Single",is_active:true,academic_year:2027,capacity:3,available_beds:2,private_price:2400,price_verified_at:"2026-11-10"}]};
  const result=scoreResidenceForDNA(verified,dna);
  assert.equal(result.confidence,"supported");
  assert.equal(result.hasVerifiedRent,true);
  assert.ok(result.evidenceCount>=4);
  assert.doesNotMatch(result.reasons.join(" "),/guaranteed/i);
});
const engine=readFileSync("src/components/resmap/ResDiscoveryEngine.tsx","utf8");
test("group matching rejects missing rent, labels reported spaces, avoids fake 3D",()=>{
  assert.match(engine,/rent!==null && rent<=groupBudget/);
  assert.match(engine,/View listing details/);
  assert.match(engine,/Price on request/);
  assert.match(engine,/reported spaces/);
  assert.match(engine,/saved to your discovery history|Saved to your shortlist on this device/);
  assert.doesNotMatch(engine,/Number\(residence\.private_price\|\|residence\.price\|\|0\)===0/);
});
const admin=readFileSync("src/pages/admin/AdminIntelligenceAnalytics.tsx","utf8");
test("AdminOS exposes marketplace evidence rather than synthetic AI outcome percentages",()=>{
  assert.match(admin,/AdminMarketplaceEvidence/);
  assert.match(readFileSync("src/components/admin/AdminMarketplaceEvidence.tsx","utf8"),/not matching accuracy, admission success/);
});
const prefs=readFileSync("src/hooks/useResPreferenceDNA.ts","utf8");
test("preference save distinguishes device persistence from verified cloud synchronization",()=>{
  assert.match(prefs,/if \(error\)/);
  assert.match(prefs,/return false/);
  assert.match(prefs,/return true/);
});
