-- A draft owner may never forge reviewed/submission timestamps. Prices
-- prioritize room types with available beds; all-sold-out listings keep their
-- documented price without inventing a new offer.
create or replace function public.reskonnect_listing_guard()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare isadmin boolean; failures text[];
begin
 isadmin:=public.has_role(auth.uid(),'admin'::public.app_role);
 if tg_op='INSERT' then
   if not isadmin and (new.reviewer_note is not null or new.reviewed_by is not null
      or new.reviewed_at is not null or new.submitted_at is not null) then
     raise exception 'Review information is reserved for administrators';
   end if;
   new.created_at:=now();
   new.revision:=1;
 end if;
 if tg_op='UPDATE' and not isadmin then
   if new.residence_id is distinct from old.residence_id or
      new.owner_id is distinct from old.owner_id or
      new.reviewer_note is distinct from old.reviewer_note or
      new.reviewed_by is distinct from old.reviewed_by or
      new.reviewed_at is distinct from old.reviewed_at or
      new.submitted_at is distinct from old.submitted_at or
      new.created_at is distinct from old.created_at then
     raise exception 'Residence owners cannot modify review decisions or ownership';
   end if;
 end if;
 if not isadmin and new.status not in ('draft','submitted')
    then raise exception 'Only an administrator may approve or request changes'; end if;
 if new.status='submitted' and (tg_op='INSERT' or old.status is distinct from 'submitted') then
   failures:=public.reskonnect_listing_submit_errors(new.payload,new.residence_id);
   if array_length(failures,1)>0 then raise exception 'Listing needs corrections: %',array_to_string(failures,'; '); end if;
   new.submitted_at:=now();
 end if;
 new.updated_at:=now();
 if tg_op='UPDATE' then new.revision:=old.revision+1; end if;
 return new;
end;
$function$;

create or replace view public.reskonnect_discovery_inventory_v
with(security_invoker=true) as
select r.id as residence_id,r.name,r.city,r.place_label,r.campus,
       r.price as listing_price,r.available_spots as reported_available_spots,
       coalesce(rt.room_type_count,0) as room_type_count,
       case when rt.room_type_count>0 then rt.available_beds else r.available_spots end as visible_available_beds,
       case when rt.room_type_count>0 then rt.min_private_price else r.private_price end as visible_private_price,
       case when rt.room_type_count>0 then 'room_type_reported' else 'listing_reported' end as availability_source,
       r.is_visible
from public.residences r left join lateral (
 select count(*) as room_type_count,sum(available_beds)::int available_beds,
        coalesce(
          min(private_price) filter(where available_beds>0 and private_price>0),
          min(private_price) filter(where private_price>0)
        ) min_private_price
 from public.residence_room_types t
 where t.residence_id=r.id and t.academic_year=coalesce(r.pricing_year,2027) and t.is_active
) rt on true where r.is_visible=true;
grant select on public.reskonnect_discovery_inventory_v to anon,authenticated;
create index if not exists rk_room_prices_by_active_year on public.residence_room_types(residence_id,academic_year)
where is_active=true;
