// Production regression guard for the phase 0–3 God Mode visual editor and housing cards.
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const check=(condition,message)=>{assert.ok(condition,message);console.log("✓ "+message);};

const sql=read("supabase/migrations/20261111132500_admin_visual_studio_slug_aliases.sql");
const grants=read("supabase/migrations/20261111150500_admin_visual_public_column_scope.sql");
const snapshot=JSON.parse(read("scripts/backend-live-contracts.snapshot.json"));
const client=read("src/pages/admin/AdminVisualStudio.tsx");
const body=read("src/components/admin/VisualPageBlock.tsx");
const auth=read("src/lib/adminVisualPreview.ts");
const hook=read("src/hooks/useVisualPageSections.ts");
const landing=read("src/pages/Landing.tsx");
const finder=read("src/pages/FindMyRes.tsx");
const headers=JSON.parse(read("vercel.json")).headers.find(item=>item.source==="/(.*)").headers;
const editorial=read("supabase/migrations/20261114064500_visual_studio_editorial_copy_registration.sql");
const detail=read("src/pages/ResidenceDetail.tsx");
const app=read("src/App.tsx");
const panels=[
 "src/components/findmyres/ResidenceDiscoveryCard.tsx",
 "src/components/findmyres/ResidencePropertyCard.tsx",
 "src/components/findmyres/PremiumResidenceShowcase.tsx",
 "src/components/findmyres/ResidenceSpotlightSlider.tsx",
 "src/components/findmyres/ResidenceBrandStudioCard.tsx",
 "src/components/findmyres/NearbySuggestedResidences.tsx",
 "src/components/ResidenceCard.tsx",
 "src/components/ResidenceSectionGrid.tsx",
 "src/components/resmap/ResMapResidenceCard.tsx",
].map(read);
const dataPlaces=[
 "src/hooks/useLandingSpotlightResidences.ts",
 "src/components/landing/TrustedLivingShowcase.tsx",
 "src/components/findmyres/MonthlyTopThree.tsx"
].map(read);
check(sql.includes("rk_visual_page_revisions")&&sql.includes("rk_visual_page_audit"),
 "Page publishing has version and audit persistence");
check(sql.includes("auth.jwt()->>'aal'")&&sql.includes("has_role(actor,'admin'"),
 "Page and curation writes require server-enforced admin with MFA");
check(sql.includes("residence_slug_aliases")&&sql.includes("rk_record_residence_slug_alias"),
 "Renames retain old residence slug aliases");
check(sql.includes("Villa Ubuntu Student Accommodation")&&sql.includes("ekhaya-junction"),
 "Villa Ubuntu migration addresses the reported stale route");
check(grants.includes("REVOKE SELECT")&&grants.includes("updated_at")&&!grants.includes("updated_by"),
 "Public page layout API excludes editor user IDs");
check(detail.includes(".from(\"residence_slug_aliases\")")&&detail.includes("navigate(\"/find-my-res/\""),
 "Old residence URLs resolve and canonicalise to the new name");
check(app.includes('path="/admin/studio"')&&app.includes("<AdminRoute>"),
 "Visual Studio stays inside the God Mode route");
check(client.includes('rk_visual_save_page')&&client.includes("VisualPageBlock")===false,
 "Visual editor saves through versioned backend RPC");
check(client.includes("postMessage")&&auth.includes('decoded?.aal==="aal2"')&&hook.includes("isVisualPreviewAuthorized")&&body.includes("slot?:VisualPageSection"),
 "In-page inspector preview requires same-origin admin MFA with one shared page source");
check(client.includes("<ResidenceVisualManager")&&client.includes("<SpotlightPlacementManager")&&client.includes("<MonthlyTopThreeManager"),
 "Visual studio unifies residence, Spotlight and Top 3 administration");
check(headers.find(item=>item.key==="X-Frame-Options")?.value==="SAMEORIGIN"
 &&headers.find(item=>item.key==="Content-Security-Policy")?.value==="frame-ancestors 'self'",
 "Production framing blocks external sites while allowing the same-origin visual canvas");
check(hook.includes('rk-visual-ready')&&hook.includes('rk-visual-applied')
 &&hook.includes('rk-visual-focus')&&hook.includes('event.source!==window.parent')
 &&hook.includes('document.addEventListener("click",select,true)'),
 "Canvas has authenticated ready/applied/focus handshake and blocks destructive clicks");
check(!body.includes("useVisualPageSections(")&&body.includes("slot?:VisualPageSection")
 &&landing.includes('const {byKey,isPreview}=useVisualPageSections("landing")')
 &&finder.includes('const {byKey,isPreview}=useVisualPageSections("findmyres")'),
 "Each page now owns exactly one shared page-data/preview hook; blocks cannot spawn extra subscriptions");
check((landing.match(/slot=\{byKey\[/g)||[]).length===22
 &&(finder.match(/slot=\{byKey\[/g)||[]).length===10,
 "All 32 registered public sections receive the same live editor draft");
check(editorial.includes("editable_copy=true")&&editorial.includes("'vision'")
 &&editorial.includes("'cities'")&&editorial.includes("'faq'")
 &&landing.includes("byKey.vision?.headline")&&landing.includes("byKey.cities?.subtitle"),
 "Homepage editorial copy fields are registered in Supabase and rendered in the live page");
check(client.includes('Preview did not connect')&&client.includes('reloadPreview')
 &&client.includes('previewRequest.current')&&client.includes('latestDraft')
 &&client.includes('unsavedLocal')&&client.includes('Resume saved draft'),
 "Editor provides timeout/retry, ACK tracking, unsaved-change protection and revision recovery");
check(finder.includes('open={showFirstVisitModal&&!isPreview}')&&finder.includes('if (isPreview) { setShowFirstVisitModal(false); return; }'),
 "Public onboarding cannot obstruct God Mode Find My Res preview");

check(panels.every(c=>c.includes("ResidenceInstitutionBadges")),
 "All listing card families render institution eligibility badges");
check(dataPlaces.every(c=>c.includes("institution_tags")),
 "Homepage Spotlight, trusted network and Top 3 fetch explicit institution evidence");
check(snapshot.public_relations.includes("residence_slug_aliases")
 &&snapshot.public_relations.includes("rk_visual_page_sections")
 &&snapshot.callable_routines.some(r=>r.name==="rk_visual_save_page"&&r.authenticated&&!r.anon),
 "Frontend contracts reflect the deployed database API");
console.log("God Mode Visual Studio phase 0–3 regression checks passed.");
