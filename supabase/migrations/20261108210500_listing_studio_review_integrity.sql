-- ResKonnect: validate real Storage objects and consistent reviewed publication.
alter table public.residence_room_types
  add column if not exists studio_managed boolean not null default false;

create index if not exists rk_listing_draft_owner_idx on public.reskonnect_listing_studio_drafts(owner_id);
create index if not exists rk_listing_draft_reviewer_idx on public.reskonnect_listing_studio_drafts(reviewed_by) where reviewed_by is not null;
create index if not exists rk_service_events_actor_idx on public.reskonnect_service_events(actor_user_id) where actor_user_id is not null;

create or replace function reskonnect_internal.validate_studio_paths()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare entry text; seen_urls text[]:='{}'; prefix text; object_name text; deposit_value text;
begin
 if new.status not in ('submitted','approved') then return new; end if;
 if jsonb_typeof(new.payload->'photos')<>'array' then
   raise exception 'Property photographs are required for submission';
 end if;
 prefix:='https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/residence-assets/'||new.residence_id::text||'/';
 for entry in select value->>'url' from jsonb_array_elements(new.payload->'photos') loop
   if entry is null or left(entry,length(prefix))<>prefix
      or entry ~* '(\.\.|%2e|%2f|%5c|\?|#|\\)' or entry !~* '\.(jpg|jpeg|png|webp)$' then
     raise exception 'Photo URL is not a valid residence-owned upload';
   end if;
   object_name:=new.residence_id::text||'/'||substring(entry from length(prefix)+1);
   if not exists(select 1 from storage.objects where bucket_id='residence-assets' and name=object_name) then
     raise exception 'Listing photo is missing from this residence image folder';
   end if;
   if entry=any(seen_urls) then raise exception 'Duplicate residence photos are not allowed'; end if;
   seen_urls:=array_append(seen_urls,entry);
 end loop;
 for deposit_value in select value->>'deposit' from jsonb_array_elements(new.payload->'rooms') loop
   if coalesce(deposit_value,'0') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' then
     raise exception 'Room deposits must be valid non-negative amounts';
   end if;
 end loop;
 return new;
end;
$function$;

-- Re-review must clear stale platform price verifications, remove superseded
-- studio-controlled room types and photos, and recompute bed totals correctly.

