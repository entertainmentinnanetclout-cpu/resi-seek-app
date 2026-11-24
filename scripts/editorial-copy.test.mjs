import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import typescript from "typescript";

// This suite also runs on Node 20 (SEO gate), which cannot import TS natively.
// Transpile the actual production module in memory, without duplicating logic.
const tsSource=readFileSync(new URL("../src/lib/editorialCopy.ts",import.meta.url),"utf8");
const compiled=typescript.transpileModule(tsSource,{
 compilerOptions:{target:typescript.ScriptTarget.ES2022,module:typescript.ModuleKind.ESNext},
});
const {polishEditorialCopy}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);

const read=(path)=>readFileSync(path,"utf8");

test("Public copy uses sentences instead of decorative dashes",()=>{
 assert.equal(polishEditorialCopy("Explore ResKonnect — find a home"),"Explore ResKonnect, find a home");
 assert.equal(polishEditorialCopy("Residence booking - request a room"),"Residence booking, request a room");
 assert.equal(polishEditorialCopy("Living – Applications – Opportunity"),"Living, Applications, Opportunity");
 assert.equal(polishEditorialCopy("Academic years 2026–2027"),"Academic years 2026 to 2027");
 assert.equal(polishEditorialCopy("Academic years 2026 - 2027"),"Academic years 2026 to 2027");
 assert.equal(polishEditorialCopy("R1 500 - R3 000"),"R1 500 to R3 000");
 assert.equal(polishEditorialCopy("5 - 2 = 3"),"5 - 2 = 3");
 assert.equal(polishEditorialCopy("A student-first, AI-powered service"),"A student focused, AI supported service");
 assert.equal(polishEditorialCopy("single-room waiting list"),"single room waiting list");
 assert.equal(polishEditorialCopy("An end-to-end student-led journey"),"An integrated student led journey");
 assert.equal(polishEditorialCopy("high-speed student-focused housing"),"high speed student focused housing");
 assert.equal(polishEditorialCopy("3-bedroom residence"),"3 bedroom residence");
 assert.equal(polishEditorialCopy("Mary-Jane"),"Mary-Jane");
 assert.equal(polishEditorialCopy("Open /single-room-waiting-list — continue"),"Open /single-room-waiting-list, continue");
 assert.equal(polishEditorialCopy("Check https://www.reskonnect.org/single-room-waiting-list — submit"),"Check https://www.reskonnect.org/single-room-waiting-list, submit");
});

test("Links, identifiers, real places, negative numbers and user content remain intact",()=>{
 for(const raw of [
  "https://www.reskonnect.org/single-room-waiting-list",
  "mailto:student-support@reskonnect.org",
  "Ga-Rankuwa",
  "-25.7479",
  "2026-11-24",
  "student-care",
  "/single-room-waiting-list",
  "CPS-2026-001"
 ])assert.equal(polishEditorialCopy(raw),raw,raw);
});

test("Sitewide editorial styling updates copy without editing app data",()=>{
 const app=read("src/main.tsx");
 const helper=read("src/lib/editorialCopy.ts");
 const seo=read("src/components/SEO.tsx");
 assert.match(app,/installEditorialCopy\(document\.body\)/);
 assert.match(seo,/polishEditorialCopy\(title/);
 assert.match(seo,/polishEditorialCopy\(/);
 assert.match(helper,/MutationObserver/);
 assert.match(helper,/attributeFilter:/);
 assert.match(helper,/\[contenteditable\]/);
 assert.match(helper,/\.gm-style/);
 assert.match(helper,/if\(value!==updated\)node.nodeValue=updated/);
 assert.doesNotMatch(helper,/\.from\(["']|\.update\(|\.insert\(/);
});

test("First impressions and PWA brand copy follow the same rule",()=>{
 const about=read("src/pages/public/About.tsx");
 const nav=read("src/components/SiteHeader.tsx");
 const manifest=read("vite.config.ts");
 assert.match(nav,/reservations are open\. Browse available/);
 assert.match(about,/Students come first\. Our vision goes further\./);
 assert.match(manifest,/ResKonnect \| Living, AI and Opportunity/);
 assert.doesNotMatch(about,/Our Story \| ResKonnect —/);
});
