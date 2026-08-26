-- Keep the 2027 reservation admin-event trigger aligned with system_events.entity_id UUID typing.
create or replace function public.notify_accommodation_reservation_created() returns trigger
language plpgsql security definer set search_path='public' as $$
declare residence_name text; student_name text;
begin
  select name into residence_name from public.residences where id=new.residence_id;
  select coalesce(full_name,email,'Student') into student_name from public.profiles where id=new.user_id;

  insert into public.notifications(user_id,title,message,type,metadata,is_read,created_at)
  values(
    new.user_id,
    new.academic_year::text||' accommodation reservation received',
    'Your reservation interest for '||coalesce(residence_name,'this residence')||' has been recorded. ResKonnect will keep you updated on the next step.',
    'accommodation_reservation',
    jsonb_build_object('reservation_id',new.id,'residence_id',new.residence_id,'academic_year',new.academic_year,'status',new.status),
    false,
    now()
  );

  if new.academic_year=2027 then
    insert into public.admin_alerts(title,description,severity,resolved,created_at)
    values(
      'New 2027 accommodation reservation',
      coalesce(student_name,'A student')||' reserved interest for '||coalesce(residence_name,'a residence')||'. Funding: '||new.funding_type||'.',
      'info',false,now()
    );

    insert into public.system_events(type,actor_user_id,entity,entity_id,metadata,payload,created_at)
    values(
      'NEW_2027_RESERVATION',new.user_id,'accommodation_reservation',new.id,
      jsonb_build_object('residence_id',new.residence_id,'residence_name',residence_name,'funding_type',new.funding_type),
      jsonb_build_object('academic_year',new.academic_year,'status',new.status,'source',new.source),
      now()
    );
  end if;
  return new;
end $$;
