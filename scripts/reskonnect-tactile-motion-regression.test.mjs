import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const css=read("src/styles/reskonnect-tactile-motion.css");
const helper=read("src/lib/reskonnectMotion.ts");
const icon=read("src/components/ui/RkMorphIcon.tsx");
const app=read("src/main.tsx");
const studio=read("src/pages/admin/AdminVisualStudio.tsx");
const property=read("src/components/admin/ResidenceVisualManager.tsx");
const finder=read("src/pages/FindMyRes.tsx");
const search=read("src/components/findmyres/SmartSearchBar.tsx");
const card=read("src/components/findmyres/ResidenceDiscoveryCard.tsx");
const camera=read("src/components/virtualTours/Guided360Capture.tsx");
const dialog=read("src/components/ui/dialog.tsx");
const pop=read("src/components/ui/popover.tsx");
const select=read("src/components/ui/select.tsx");
const dropdown=read("src/components/ui/dropdown-menu.tsx");
const button=read("src/components/ui/button.tsx");
const switchUi=read("src/components/ui/switch.tsx");
const landing=read("src/pages/Landing.tsx");

test("ResKonnect motion design is activated without unscoped JS animations or new dependencies",()=>{
 assert.match(app,/import "\.\/styles\/reskonnect-tactile-motion\.css"/);
 for(const source of [landing,finder,studio])assert.match(source,/rk-motion/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/prefers-contrast:more/);
 assert.match(helper,/prefers-reduced-motion: reduce/);
 assert.doesNotMatch(helper,/setInterval|requestAnimationFrame|eval\(/);
});
test("all 20 requested motion behaviours have working primitives",()=>{
 const rules=[
  [/rk-soft-enter/,"01 ease-out entrance"],
  [/--rk-time-dropdown:\s*200ms/,"02 200ms dropdown"],
  [/nth-child\(3\)\{animation-delay:60ms\}/,"03 30ms stagger rows"],
  [/scale\(\.97\)/,"04 pressed 0.97"],
  [/rk-switch-stretch/,"05 12 percent knob stretch"],
  [/rk-details-settle/,"06 details settle"],
  [/rk-motion-arc/,"07 curved icon travel"],
  [/rk-success-pulse/,"08 success pulse"],
  [/--rk-ease-move/,"09 ease-in-out moves"],
  [/scale\(\.95\)/,"10 open at 0.95"],
  [/--radix-popover-content-transform-origin/,"11 enter from trigger"],
  [/rk-menu-exit/,"12 exit to trigger"],
  [/--rk-ease-enter: cubic-bezier\(\.16,1,\.3,1\)/,"13 non-bouncy everyday UI"],
  [/transition-duration:\s*0ms/,"14 no tween while held"],
  [/--rk-time-exit:\s*176ms/,"15 exits shorter by 20 percent"],
  [/::view-transition-old\(rk-active-view\)/,"16 overlapping old/new state"],
  [/clip-path:inset\(0 100%/,"17 mask/colour reveal"],
  [/rk-icon-morph.*data-active/s,"18 blurred icon crossfade"],
  [/rk-rubber-hit/,"19 bounded elastic feedback"],
  [/view-transition-name:rk-active-view/,"20 shared layout identity"],
 ];
 for(const [pattern,label] of rules)assert.match(css,pattern,label);
 assert.match(helper,/startViewTransition/);
 assert.match(icon,/data-active/);
});
test("real Radix overlays and physical controls are connected to the motion system",()=>{
 for(const surface of [pop,select,dropdown])assert.match(surface,/rk-motion-menu/);
 assert.match(dialog,/rk-motion-dialog/);
 assert.match(dialog,/rk-motion-overlay/);
 assert.match(button,/rk-pressable/);
 assert.match(switchUi,/rk-tactile-switch/);
 assert.match(search,/rk-clay-action/);
 assert.match(search,/rk-glass-panel/);
 assert.match(card,/rk-physical-card/);
});
test("real estate and admin functionality stays tied to existing operations",()=>{
 assert.match(finder,/runRkLayoutTransition\(\(\)=>setListingStyle\(key\)\)/);
 assert.match(studio,/runRkLayoutTransition\(\(\)=>setViewport\(v\)\)/);
 assert.match(studio,/indicateRkBoundary/);
 assert.match(studio,/rk-device-shell rk-layout-morph/);
 assert.match(studio,/rk_visual_save_page/);
 assert.match(studio,/rk-success-pulse/);
 assert.match(property,/\.from\("residences"\)\.update\(payload\)/);
 assert.match(property,/rk-neo-stat/);
 assert.match(property,/RkMorphIcon/);
 assert.match(camera,/rk-scanner-frame/);
 assert.match(camera,/getUserMedia/);
 assert.doesNotMatch(studio+property+camera,/asset.?guard/i);
});
test("previous visual page markup does not print literal newline escape sequences",()=>{
 assert.doesNotMatch(landing,/<main className="flex flex-col">\\n/);
 assert.doesNotMatch(landing,/<\/VisualPageBlock>\\n/);
});
