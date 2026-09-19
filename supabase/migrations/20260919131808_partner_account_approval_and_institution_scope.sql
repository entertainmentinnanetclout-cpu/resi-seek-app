-- Authenticated staff may review partner accounts only within their assigned department.
create table if not exists public.rk_partner_account_audit(id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),target_user_id uuid not null references auth.users(id),kind text not null check(kind in ('application','residence')),old_status text,new_status text not null,created_at timestamptz not null default now());
alter table public.rk_partner_account_audit enable row level security;
create policy rk_partner_account_audit_read on public.rk_partner_account_audit for select to authenticated using(public.rk_partner_staff(kind));
revoke all on public.rk_partner_account_audit from anon,authenticated;
grant select on public.rk_partner_account_audit to authenticated;

-- AAL2 student-opportunities staff may change only application-partner approval status.
create or replace function public.rk_guard_partner_profile() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.role()='service_role' or public.can_manage_growth() then return new; end if;
 if tg_op='INSERT' then
  if new.user_id is distinct from auth.uid() or new.status<>'pending' or new.tier<>'creator_partner' or new.payout_per_placement<>0 or new.payout_per_verified_reservation<>0 then raise exception 'Partners require ResKonnect approval' using errcode='42501'; end if;
 elsif new.user_id is distinct from old.user_id or new.tier is distinct from old.tier or new.payout_per_placement is distinct from old.payout_per_placement or new.payout_per_verified_reservation is distinct from old.payout_per_verified_reservation then
  raise exception 'Only ResKonnect may change partner ownership or commission terms' using errcode='42501';
 elsif new.status is distinct from old.status and not (new.partner_kind='application' and old.partner_kind='application' and public.rk_partner_staff('application')) then
  raise exception 'Application partner approval requires an Applications Admin with 2FA' using errcode='42501';
 end if;
 return new;
end $$;

create or replace function public.rk_admin_review_partner_account(p_kind text,p_user_id uuid,p_status text) returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare v_old text;
begin
 if p_user_id is null or p_status not in ('approved','rejected','paused','pending') or p_kind not in ('application','residence') or not public.rk_partner_staff(p_kind) then raise exception 'Department approval and verified 2FA required' using errcode='42501';end if;
 if p_user_id=auth.uid() then raise exception 'You cannot approve your own account' using errcode='42501';end if;
 if p_kind='application' then
   select status into v_old from public.creator_partners where user_id=p_user_id and partner_kind='application' for update;
   if not found then raise exception 'Application partner registration not found';end if;
   update public.creator_partners set status=case when p_status='approved' then 'active' else p_status end,updated_at=now() where user_id=p_user_id and partner_kind='application';
 else
   select status into v_old from public.recruiter_applications where user_id=p_user_id for update;
   if not found then raise exception 'Residence recruiter registration not found';end if;
   update public.recruiter_applications set status=p_status,decided_by=auth.uid(),decided_at=now(),updated_at=now() where user_id=p_user_id;
   if p_status='approved' then
     insert into public.referral_agents(user_id,status,approved_at,approved_by,program_key) values(p_user_id,'approved',now(),auth.uid(),'student_recruitment') on conflict(user_id) do update set status='approved',approved_at=now(),approved_by=auth.uid(),updated_at=now();
   else
     update public.referral_agents set status=case when p_status='pending' then 'pending' else p_status end,updated_at=now() where user_id=p_user_id;
   end if;
 end if;
 if p_status<>'approved' then
   update public.rk_partner_profiles set status='paused',bio_review='unverified',bio_verified_until=null,updated_at=now() where user_id=p_user_id and kind=p_kind;
   if p_kind='residence' then update public.recruiter_residence_links set is_active=false,updated_at=now() where recruiter_user_id=p_user_id;end if;
 end if;
 insert into public.rk_partner_account_audit(actor,target_user_id,kind,old_status,new_status) values(auth.uid(),p_user_id,p_kind,v_old,p_status);
end $$;
revoke all on function public.rk_admin_review_partner_account(text,uuid,text) from public,anon;
grant execute on function public.rk_admin_review_partner_account(text,uuid,text) to authenticated;

-- A newly onboarded application partner cannot record an institution submission
-- outside their explicitly approved institutions. Legacy partners remain operational.
create or replace function public.rk_guard_assistance_institution_scope() returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
declare v_user uuid;v_profile uuid;
begin
 if auth.role()='service_role' or public.rk_partner_staff('application') then return new;end if;
 select cp.user_id into v_user from public.creator_assistance_cases c join public.creator_partners cp on cp.id=c.creator_id where c.id=new.case_id;
 if v_user is null then raise exception 'Assistance case unavailable' using errcode='42501';end if;
 select p.id into v_profile from public.rk_partner_profiles p where p.user_id=v_user and p.kind='application';
 if v_profile is not null and (auth.uid()=v_user or exists(select 1 from public.creator_assistance_cases c where c.id=new.case_id and c.student_user_id=auth.uid())) then
   if not exists(select 1 from public.rk_partner_profiles p join public.rk_partner_scopes s on s.profile_id=p.id where p.id=v_profile and p.status='published' and s.scope_kind='institution' and s.state='approved' and lower(btrim(s.scope_value))=lower(btrim(new.institution))) then raise exception 'This partner is not approved to submit applications for the selected institution' using errcode='42501';end if;
 end if;
 return new;
end $$;
drop trigger if exists trg_rk_guard_assistance_institution_scope on public.assistance_submissions;
create trigger trg_rk_guard_assistance_institution_scope before insert or update of institution,case_id on public.assistance_submissions for each row execute function public.rk_guard_assistance_institution_scope();
revoke all on function public.rk_guard_assistance_institution_scope() from public,anon,authenticated;
