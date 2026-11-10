import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/20261110101000_fix_case_source_changed_reservation_source_type.sql",
  "utf8",
);

test("shared case trigger only reads NEW.source_type on residence leads", () => {
  assert.match(sql, /WHEN 'accommodation_reservations' THEN 'reservation'/);
  assert.match(sql, /WHEN 'applications' THEN 'application'/);
  assert.match(sql, /WHEN 'viewing_requests' THEN 'viewing'/);
  assert.match(sql, /WHEN 'residence_leads' THEN 'enquiry'/);
  assert.match(sql, /IF tg_table_name = 'residence_leads' THEN\s+IF NEW\.source_type NOT IN/);
  assert.doesNotMatch(sql, /kind\s*=\s*'enquiry'\s+and\s+new\.source_type/i);
  assert.match(sql, /PERFORM reskonnect_internal\.refresh_service_case\(kind, source_id\)/);
});

test("function retains narrow privileges and does not bypass reservation integrity", () => {
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path TO ''/);
  assert.doesNotMatch(sql, /DISABLE TRIGGER|DROP TRIGGER|DROP POLICY|ALTER TABLE public\.accommodation_reservations/i);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|UPDATE public\.accommodation_reservations/i);
});
