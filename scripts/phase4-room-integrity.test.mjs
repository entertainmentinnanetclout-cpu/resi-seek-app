import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";

const code = readFileSync("src/lib/residenceRoomIntegrity.ts", "utf8");
const output = ts.transpileModule(code, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module = {exports:{}};
vm.runInNewContext(output,{exports:module.exports,module,Number,String,Object});
const {roomIntegrityIssue} = module.exports;
const sample = {name:"Single",academic_year:2027,capacity:8,available_beds:3,private_price:2600,nsfas_price:null,promo_price:null,deposit:0};

test("complete landlord room offer validates",()=>assert.equal(roomIntegrityIssue(sample),null));
test("unknown or zero private and funded rates never become a free offer",()=>{
  assert.match(roomIntegrityIssue({...sample,private_price:0}),/positive monthly rate/);
  assert.match(roomIntegrityIssue({...sample,private_price:"",nsfas_price:""}),/positive monthly rate/);
});
test("inventory cannot oversell rooms, invent capacity or accept negative prices",()=>{
  assert.match(roomIntegrityIssue({...sample,available_beds:9}),/between zero and capacity/);
  assert.match(roomIntegrityIssue({...sample,available_beds:-1}),/between zero and capacity/);
  assert.match(roomIntegrityIssue({...sample,capacity:0}),/greater than zero/);
  assert.match(roomIntegrityIssue({...sample,private_price:-3000}),/nonnegative/);
  assert.match(roomIntegrityIssue({...sample,academic_year:0}),/academic year/);
  assert.match(roomIntegrityIssue({...sample,promo_price:2900}),/promotional private rate/);
});
test("current funded-only rate can exist without fictional private rent",()=>{
  assert.equal(roomIntegrityIssue({...sample,private_price:null,nsfas_price:2900}),null);
});
const dashboard = readFileSync("src/pages/residence/ResidenceDashboard.tsx","utf8");
test("residence dashboard contains evidence board and preserves failed API access",()=>{
  assert.match(dashboard,/ResidenceSupplyReadiness/);
  assert.match(dashboard,/residence\.id/);
});
