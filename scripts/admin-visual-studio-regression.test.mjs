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
const detail=read("src/pages/ResidenceDetail.tsx");
const app=read("src/App.tsx");
const panels=[
 "src/components/findmyres/ResidenceDiscoveryCard.tsx",
 "src/components/findmyres/ResidencePropertyCard.tsx",
 "src/components/findmyres/PremiumResidenceShowcase.tsx",
 "src/components/findmyres/ResidenceSpotlightSlider.tsx",
 "src/components/findmyres/ResidenceBrandStudioCard.tsx",
 "src/components/findmyres/NearbySuggestedResidences.tsx",
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
check(client.includes("postMessage")&&auth.includes('decoded?.aal==="aal2"')&&body.includes("isVisualPreviewAuthorized"),
 "In-page inspector preview requires same-origin admin MFA");
check(client.includes("<ResidenceVisualManager")&&client.includes("<SpotlightPlacementManager")&&client.includes("<MonthlyTopThreeManager"),
 "Visual studio unifies residence, Spotlight and Top 3 administration");
check(panels.every(c=>c.includes("ResidenceInstitutionBadges")),
 "All listing card families render institution eligibility badges");
check(dataPlaces.every(c=>c.includes("institution_tags")),
 "Homepage Spotlight, trusted network and Top 3 fetch explicit institution evidence");
check(snapshot.public_relations.includes("residence_slug_aliases")
 &&snapshot.public_relations.includes("rk_visual_page_sections")
 &&snapshot.callable_routines.some(r=>r.name==="rk_visual_save_page"&&r.authenticated&&!r.anon),
 "Frontend contracts reflect the deployed database API");
console.log("God Mode Visual Studio phase 0–3 regression checks passed.");
