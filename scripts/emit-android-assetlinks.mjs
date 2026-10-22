import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("dist/.well-known");
const outFile = path.join(outDir, "assetlinks.json");
const pattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const fingerprints = String(process.env.ANDROID_APP_LINKS_SHA256_CERTS || "")
  .split(",")
  .map(value => value.trim().toUpperCase())
  .filter((value, index, all) => pattern.test(value) && all.indexOf(value) === index);

if (!fingerprints.length) {
  // Android bundle CI does not need a website signing fingerprint. Production
  // Vercel must set this to the Play App Signing SHA-256 before App Links can be
  // declared verified. Never emit a fake or upload-key-only association.
  console.warn("Android assetlinks.json not emitted: ANDROID_APP_LINKS_SHA256_CERTS is not configured.");
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify([
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "org.reskonnect.app",
      sha256_cert_fingerprints: fingerprints,
    },
  },
], null, 2)}\n`);
console.log(`Emitted ${outFile} with ${fingerprints.length} Android signing fingerprint(s).`);
