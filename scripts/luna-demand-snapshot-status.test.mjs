import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync("supabase/functions/luna-orchestrator/index.ts","utf8");

test("Luna demand snapshot status matches production DB check constraint",()=>{
  // Direct production DB introspection: adminos_demand_snapshots_status_check
  // permits only completed, partial and failed. 24/24 failed demand cycles
  // had SQLSTATE 23514 from inserting status='succeeded'.
  const block=src.match(/service\.from\("adminos_demand_snapshots"\)\.insert\(\{[\s\S]{0,2200}?\}\)\.select\(/)?.[0];
  assert.ok(block,"Expected demand snapshot insert");
  assert.match(block,/status:"completed"/);
  assert.doesNotMatch(block,/status:"succeeded"/);
  assert.match(src,/service\.from\("adminos_agent_runs"\)\.update\(\{status:"succeeded"/);
});
