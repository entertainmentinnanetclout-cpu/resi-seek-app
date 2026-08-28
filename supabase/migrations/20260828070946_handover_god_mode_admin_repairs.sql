create or replace function public.handover_get_record(_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare r jsonb;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;
  select to_jsonb(v) into r from public.residence_handover_export_v v where v.application_id=_application_id;
  if r is null then raise exception 'Application not found'; end if;
  return r;
end;
$$;
revoke all on function public.handover_get_record(uuid) from public;
grant execute on function public.handover_get_record(uuid) to authenticated;

create or replace function public.handover_bulk_set_funding(_application_ids uuid[], _funding_type text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare f text; app_id uuid; changed int:=0;
begin
  if not public.can_manage_handover_export() then raise exception 'Handover export access required' using errcode='42501'; end if;
  f:=case lower(btrim(coalesce(_funding_type,'')))
    when 'self funded' then 'private'
    when 'self-funded' then 'private'
    when 'cash' then 'private'
    when 'nsfas funded' then 'nsfas'
    when 'nsfas-funded' then 'nsfas'
    else lower(btrim(coalesce(_funding_type,''))) end;
  if f not in ('nsfas','private','bursary','scholarship','employer','family','other','undecided') then raise exception 'Unsupported funding type'; end if;
  foreach app_id in array coalesce(_application_ids,array[]::uuid[]) loop
    perform public.handover_update_record(app_id,jsonb_build_object('funding_type',f));
    changed:=changed+1;
  end loop;
  return jsonb_build_object('updated',changed,'funding_type',f);
end;
$$;
revoke all on function public.handover_bulk_set_funding(uuid[],text) from public;
grant execute on function public.handover_bulk_set_funding(uuid[],text) to authenticated;
