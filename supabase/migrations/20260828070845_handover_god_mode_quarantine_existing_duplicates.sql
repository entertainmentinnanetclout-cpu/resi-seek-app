with candidates as (
  select a.*,
    row_number() over(partition by a.user_id,a.residence_id order by
      case lower(coalesce(a.status,'')) when 'approved' then 70 when 'conditionally_approved' then 60 when 'under_review' then 50 when 'documents_required' then 40 when 'submitted' then 30 when 'pending' then 20 when 'rejected' then 10 when 'withdrawn' then 0 else 5 end desc,
      (a.funding_type is not null) desc,coalesce(a.updated_at,a.created_at) desc,a.id) as rn,
    first_value(a.id) over(partition by a.user_id,a.residence_id order by
      case lower(coalesce(a.status,'')) when 'approved' then 70 when 'conditionally_approved' then 60 when 'under_review' then 50 when 'documents_required' then 40 when 'submitted' then 30 when 'pending' then 20 when 'rejected' then 10 when 'withdrawn' then 0 else 5 end desc,
      (a.funding_type is not null) desc,coalesce(a.updated_at,a.created_at) desc,a.id) as canonical_id
  from public.applications a
  where a.user_id is not null and a.residence_id is not null
)
insert into public.handover_application_exclusions(application_id,canonical_application_id,reason,metadata)
select id,canonical_id,'duplicate_same_user_residence',jsonb_build_object('auto_repaired',true,'policy_version','GOD-MODE-3.0','migration','existing_duplicate_quarantine')
from candidates where rn>1
on conflict(application_id) do nothing;