create or replace function public.reskonnect_review_listing(
 p_residence_id uuid,p_approve boolean,p_note text default null
) returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare d public.reskonnect_listing_studio_drafts%rowtype; p jsonb; rr jsonb; photo jsonb;
  count_rooms int:=0; count_beds int:=0; minimum_price numeric:=null;
  current_year int; normalized_name text; price numeric; cap int; available int;
  photo_urls text[]:='{}'; label text; entry text;
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then
   raise exception 'Admin review permission required' using errcode='42501';
 end if;
 select * into d from public.reskonnect_listing_studio_drafts where residence_id=p_residence_id for update;
 if not found or d.status<>'submitted' then
   raise exception 'This listing is not awaiting admin review';
 end if;
 if not p_approve then
   update public.reskonnect_listing_studio_drafts
      set status='changes_requested',reviewer_note=left(coalesce(p_note,'Please review your details.'),1500),
      reviewed_at=now(),reviewed_by=auth.uid()
    where residence_id=p_residence_id;
   return jsonb_build_object('status','changes_requested','residence_id',p_residence_id);
 end if;
 p:=d.payload;
 if array_length(public.reskonnect_listing_submit_errors(p,p_residence_id),1)>0 then
   raise exception 'Listing no longer passes publication checks';
 end if;
 current_year:=(p->>'academic_year')::int;
 -- Retire only previously studio-managed room categories no longer advertised.
 update public.residence_room_types set is_active=false,updated_at=now()
 where residence_id=p_residence_id and academic_year=current_year and studio_managed
   and lower(trim(name)) not in (select lower(trim(value->>'name')) from jsonb_array_elements(p->'rooms'));
 for rr in select value from jsonb_array_elements(p->'rooms') loop
   count_rooms:=count_rooms+1;
   cap:=(rr->>'capacity')::int;available:=(rr->>'available_beds')::int;
   price:=(rr->>'private_price')::numeric;
   count_beds:=count_beds+cap;
   minimum_price:=least(coalesce(minimum_price,price),price);
   normalized_name:=trim(rr->>'name');
   update public.residence_room_types set capacity=cap,available_beds=least(available,cap),
      private_price=price,deposit=coalesce(nullif(rr->>'deposit','')::numeric,0),
      studio_managed=true,price_verified_at=null,price_verified_by=null,
      academic_year=current_year,landlord_confirmed_at=now(),landlord_confirmed_by=d.owner_id,
      is_active=true,updated_at=now()
    where residence_id=p_residence_id and academic_year=current_year and lower(name)=lower(normalized_name);
   if not found then
     insert into public.residence_room_types(residence_id,name,academic_year,capacity,available_beds,private_price,deposit,landlord_confirmed_at,landlord_confirmed_by,studio_managed)
     values(p_residence_id,normalized_name,current_year,cap,available,price,coalesce(nullif(rr->>'deposit','')::numeric,0),now(),d.owner_id,true);
   end if;
 end loop;
 update public.resmap_residence_media set is_primary=false where residence_id=p_residence_id and is_primary;
 -- Keep manually reviewed gallery entries but hide removed studio-managed photos.
 update public.resmap_residence_media set is_published=false,is_primary=false
 where residence_id=p_residence_id and metadata->>'source'='reskonnect_listing_studio'
   and url not in (select value->>'url' from jsonb_array_elements(p->'photos'));
 for photo in select value from jsonb_array_elements(p->'photos') loop
   entry:=photo->>'url';
   photo_urls:=array_append(photo_urls,entry);
   label:=left(coalesce(photo->>'room_tag','Residence'),80);
   insert into public.resmap_residence_media(residence_id,media_type,title,url,is_primary,is_published,sort_order,metadata)
   values(p_residence_id,'photo',label,entry,array_length(photo_urls,1)=1,true,array_length(photo_urls,1),
       jsonb_build_object('source','reskonnect_listing_studio','room_tag',label))
   on conflict(residence_id,url) do update set
     title=excluded.title,sort_order=excluded.sort_order,
     is_primary=excluded.is_primary,is_published=true,metadata=excluded.metadata;
 end loop;
 update public.residences set
   name=left(trim(p->>'name'),160),
   city=left(trim(p->>'city'),120),
   place_label=left(trim(p->>'place_label'),160),
   province=left(coalesce(p->>'province',''),100),
   description=left(trim(p->>'description'),5000),
   campus=left(coalesce(p->>'campus',''),160),
   lease_period=left(p->>'lease_period',100),
   is_furnished=coalesce((p->>'is_furnished')::boolean,false),
   has_wifi=coalesce((p->>'has_wifi')::boolean,false),
   has_parking=coalesce((p->>'has_parking')::boolean,false),
   utilities_included=coalesce((p->>'utilities_included')::boolean,false),
   capacity=(select coalesce(sum(capacity),0) from public.residence_room_types where residence_id=p_residence_id and academic_year=current_year and is_active=true),
   available_spots=(select coalesce(sum(available_beds),0) from public.residence_room_types where residence_id=p_residence_id and academic_year=current_year and is_active=true),
   private_price=minimum_price,price=minimum_price,
   price_verified_at=null,price_verified_by=null,
   deposit_amount=coalesce((p->'rooms'->0->>'deposit')::numeric,0),
   pricing_year=current_year,
   cover_image_url=photo_urls[1],image_url=photo_urls[1],images=photo_urls,
   room_type=p->'rooms'->0->>'name',
   room_types=array(select name from public.residence_room_types where residence_id=p_residence_id and academic_year=current_year and is_active=true order by name),
   updated_at=now()
 where id=p_residence_id;
 if not found then raise exception 'Residence no longer exists';end if;
 update public.reskonnect_listing_studio_drafts set status='approved',reviewer_note=left(coalesce(p_note,'Approved for publishing'),1500),
    reviewed_at=now(),reviewed_by=auth.uid() where residence_id=p_residence_id;
 return jsonb_build_object('status','approved','residence_id',p_residence_id,'room_types',count_rooms,'beds',count_beds,'photos',array_length(photo_urls,1));
end;
$function$;
