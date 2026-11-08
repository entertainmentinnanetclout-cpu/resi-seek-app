-- Phase 1–3 refinement: strict uploaded-photo paths, a single reviewed extras
-- projection, and operational events for public listing mutations.
drop policy if exists rk_media_admin_read on public.resmap_residence_media;
create policy rk_media_admin_read on public.resmap_residence_media
for select to authenticated using (public.has_role((select auth.uid()),'admin'::public.app_role));

create or replace function reskonnect_internal.validate_studio_paths()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare p jsonb; entry text; urls text[]:='{}'; prefix text;
begin
 if new.status<>'submitted' then return new;end if;
 p:=new.payload;
 if jsonb_typeof(p->'photos')<>'array' then
   raise exception 'Only real published bucket photos may be submitted';
 end if;
 prefix:='https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/residence-assets/'||new.residence_id::text||'/';
 for entry in select value->>'url' from jsonb_array_elements(p->'photos') loop
   if entry is null or left(entry,length(prefix))<>prefix
      or entry ~* '(\.\.|%2e|%2f|%5c|\?|#|\\)'
      or entry !~* '\.(jpg|jpeg|png|webp)$' then
     raise exception 'Photo path invalid or not owned by this residence';
   end if;
   if entry=any(urls) then raise exception 'Duplicate residence photos cannot be submitted';end if;
   urls:=array_append(urls,entry);
 end loop;
 return new;
end;
$function$;
revoke all on function reskonnect_internal.validate_studio_paths() from public,anon,authenticated;
drop trigger if exists rk_studio_media_safety on public.reskonnect_listing_studio_drafts;
create trigger rk_studio_media_safety
before insert or update of status,payload on public.reskonnect_listing_studio_drafts
for each row execute function reskonnect_internal.validate_studio_paths();

-- Publish optional advertised amenities as the actual residence features. Do
-- not imply third-party security/accreditation certifications.
create or replace function reskonnect_internal.publish_listing_extras()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare feature text; extras text[]:='{}'; video text;
begin
 if new.status<>'approved' or old.status='approved' then return new;end if;
 if coalesce((new.payload->>'has_wifi')::boolean,false) then extras:=array_append(extras,'WiFi');end if;
 if coalesce((new.payload->>'has_parking')::boolean,false) then extras:=array_append(extras,'Parking');end if;
 if coalesce((new.payload->>'utilities_included')::boolean,false) then extras:=array_append(extras,'Utilities included');end if;
 if jsonb_typeof(new.payload->'extras')='array' then
   for feature in select jsonb_array_elements_text(new.payload->'extras') loop
     if feature=any(array['Security','Study Room','Laundry','Gym','Garden','Bike Storage','Swimming Pool','Shared Kitchen'])
       and not feature=any(extras) then extras:=array_append(extras,feature);end if;
   end loop;
 end if;
 video:=nullif(trim(new.payload->>'video_url'),'');
 if video is not null and (length(video)>1000 or video !~* '^https://(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/')
   then video:=null; end if;
 update public.residences
  set amenities=to_jsonb(extras),
      virtual_tour_url=coalesce(video,virtual_tour_url),
      updated_at=now()
 where id=new.residence_id;
 return new;
end;
$function$;
revoke all on function reskonnect_internal.publish_listing_extras() from public,anon,authenticated;
drop trigger if exists rk_studio_publish_extras on public.reskonnect_listing_studio_drafts;
create trigger rk_studio_publish_extras after update of status on public.reskonnect_listing_studio_drafts
for each row when (new.status='approved')
execute function reskonnect_internal.publish_listing_extras();

create or replace function reskonnect_internal.track_public_residence_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(new.id,'residences',new.id,case when tg_op='INSERT' then 'created' else 'published_data_updated' end,
 auth.uid(),jsonb_build_object('is_visible',new.is_visible,'available_spots',new.available_spots,'pricing_year',new.pricing_year));
 return new;
end;
$function$;
revoke all on function reskonnect_internal.track_public_residence_event() from public,anon,authenticated;
drop trigger if exists rk_residence_publication_event on public.residences;
create trigger rk_residence_publication_event
after insert or update of is_visible,price,available_spots,cover_image_url,images,room_types,amenities,city,place_label
on public.residences for each row execute function reskonnect_internal.track_public_residence_event();
