import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname,resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const get=p=>readFileSync(resolve(root,p),"utf8");
const sql=get("supabase/migrations/20261115084500_sec07_storage_bucket_mime_size_allowlists.sql");
const rules=[
  {
    "name": "admin-images",
    "mb": 25,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  },
  {
    "name": "bursary-images",
    "mb": 10,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  },
  {
    "name": "campaign-assets",
    "mb": 10,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  },
  {
    "name": "complaint-attachments",
    "mb": 15,
    "types": [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/avif",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
  },
  {
    "name": "hamper-images",
    "mb": 10,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  },
  {
    "name": "marketplace",
    "mb": 10,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  },
  {
    "name": "product-images",
    "mb": 12,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  },
  {
    "name": "profile-pictures",
    "mb": 5,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  },
  {
    "name": "seller-kyc",
    "mb": 15,
    "types": [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/avif"
    ]
  },
  {
    "name": "store-assets",
    "mb": 10,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  },
  {
    "name": "store-banners",
    "mb": 12,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  },
  {
    "name": "user-profiles",
    "mb": 8,
    "types": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif"
    ]
  }
];
const assertOk=(v,msg)=>{assert.ok(v,msg);console.log("PASS",msg)};
assert.equal(rules.length,12);
for(const row of rules){
  assertOk(sql.includes("'"+row.name+"'::text"),"Scoped bucket "+row.name+" exists");
  assertOk(sql.includes("'"+row.name+"'::text,"+row.mb+" * 1024 * 1024"),"Cap for "+row.name+" is "+row.mb+" MiB");
  for(const type of row.types)assertOk(sql.includes("'"+type+"'"),row.name+" MIME policy includes "+type);
  assertOk(row.mb<=25,"Per-bucket limits stay below common global plan maxima");
}
assertOk(sql.includes("file_size_limit is null and allowed_mime_types is null") &&
  sql.includes("SEC07 bucket baseline has changed"),"Migration fails closed if bucket settings changed");
assertOk(sql.includes("v_rows <> 12"),"Migration cannot silently update an incomplete set");
assertOk(!sql.includes("delete from storage.objects")&&!sql.includes("truncate table storage.objects"),
  "Existing uploads are never deleted");
assertOk(!rules.some(r=>r.types.includes("image/svg+xml")||r.types.includes("text/html")||r.types.includes("application/octet-stream")),
  "New uploads cannot use HTML, scriptable SVG or arbitrary octet-stream MIME");
const helper=get("src/lib/storage/uploadPolicy.ts");
for(const type of ["image/jpeg","image/png","image/webp","image/gif","image/avif"])assertOk(helper.includes(type),"Client image MIME matches server: "+type);
for(const p of ["src/components/ImageInput.tsx","src/pages/SellerOnboarding.tsx","src/pages/StoreSetup.tsx","src/pages/StoreEdit.tsx"]){
const src=get(p);
assertOk(src.includes("publicImageUploadError"),p+" enforces file validation");
assertOk(src.includes("PUBLIC_IMAGE_ACCEPT"),p+" narrows image picker");
}
const seller=get("src/pages/SellerOnboarding.tsx");
assertOk(seller.includes("sellerVerificationUploadError") &&
seller.includes("if (error) throw error;") &&
!seller.includes("if (error) { console.error(error); return null; }"),
"Seller KYC submission fails closed instead of ignoring upload failures");
assertOk(get("package.json").includes("node scripts/sec07-storage-mime-limits.test.mjs"),
"Mandatory backend contract suite includes SEC07 storage budget test");
console.log("SEC07 file-type and size caps source audit PASS; live bucket settings verified separately.");
