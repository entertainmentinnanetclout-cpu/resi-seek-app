import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/lib/residenceListingEvidence.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { exports: module.exports, module, Date, Number, Array, parseFloat });
const { publicPrivateMonthlyRent, hasVerifiedPrivateRent, reportedCampusDistanceKm, hasPropertyPhotoReference, hasVerifiedLocation } = module.exports;

assert.equal(publicPrivateMonthlyRent({ price: 0, private_price: 0 }), null, "unknown rates are not R0");
assert.equal(publicPrivateMonthlyRent({ price: 2850 }), 2850, "published rent");
assert.equal(hasVerifiedPrivateRent({ price: 2850 }), false, "reported is not verified");
assert.equal(hasVerifiedPrivateRent({ price: 2850, price_verified_at: "2026-11-09" }), true);
assert.equal(publicPrivateMonthlyRent({ room_pricing: [{ private_price: 1700, available_beds: 0 }] }), null, "unavailable room cannot match a budget");
assert.equal(publicPrivateMonthlyRent({ room_pricing: [{ private_price: 2500, available_beds: 1 }, { private_price: 1900, available_beds: 2 }] }), 1900);
assert.equal(publicPrivateMonthlyRent({ promo_active: true, promo_price: 1500, promo_ends_at: "2026-01-01", private_price: 2800 }, Date.parse("2026-11-09")), 2800, "expired promos are not live");
assert.equal(reportedCampusDistanceKm(null), null);
assert.equal(reportedCampusDistanceKm(0), null, "missing distances cannot pass a radius filter");
assert.equal(reportedCampusDistanceKm("3.5 km"), 3.5);
assert.equal(reportedCampusDistanceKm("near campus"), null);
assert.equal(hasPropertyPhotoReference({ studio_image_url: "poster.png" }), false, "marketing poster is not photo evidence");
assert.equal(hasPropertyPhotoReference({ images: ["property.jpg"] }), true);
assert.equal(hasVerifiedLocation({ latitude: -25.75, longitude: 28.2 }), false, "coordinates are not verification");
assert.equal(hasVerifiedLocation({ latitude: -25.75, longitude: 28.2, location_verification_status: "verified" }), true);
console.log("Marketplace Phases 1–3: listing evidence and affordability safeguards PASS");
