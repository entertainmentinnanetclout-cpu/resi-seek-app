-- Golden Service Cycle: bounded bulk INTERNAL coordination for a solo operator.
-- No external send, human-contact assertion, document verification or business decision is possible here.
-- The existing single-case function remains the only event writer; the batch runs atomically.
create or replace function public.rk_golden_bulk_triage(
  p_items jsonb, p_action text, p_note text default null, p_due_at timestamptz default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $fn$
declare
  v_item jsonb;
  v_kind text;
  v_id uuid;
  v_key text;
  v_keys text[] := array[]::text[];
  v_expected_status text;
  v_expected_step text;
  v_live_status text;
  v_live_step text;
  v_closed_at timestamptz;
  v_count integer := 0;
begin
  if not reskonnect_internal.rk_godmode_authorized() then
    raise exception 'God Mode with verified MFA required' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'A case selection array is required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and 20 or length(p_items::text) > 12000 then
    raise exception 'Select between 1 and 20 cases per batch' using errcode = '22023';
  end if;
  if p_action is null or p_action not in ('begin_review', 'set_followup', 'private_note') then
    raise exception 'Only non-decision internal coordination is allowed in bulk' using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 1500 then
    raise exception 'Service note too long' using errcode = '22023';
  end if;
  if p_action = 'private_note' and length(btrim(coalesce(p_note, ''))) < 8 then
    raise exception 'Provide a factual private note of at least eight characters' using errcode = '22023';
  end if;
  if p_action = 'set_followup' and
     (p_due_at is null or p_due_at < now() + interval '5 minutes'
      or p_due_at > now() + interval '90 days') then
    raise exception 'Choose a follow-up between five minutes and ninety days' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
      or not (v_item ? 'kind' and v_item ? 'id' and v_item ? 'status' and v_item ? 'step')
      or (v_item - 'kind' - 'id' - 'status' - 'step') <> '{}'::jsonb
      or jsonb_typeof(v_item->'kind') <> 'string'
      or jsonb_typeof(v_item->'id') <> 'string'
      or jsonb_typeof(v_item->'step') <> 'string' then
      raise exception 'Invalid case selection payload' using errcode = '22023';
    end if;

    v_kind := v_item->>'kind';
    v_id := (v_item->>'id')::uuid;
    v_expected_status := v_item->>'status';
    v_expected_step := v_item->>'step';
    v_key := v_kind || ':' || v_id::text;
    if v_key = any(v_keys) then
      raise exception 'Duplicate service case in batch' using errcode = '22023';
    end if;
    v_keys := array_append(v_keys, v_key);

    select source_status, step, closed_at
      into v_live_status, v_live_step, v_closed_at
      from public.rk_golden_service_cases
      where kind = v_kind and source_id = v_id
      for update;
    if not found then
      raise exception 'Service case missing: refresh the queue' using errcode = '40001';
    end if;
    if v_closed_at is not null or v_live_status is distinct from v_expected_status
       or v_live_step is distinct from v_expected_step then
      raise exception 'One or more cases changed: refresh and select again' using errcode = '40001';
    end if;

    -- SECURITY DEFINER existing action revalidates God Mode AAL2, writes a per-case audit event
    -- and never changes source business status. Any failure rolls back this entire transaction.
    perform public.rk_golden_service_action(
      v_kind, v_id, p_action, nullif(btrim(coalesce(p_note,'')),''), p_due_at,
      null, false, v_expected_status
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true, 'processed', v_count, 'action', p_action,
    'messages_sent', false, 'business_status_changed', false
  );
end
$fn$;

revoke all on function public.rk_golden_bulk_triage(jsonb,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.rk_golden_bulk_triage(jsonb,text,text,timestamptz)
  to authenticated;
comment on function public.rk_golden_bulk_triage(jsonb,text,text,timestamptz)
  is 'MFA-only bounded atomic batch of internal service coordination; never sends external messages or changes legal decisions.';
