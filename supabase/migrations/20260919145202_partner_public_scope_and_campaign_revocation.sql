-- Publicly approved scopes are visible to students whether or not they are signed in.
create policy rk_partner_approved_scope_authenticated_read
on public.rk_partner_scopes for select to authenticated
using (state='approved' and exists (
 select 1 from public.rk_partner_profiles p where p.id=profile_id and p.status='published'
));

-- When staff withdraw residence approval, previously minted campaign links must also stop working.
create or replace function public.rk_disable_recruiter_link_on_scope_revocation()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 if old.scope_kind='residence' and old.state='approved' and new.state<>'approved' then
  select p.user_id into v_user from public.rk_partner_profiles p where p.id=old.profile_id and p.kind='residence';
  if v_user is not null then
   update public.recruiter_residence_links set is_active=false,updated_at=now()
   where recruiter_user_id=v_user and residence_id=old.scope_value::uuid;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.rk_disable_recruiter_link_on_scope_revocation() from public,anon,authenticated;
drop trigger if exists trg_rk_disable_recruiter_link_on_scope_revocation on public.rk_partner_scopes;
create trigger trg_rk_disable_recruiter_link_on_scope_revocation
 after update of state on public.rk_partner_scopes
 for each row execute function public.rk_disable_recruiter_link_on_scope_revocation();

create or replace function public.rk_disable_recruiter_links_on_profile_pause()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.kind='residence' and old.status='published' and new.status<>'published' then
  update public.recruiter_residence_links set is_active=false,updated_at=now()
  where recruiter_user_id=old.user_id;
 end if;
 return new;
end $$;
revoke all on function public.rk_disable_recruiter_links_on_profile_pause() from public,anon,authenticated;
drop trigger if exists trg_rk_disable_recruiter_links_on_profile_pause on public.rk_partner_profiles;
create trigger trg_rk_disable_recruiter_links_on_profile_pause
 after update of status on public.rk_partner_profiles
 for each row execute function public.rk_disable_recruiter_links_on_profile_pause();

-- New recruiters must obtain explicit account, profile AND residence approval before creating campaigns.
-- Existing active campaign links created before this programme remain refreshable for legacy recruiters.
create or replace function public.recruiter_select_residence(p_residence_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_code public.referral_codes;v_assignment uuid;v_link public.recruiter_residence_links%rowtype;v_res public.residences%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.referral_agents where user_id=auth.uid() and status='approved') then
  raise exception 'Approved recruiter access required' using errcode='42501';
 end if;
 if not exists(select 1 from public.residence_recruitment_programs where residence_id=p_residence_id and enabled=true) then
  raise exception 'Residence is not open for recruitment';
 end if;
 select * into v_res from public.residences where id=p_residence_id and is_visible is distinct from false;
 if not found then raise exception 'Residence unavailable';end if;
 if not exists (
  select 1 from public.rk_partner_profiles p
  join public.rk_partner_scopes s on s.profile_id=p.id
  where p.user_id=auth.uid() and p.kind='residence' and p.status='published'
    and s.scope_kind='residence' and s.scope_value=p_residence_id::text and s.state='approved'
 ) and not exists (
  select 1 from public.recruiter_residence_links l
  where l.recruiter_user_id=auth.uid() and l.residence_id=p_residence_id
    and l.is_active=true and l.created_at<'2026-09-19 13:00:00+00'::timestamptz
    and not exists(select 1 from public.rk_partner_profiles p where p.user_id=auth.uid() and p.kind='residence')
 ) then
  raise exception 'A Residence Admin must approve this residence before you can activate its campaign' using errcode='42501';
 end if;
 select public.get_or_create_referral_code() into v_code;
 insert into public.recruiter_residence_assignments(recruiter_user_id,residence_id,status,updated_at)
 values(auth.uid(),p_residence_id,'active',now())
 on conflict(recruiter_user_id,residence_id) do update set status='active',updated_at=now() returning id into v_assignment;
 insert into public.recruiter_residence_links(assignment_id,recruiter_user_id,residence_id,referral_code,is_active,updated_at)
 values(v_assignment,auth.uid(),p_residence_id,v_code.code,true,now())
 on conflict(recruiter_user_id,residence_id) do update set assignment_id=excluded.assignment_id,referral_code=excluded.referral_code,is_active=true,updated_at=now() returning * into v_link;
 return jsonb_build_object('linkKey',v_link.link_key,'code',v_link.referral_code,'residenceId',v_res.id,'residenceName',v_res.name,'slug',coalesce(v_res.slug,v_res.id::text));
end $$;
revoke all on function public.recruiter_select_residence(uuid) from public,anon;
grant execute on function public.recruiter_select_residence(uuid) to authenticated;
