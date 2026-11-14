import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root = "scripts/backend-live-contracts.snapshot.json";
const db = JSON.parse(readFileSync(root, "utf8"));
const rpc = (name, expected) => {
  const options = db.callable_routines.filter(x => x.name === name && x.authenticated);
  assert.ok(options.length, name + " missing as authenticated-callable public RPC");
  assert.ok(options.some(x => expected.every(key => x.args.includes(key))),
    name + " missing required request arguments: " + expected.join(","));
};
const edge = name => {
  const item = db.edge_functions.find(x => x.slug === name);
  assert.ok(item && item.status === "ACTIVE", name + " not active on external Supabase");
  return item;
};
const read = path => readFileSync(path, "utf8");

test("2027 reservation interest RPC is deployed and accepts the user-facing form", () => {
  rpc("reskonnect_save_reservation_interest",
    ["p_residence_id","p_funding_type","p_room_preference","p_notes"]);
  const ui = read("src/pages/ResidenceDetail.tsx");
  assert.match(ui, /reskonnect_save_reservation_interest/);
});

test("verified room hold, confirmation, release and viewing transitions exist with matching args", () => {
  rpc("reskonnect_hold_verified_room",["p_reservation_id","p_room_id"]);
  rpc("reskonnect_confirm_verified_room",["p_reservation_id"]);
  rpc("reskonnect_release_verified_room_hold",["p_reservation_id"]);
  rpc("reskonnect_viewing_summary",["p_viewing_id"]);
  rpc("reskonnect_progress_viewing",["p_viewing_id","p_status"]);
  const actions = read("src/components/operations/ResKonnectReservationActions.tsx");
  for(const name of ["reskonnect_hold_verified_room","reskonnect_confirm_verified_room",
    "reskonnect_release_verified_room_hold","reskonnect_progress_viewing"]){
    assert.ok(actions.includes(name), "Operator workflow lost "+name);
  }
});

test("TUT/UNISA/UP Course Match calculate and save RPCs accept exact payload keys", () => {
  for (const key of ["tut","unisa","up"]) {
    rpc("course_match_"+key,["p_student_aps","p_subjects","p_include_non_matches"]);
    rpc("save_"+key+"_course_match",["p_student_aps","p_subjects","p_full_name"]);
  }
  const match = read("src/lib/courseMatch.ts");
  assert.match(match, /const MATCH_RPCS:/);
  assert.match(match, /const SAVE_RPCS:/);
});

test("signed-in application slip, mail and portal functions are deployed to the same external project", () => {
  for (const name of ["generate-booking-slip","admin-residence-portal-accounts",
    "gmail-connect","gmail-send","reskonnect-email-dock","identity-sync"]) {
    assert.equal(edge(name).verify_jwt,true,name+" must require authenticated JWT");
  }
  const helper=read("src/lib/lovableFunctions.ts");
  assert.match(helper,/externalFunctionUrl\(name\)/);
  assert.doesNotMatch(helper,/vmqqkebojldjsyxcewdb|LOVABLE_FUNCTIONS_URL|LOVABLE_FUNCTIONS_ANON_KEY/);
  const app=read("src/pages/Applications.tsx");
  assert.match(app,/invokeEdgeFunction<string>/);
});

test("payments webhook requires provider HMAC, replay window and server-only atomic settlement", () => {
  const webhook=edge("yoco-webhook");
  const code=read("supabase/functions/yoco-webhook/index.ts");
  const verifier=read("supabase/functions/_shared/yoco-webhook-security.mjs");
  const migration=read("supabase/migrations/20261114212000_sec01_sec02_yoco_payment_guards.sql");
  assert.equal(webhook.verify_jwt,false,
    "Yoco does not provide a Supabase JWT; only the signed provider callback can enter");
  assert.match(code,/verifyYocoWebhook/);
  assert.match(code,/YOCO_WEBHOOK_SECRET/);
  assert.ok(code.indexOf("verifyYocoWebhook")<code.indexOf('service.rpc("rk_yoco_apply_verified_event"'),
    "HMAC authenticity must precede all financial writes");
  assert.match(verifier,/crypto\.subtle\.sign/);
  assert.match(verifier,/Math\.abs\(timestamp-nowSeconds\)>180/);
  assert.match(verifier,/id\+"\."\+stamp\+"\."\+rawBody/);
  assert.match(migration,/on conflict \(event_id\) do nothing/);
  assert.match(migration,/auth\.role\(\)<>'service_role'/);
});

test("public OG and VAPID functions are active, with intended public access", () => {
  assert.equal(edge("og-image").verify_jwt,false);
  assert.equal(edge("vapid-public-key").verify_jwt,false);
});
