import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const manifest = JSON.parse(readFileSync("scripts/edge-source-provenance.snapshot.json", "utf8"));
const baseline = JSON.parse(readFileSync("scripts/backend-live-contracts.snapshot.json", "utf8"));
const config = readFileSync("supabase/config.toml", "utf8");

test("live source archive belongs to canonical Supabase project", () => {
  assert.equal(manifest.project_id, "mefjzkhobkltlbmhusdh");
  assert.equal(new Set(manifest.functions.map(f => f.slug)).size, manifest.functions.length);
});

for (const fn of manifest.functions) {
  test("source and JWT parity capture: " + fn.slug, () => {
    const deployed = baseline.edge_functions.find(item => item.slug === fn.slug);
    assert.ok(deployed && deployed.status === "ACTIVE", fn.slug + " absent from captured production inventory");
    assert.equal(deployed.verify_jwt, fn.verify_jwt, fn.slug + " JWT mismatch");
    assert.ok(config.includes("[functions." + fn.slug + "]\nverify_jwt = " + String(fn.verify_jwt)),
      fn.slug + " does not explicitly match production JWT configuration");
    for (const file of fn.files) {
      const bytes = readFileSync(file.path);
      const gitBlobSha = createHash("sha1")
        .update(Buffer.from("blob " + bytes.length + "\0"))
        .update(bytes)
        .digest("hex");
      assert.equal(gitBlobSha, file.git_blob_sha,
        file.path + " was changed after source capture: review and refresh provenance before deploying");
    }
  });
}
