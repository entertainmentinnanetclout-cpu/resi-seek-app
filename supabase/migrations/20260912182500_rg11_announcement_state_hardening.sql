-- RG11 governance state hardening.
-- Sensitive announcements must always be pending/approved/rejected, never "not_required".

create or replace function public.adminos_rg11_site_announcement_guard()
returns trigger
language plpgsql security definer set search_path=public as $$
declare
  new_risk text;
  content_changed boolean:=true;
begin
  new_risk:=public.adminos_rg11_statement_risk(concat_ws(' ',new.title,new.subtitle,new.body,new.badge));

  if tg_op='UPDATE' then
    content_changed:=(new.title,new.subtitle,new.body,new.badge,new.cta_label,new.cta_url)
      is distinct from (old.title,old.subtitle,old.body,old.badge,old.cta_label,old.cta_url);
  end if;

  new.risk_level:=new_risk;
  new.requires_executive_approval:=(new_risk in ('amber','red'));

  if new_risk='green' then
    new.approval_status:='not_required';
    new.approved_by:=null;
    new.approved_at:=null;
  elsif tg_op='INSERT' or content_changed then
    new.approval_status:='pending';
    new.approved_by:=null;
    new.approved_at:=null;
    new.is_active:=false;
  elsif new.approval_status='not_required' then
    new.approval_status:='pending';
    new.approved_by:=null;
    new.approved_at:=null;
    new.is_active:=false;
  elsif new.approval_status<>'approved' then
    new.is_active:=false;
  end if;

  return new;
end;
$$;

update public.site_announcements
set approval_status='pending',approved_by=null,approved_at=null,is_active=false,updated_at=now()
where requires_executive_approval=true and approval_status='not_required';
