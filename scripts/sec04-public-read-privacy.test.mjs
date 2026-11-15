import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname,resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const sql=read("supabase/migrations/20261115081500_sec04_public_read_rpc_privacy_bounds.sql");
const expect=(x,msg)=>{assert.ok(x,msg);console.log("PASS",msg)};
for(const name of ["get_referral_public","virtual_tour_public_snapshot","reskonnect_opportunity_feed"]){
 expect(sql.includes("CREATE OR REPLACE FUNCTION public."+name+"("),"Public read ABI preserved for "+name);
 expect(sql.includes("SECURITY DEFINER"),"Privileged function remains explicitly designated");
}
expect(sql.includes("octet_length(_code)>100") &&
 sql.includes("WHERE rc.code = _c AND rc.is_active = true") &&
 sql.includes("RETURN QUERY"),
 "Inactive recruiter names and oversized public lookup keys are not returned");
expect(sql.includes("v_pub.residence_id is not null and not exists") &&
 sql.includes("where r.id = v_pub.residence_id and r.is_visible = true") &&
 sql.includes("where r.id=v_pub.residence_id and r.is_visible=true") &&
 sql.includes("if v_pub.residence_id is not null then"),
 "Published standalone tours remain accessible; hidden linked residences suppress snapshots");
expect(sql.includes("octet_length(coalesce(p_query,''))>256") &&
 sql.includes("octet_length(coalesce(p_type,''))>96") &&
 sql.includes("using errcode='22023'") &&
 sql.indexOf("Search input is too long") < sql.indexOf("with unified as ("),
 "Anonymous opportunity search input bytes are bounded before privileged reads");
expect(read("package.json").includes("node scripts/sec04-public-read-privacy.test.mjs"),
 "Mandatory backend contract CI includes public read privacy regressions");
console.log("SEC-04 public-read regression guards passed; live anon-role negatives remain separate.");
