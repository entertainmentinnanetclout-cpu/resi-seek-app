-- Phase 5/10: Residence Quality / Readiness Enforcement
-- Live score recalculates on every residence change. Premium promotion is blocked when critical data is missing.

alter table public.residences
  add column if not exists service_ready boolean not null default false,
  add column if not exists premium_eligible boolean not null default false,
  add column if not exists quality_block_reason text;

create or replace function public.adminos_apply_residence_quality_gate() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  score_value integer := 0;
  missing text[] := '{}';
  has_image boolean;
  has_price boolean;
  has_location boolean;
  has_availability boolean;
  has_link boolean;
  has_audience boolean;
  has_room boolean;
  critical_missing boolean;
begin
  has_image := (coalesce(nullif(new.cover_image_url,''),nullif(new.image_url,'')) is not null or coalesce(array_length(new.images,1),0)>0);
  has_price := (coalesce(new.price,0)>0 or coalesce(new.private_price,0)>0 or coalesce(new.nsfas_price,0)>0);
  has_location := coalesce(nullif(new.city,''),nullif(new.campus,''),nullif(new.address,'')) is not null;
  has_availability := new.available_spots is not null;
  has_link := nullif(new.slug,'') is not null;
  has_audience := coalesce(new.accepts_university,false) or coalesce(new.accepts_tvet,false) or coalesce(new.accepts_private,false);
  has_room := nullif(new.room_type,'') is not null or coalesce(array_length(new.room_types,1),0)>0;

  if has_image then score_value:=score_value+30; else missing:=array_append(missing,'images'); end if;
  if has_price then score_value:=score_value+20; else missing:=array_append(missing,'rent'); end if;
  if has_location then score_value:=score_value+15; else missing:=array_append(missing,'location'); end if;
  if has_availability then score_value:=score_value+10; else missing:=array_append(missing,'availability'); end if;
  if has_link then score_value:=score_value+10; else missing:=array_append(missing,'public_link'); end if;
  if has_audience then score_value:=score_value+10; else missing:=array_append(missing,'audience'); end if;
  if has_room then score_value:=score_value+5; else missing:=array_append(missing,'room_type'); end if;

  critical_missing := not(has_image and has_price and has_location and has_link);
  new.data_quality_score := score_value;
  new.data_quality_missing := missing;
  new.last_quality_check_at := now();
  new.service_ready := score_value>=70 and has_price and has_location and has_link;
  new.premium_eligible := score_value>=85 and not critical_missing;
  new.data_quality_status := case when score_value>=85 and not critical_missing then 'premium_ready' when score_value>=70 then 'service_ready' else 'needs_data' end;
  new.quality_block_reason := case when critical_missing then concat('Missing critical fields: ',array_to_string(array(select x from unnest(missing) x where x in ('images','rent','location','public_link')),', ')) else null end;

  -- Keep the listing visible, but do not allow a low-data residence to be newly promoted as Spotlight/Featured.
  if critical_missing or score_value<85 then
    if coalesce(new.is_spotlight,false) and (tg_op='INSERT' or coalesce(old.is_spotlight,false)=false) then new.is_spotlight:=false; end if;
    if coalesce(new.is_featured,false) and (tg_op='INSERT' or coalesce(old.is_featured,false)=false) then new.is_featured:=false; end if;
    if coalesce(new.featured,false) and (tg_op='INSERT' or coalesce(old.featured,false)=false) then new.featured:=false; end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_adminos_residence_quality_gate on public.residences;
create trigger trg_adminos_residence_quality_gate
before insert or update on public.residences
for each row execute function public.adminos_apply_residence_quality_gate();

-- Backfill quality metadata without touching existing feature flags.
update public.residences r set
  data_quality_score = v.readiness_score,
  data_quality_missing = v.missing_fields,
  last_quality_check_at = now(),
  service_ready = v.readiness_score>=70 and v.has_price and v.has_location and v.has_public_link,
  premium_eligible = v.readiness_score>=85 and v.has_image and v.has_price and v.has_location and v.has_public_link,
  data_quality_status = case when v.readiness_score>=85 and v.has_image and v.has_price and v.has_location and v.has_public_link then 'premium_ready' when v.readiness_score>=70 then 'service_ready' else 'needs_data' end,
  quality_block_reason = case when not(v.has_image and v.has_price and v.has_location and v.has_public_link) then concat('Missing critical fields: ',array_to_string(array(select x from unnest(v.missing_fields) x where x in ('images','rent','location','public_link')),', ')) else null end
from public.adminos_residence_readiness_v v where v.id=r.id;

create or replace view public.adminos_residence_quality_v with (security_invoker=true) as
select r.id,r.name,r.slug,r.campus,r.city,r.address,r.available_spots,r.price,r.private_price,r.nsfas_price,
  coalesce(r.cover_image_url,r.image_url,case when coalesce(array_length(r.images,1),0)>0 then r.images[1] end) as primary_image_url,
  r.data_quality_score,r.data_quality_status,r.data_quality_missing,r.service_ready,r.premium_eligible,r.quality_block_reason,
  r.is_visible,r.is_featured,r.featured,r.is_spotlight,r.updated_at
from public.residences r;
grant select on public.adminos_residence_quality_v to authenticated;