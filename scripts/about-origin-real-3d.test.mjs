import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=(path)=>readFileSync(path,"utf8");

test("Public About page uses only an anonymous, authentic origin story",()=>{
 const about=read("src/pages/public/About.tsx");
 for(const term of ["NSFAS","final year","Far from home","student accommodation","Tshwane University of Technology marketing graduate","Our mission","Our vision"]){
  assert.ok(about.includes(term),`About must retain ${term}`);
 }
 assert.doesNotMatch(about,/const team\s*=|team\.map|Founding team|Founder & Executive Director|Co-Founder|Junior Developer & Auditor|ayanda-founder-profile|assets\/team\//i);
 assert.doesNotMatch(about,/Meet the ResKonnect team|People building the vision/i);
 assert.match(about,/what gives|long-term purpose|lasting purpose|long-term commitment/i);
 assert.match(about,/canonicalPath="\/about"/);
});

test("Landing 3D preview loads real geographic imagery, not re-exported 2D animation",()=>{
 const landing=read("src/pages/Landing.tsx");
 const map=read("src/components/resmap/LandingResMap3DPreview.tsx");
 assert.match(landing,/lazy\(\(\) => import\("@\/components\/resmap\/LandingResMap3DPreview"\)\)/);
 assert.match(landing,/<DeferredSection minHeight=\{520\}><LandingResMap3DPreview\s*\/>/);
 assert.doesNotMatch(map,/^export \{ default \} from "\.\/LandingResMap2DPreview"/m);
 for(const requirement of [
  'google.maps.importLibrary("maps3d")',
  "new Map3DElement",
  'mode:"HYBRID"',
  "tilt:67.5",
  "range:2800",
  "Marker3DInteractiveElement",
  'from("resmap_map_config")',
  'from("residences")',
  'eq("is_visible",true)',
  "setEngine(\"photorealistic\")",
  "setEngine(\"vector\")",
  "setEngine(\"fallback\")",
  "LandingResMap2DPreview",
  'data-testid="landing-real-3d-map-host"',
 ]){
  assert.ok(map.includes(requirement),`3D map requirement: ${requirement}`);
 }
 assert.match(map,/This is live geographic imagery, not an animated demonstration/);
 assert.match(map,/\?view=map&mode=3d/);
 assert.match(map,/WebGL/);
 assert.match(map,/Retry real 3D/);
});

test("Production real 3D defaults remain compatible with dedicated full-map experience",()=>{
 const full=read("src/components/resmap/ResMapExperiencePremiumV4.tsx");
 const landing=read("src/components/resmap/LandingResMap3DPreview.tsx");
 assert.match(full,/resmap-google-maps-js/);
 assert.match(landing,/resmap-google-maps-js/);
 assert.match(full,/Map3DElement/);
 assert.match(landing,/Map3DElement/);
 assert.match(full,/mode: "HYBRID"/);
});
