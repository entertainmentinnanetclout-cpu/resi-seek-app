-- Release 5 API hardening.
-- Browser clients no longer execute elevated aggregate functions directly.
-- A public Edge Function exposes a fixed aggregate contract; all privileged SQL remains service-role only.

revoke execute on function public.housing_intel_supply_live() from anon,authenticated;
revoke execute on function public.housing_intel_demand_heat(integer) from anon,authenticated;
revoke execute on function public.housing_intel_institution_snapshot(integer) from anon,authenticated;
revoke execute on function public.housing_intel_opportunities(integer) from anon,authenticated;
revoke execute on function public.housing_intel_property_partner(uuid,integer) from anon,authenticated;

grant execute on function public.housing_intel_supply_live() to service_role;
grant execute on function public.housing_intel_demand_heat(integer) to service_role;
grant execute on function public.housing_intel_institution_snapshot(integer) to service_role;
grant execute on function public.housing_intel_opportunities(integer) to service_role;
grant execute on function public.housing_intel_property_partner(uuid,integer) to service_role;

create or replace function public.housing_intel_property_partner_service(
  p_residence_id uuid,
  p_user_id uuid,
  p_days integer default 90
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  r public.residences%rowtype;
  allowed boolean:=false;
  apps bigint:=0; reservations bigint:=0; leads bigint:=0; placed bigint:=0; views bigint:=0; saves bigint:=0;
  campus_apps numeric:=0; campus_reservations numeric:=0; campus_price numeric:=0; campus_residences bigint:=0;
  safe_days integer:=greatest(1,least(coalesce(p_days,90),730));
begin
  if p_user_id is null then raise exception 'Authentication required'; end if;

  select exists(
    select 1 from public.residence_portal_accounts a
    where a.user_id=p_user_id and a.residence_id=p_residence_id and a.is_active=true
  ) or exists(
    select 1 from public.user_roles ur
    where ur.user_id=p_user_id and ur.role::text in ('admin','super_admin','developer','owner')
  ) into allowed;
  if not allowed then raise exception 'Not authorized for this residence'; end if;

  select * into r from public.residences where id=p_residence_id;
  if not found then raise exception 'Residence not found'; end if;

  select count(*) into apps from public.applications
  where residence_id=p_residence_id and created_at>=now()-make_interval(days=>safe_days);

  select count(*) into reservations from public.accommodation_reservations
  where residence_id=p_residence_id and status<>'cancelled' and created_at>=now()-make_interval(days=>safe_days);

  select count(*),count(*) filter(where stage='placed') into leads,placed
  from public.residence_leads
  where residence_id=p_residence_id and created_at>=now()-make_interval(days=>safe_days);

  select count(*) filter(where event_type='view'),count(*) filter(where event_type='save') into views,saves
  from public.resmap_feed_events
  where residence_id=p_residence_id and created_at>=now()-make_interval(days=>safe_days);

  select count(*),avg(coalesce(nullif(private_price,0),nullif(price,0))) filter(where coalesce(nullif(private_price,0),nullif(price,0)) is not null)
  into campus_residences,campus_price
  from public.residences x
  where coalesce(x.is_visible,true)=true
    and public.housing_intel_campus_key(x.campus)=public.housing_intel_campus_key(r.campus);

  select avg(v) into campus_apps from (
    select count(*)::numeric v
    from public.applications a join public.residences x on x.id=a.residence_id
    where public.housing_intel_campus_key(x.campus)=public.housing_intel_campus_key(r.campus)
      and a.created_at>=now()-make_interval(days=>safe_days)
    group by x.id
  ) q;

  select avg(v) into campus_reservations from (
    select count(*)::numeric v
    from public.accommodation_reservations ar join public.residences x on x.id=ar.residence_id
    where public.housing_intel_campus_key(x.campus)=public.housing_intel_campus_key(r.campus)
      and ar.status<>'cancelled'
      and ar.created_at>=now()-make_interval(days=>safe_days)
    group by x.id
  ) q;

  return jsonb_build_object(
    'residence',jsonb_build_object(
      'id',r.id,'name',r.name,'campus',r.campus,'capacity',r.capacity,'available_spots',r.available_spots,
      'price',coalesce(nullif(r.private_price,0),nullif(r.price,0)),'nsfas_price',nullif(r.nsfas_price,0),
      'quality_score',r.data_quality_score,'location_quality_score',r.location_quality_score
    ),
    'period_days',safe_days,
    'performance',jsonb_build_object(
      'applications',apps,'reservations',reservations,'leads',leads,'placements',placed,'views',views,'saves',saves,
      'lead_to_placement_rate',case when leads>0 then round(100.0*placed/leads,1) else 0 end
    ),
    'benchmark',jsonb_build_object(
      'campus_residences',campus_residences,
      'average_applications_per_residence',round(coalesce(campus_apps,0),1),
      'average_reservations_per_residence',round(coalesce(campus_reservations,0),1),
      'average_private_price',round(coalesce(campus_price,0),0)
    ),
    'market_position',jsonb_build_object(
      'application_index',case when coalesce(campus_apps,0)>0 then round(100*apps/campus_apps,0) else null end,
      'reservation_index',case when coalesce(campus_reservations,0)>0 then round(100*reservations/campus_reservations,0) else null end,
      'price_delta',case when campus_price is not null and coalesce(nullif(r.private_price,0),nullif(r.price,0)) is not null
        then round(coalesce(nullif(r.private_price,0),nullif(r.price,0))-campus_price,0) else null end
    )
  );
end $$;

revoke all on function public.housing_intel_property_partner_service(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.housing_intel_property_partner_service(uuid,uuid,integer) to service_role;

comment on function public.housing_intel_property_partner_service(uuid,uuid,integer)
is 'Release 5 Phase 22 service-bound property partner benchmark. Caller identity must be independently verified before p_user_id is supplied.';