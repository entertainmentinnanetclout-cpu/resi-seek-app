insert into public.conversion_automation_tasks(task_type,source_type,source_id,user_id,residence_id,owner_scope,status,priority,due_at,summary,payload)
select 'application_follow_up','application',a.id,a.user_id,a.residence_id,case when a.residence_id is null then 'admin' else 'residence' end,'pending',case when lower(coalesce(a.status,''))='documents_required' then 'high' else 'normal' end,now()+case when lower(coalesce(a.status,''))='documents_required' then interval '6 hours' else interval '24 hours' end,case when lower(coalesce(a.status,''))='documents_required' then 'Student needs documents or application data completed' else 'Application requires conversion follow-up' end,jsonb_build_object('status',lower(coalesce(a.status,'')),'funding_type',a.funding_type,'backfilled',true)
from public.applications a where lower(coalesce(a.status,'')) not in ('approved','conditionally_approved','rejected','withdrawn','cancelled')
on conflict(source_type,source_id,task_type) do nothing;

insert into public.conversion_automation_tasks(task_type,source_type,source_id,user_id,residence_id,owner_scope,status,priority,due_at,summary,payload)
select 'reservation_follow_up','reservation',r.id,r.user_id,r.residence_id,'residence','pending','high',now()+interval '12 hours','2027 reservation requires follow-up',jsonb_build_object('status',lower(coalesce(r.status,'')),'funding_type',r.funding_type,'room_preference',r.room_preference,'backfilled',true)
from public.accommodation_reservations r where lower(coalesce(r.status,'')) not in ('confirmed','cancelled','placed')
on conflict(source_type,source_id,task_type) do nothing;

insert into public.conversion_automation_tasks(task_type,source_type,source_id,user_id,owner_scope,status,priority,due_at,summary,payload)
select 'creator_case_next_action','creator_assistance',c.id,c.student_user_id,'creator','pending',case when lower(coalesce(c.status,''))='documents_pending' then 'high' else 'normal' end,now()+case when lower(coalesce(c.status,''))='documents_pending' then interval '12 hours' else interval '24 hours' end,'Creator application assistance case needs next action',jsonb_build_object('status',lower(coalesce(c.status,'')),'creator_id',c.creator_id,'backfilled',true)
from public.creator_assistance_cases c where lower(coalesce(c.status,'')) not in ('completed','cancelled','revoked')
on conflict(source_type,source_id,task_type) do nothing;

insert into public.conversion_automation_tasks(task_type,source_type,source_id,residence_id,owner_scope,status,priority,due_at,summary,payload)
select 'listing_quality','residence',r.id,r.id,'admin','pending',case when coalesce(r.data_quality_score,0)<50 then 'high' else 'normal' end,now()+interval '48 hours','Residence listing needs data-quality completion',jsonb_build_object('quality_score',coalesce(r.data_quality_score,0),'missing',coalesce(to_jsonb(r.data_quality_missing),'[]'::jsonb),'backfilled',true)
from public.residences r where coalesce(r.data_quality_score,0)<90 and coalesce(r.is_visible,true)
on conflict(source_type,source_id,task_type) do nothing;
