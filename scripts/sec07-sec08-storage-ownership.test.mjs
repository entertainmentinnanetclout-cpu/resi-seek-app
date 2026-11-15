import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const sql=read("supabase/migrations/20261115083500_sec07_sec08_storage_owner_isolation.sql");
const expect=(b,msg)=>{assert.ok(b,msg);console.log("PASS",msg)};
expect(sql.includes('drop policy if exists "Allow public read access to user-profiles" on storage.objects'),
 "Previously anonymous-readable private user-profiles has broad SELECT revoked");
expect(sql.includes('alter policy "Allow authenticated uploads to user-profiles"') &&
 sql.includes("owner = auth.uid()") && !sql.includes("owner is null"),
 "Private profile uploads require ownership, not null-owner fallback");
for(const old of ["Authenticated users can upload store assets","Users can upload store assets"]){
 expect(sql.includes('drop policy if exists "'+old+'"'),"Remove permissive store-assets INSERT policy: "+old);
}
expect(sql.includes('create policy "store-assets owner-scoped insert"') &&
 sql.includes("for insert to authenticated") &&
 sql.includes("(storage.foldername(name))[1] = auth.uid()::text") &&
 sql.includes("owner = auth.uid()") &&
 sql.includes("public.has_role(auth.uid(), 'admin'::public.app_role)"),
 "Store asset uploads require owner folder or verified admin role");
for(const p of ["src/pages/StoreSetup.tsx","src/pages/StoreEdit.tsx","src/pages/SellerOnboarding.tsx"]){
 expect(read(p).includes('${user.id}/'),"Existing store upload consumer uses owner-UUID folder: "+p);
}
expect(read("package.json").includes("node scripts/sec07-sec08-storage-ownership.test.mjs"),
 "Mandatory backend contract suite includes storage privacy regression");
console.log("SEC07/08 static controls passed. Verify live anon/owner role negatives after migration.");
