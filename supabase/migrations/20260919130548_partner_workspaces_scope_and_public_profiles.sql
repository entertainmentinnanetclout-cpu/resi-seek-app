-- Separate public identity, partner assignment and privileged staff membership.
create table if not exists public.rk_partner_profiles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('application','residence')),
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
 display_name text not null check(length(btrim(display_name)) between 2 and 120),
 bio text not null default '' check(length(bio)<=2500),
 campus text not null default '' check(length(campus)<=150),
 tiktok_url text check(tiktok_url is null or (tiktok_url ~* '^https://(www\.)?tiktok\.com/@[a-z0-9._-]+/?$' and length(tiktok_url)<=250)),
 status text not null default 'pending' check(status in ('pending','published','paused','rejected')),
 bio_review text not null default 'unverified' check(bio_review in ('unverified','pending','verified','rejected')),
 bio_reviewed_at timestamptz, bio_verified_until timestamptz,
 reviewed_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,kind)
);
create table if not exists public.rk_partner_scopes (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.rk_partner_profiles(id) on delete cascade,
 scope_kind text not null check(scope_kind in ('institution','campus','residence')),
 scope_value text not null check(length(btrim(scope_value)) between 2 and 160),
 state text not null default 'requested' check(state in ('requested','approved','paused','rejected')),
 approved_by uuid references auth.users(id), approved_at timestamptz,
 updated_at timestamptz not null default now(),unique(profile_id,scope_kind,scope_value)
);
create table if not exists public.rk_partner_decision_audit (
 id uuid primary key default gen_random_uuid(), actor uuid not null references auth.users(id),
 profile_id uuid not null references public.rk_partner_profiles(id),
 action text not null, detail jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index if not exists rk_partner_scopes_approved_idx on public.rk_partner_scopes(profile_id,scope_kind,state);
create index if not exists rk_partner_profiles_public_idx on public.rk_partner_profiles(kind,status,bio_review);
alter table public.rk_partner_profiles enable row level security;
alter table public.rk_partner_scopes enable row level security;
alter table public.rk_partner_decision_audit enable row level security;
create or replace function public.rk_partner_staff(p_kind text) returns boolean language sql stable security definer set search_path='' set row_security=off as $$
 select auth.role()='service_role' or (auth.uid() is not null and coalesce(auth.jwt()->>'aal','aal1')='aal2' and (public.has_role(auth.uid(),'admin'::public.app_role) or public.has_admin_department_access(case when p_kind='application' then 'student_opportunities' else 'accommodation' end)));
$$;
revoke all on function public.rk_partner_staff(text) from public,anon;
grant execute on function public.rk_partner_staff(text) to authenticated,service_role;
create policy rk_partner_public_read on public.rk_partner_profiles for select to anon,authenticated using(status='published' or user_id=auth.uid() or public.rk_partner_staff(kind));
create policy rk_partner_scope_read on public.rk_partner_scopes for select to authenticated using(exists(select 1 from public.rk_partner_profiles p where p.id=profile_id and (p.user_id=auth.uid() or public.rk_partner_staff(p.kind))));
create policy rk_partner_public_scope_read on public.rk_partner_scopes for select to anon using(state='approved' and exists(select 1 from public.rk_partner_profiles p where p.id=profile_id and p.status='published'));
create policy rk_partner_audit_staff_read on public.rk_partner_decision_audit for select to authenticated using(exists(select 1 from public.rk_partner_profiles p where p.id=profile_id and public.rk_partner_staff(p.kind)));
revoke insert,update,delete on public.rk_partner_profiles,public.rk_partner_scopes,public.rk_partner_decision_audit from authenticated,anon;
grant select on public.rk_partner_profiles,public.rk_partner_scopes to anon,authenticated;
grant select on public.rk_partner_decision_audit to authenticated;

-- Students and partners submit profile details; only staff can publish or verify.
create or replace function public.rk_save_partner_profile(p_kind text,p_slug text,p_name text,p_bio text,p_campus text,p_tiktok_url text) returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_id uuid;v_slug text:=lower(btrim(coalesce(p_slug,'')));v_url text:=nullif(btrim(coalesce(p_tiktok_url,'')),'');
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501';end if;
 if p_kind not in ('application','residence') or v_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$' or length(btrim(coalesce(p_name,''))) not between 2 and 120 or length(coalesce(p_bio,''))>2500 or length(coalesce(p_campus,''))>150 then raise exception 'Invalid public profile';end if;
 if v_url is not null and (v_url !~* '^https://(www\.)?tiktok\.com/@[a-z0-9._-]+/?$' or length(v_url)>250) then raise exception 'Use your TikTok profile URL, not a video or redirect';end if;
 if p_kind='application' and not exists(select 1 from public.creator_partners where user_id=auth.uid() and partner_kind='application') then raise exception 'Apply as an application partner first';end if;
 if p_kind='residence' and not exists(select 1 from public.recruiter_applications where user_id=auth.uid()) then raise exception 'Apply as a residence recruiter first';end if;
 insert into public.rk_partner_profiles(user_id,kind,slug,display_name,bio,campus,tiktok_url) values(auth.uid(),p_kind,v_slug,btrim(p_name),coalesce(p_bio,''),coalesce(p_campus,''),v_url)
 on conflict(user_id,kind) do update set slug=excluded.slug,display_name=excluded.display_name,bio=excluded.bio,campus=excluded.campus,tiktok_url=excluded.tiktok_url,
 bio_review=case when rk_partner_profiles.tiktok_url is distinct from excluded.tiktok_url or rk_partner_profiles.slug is distinct from excluded.slug then 'unverified' else rk_partner_profiles.bio_review end,
 bio_verified_until=case when rk_partner_profiles.tiktok_url is distinct from excluded.tiktok_url or rk_partner_profiles.slug is distinct from excluded.slug then null else rk_partner_profiles.bio_verified_until end,updated_at=now()
 returning id into v_id;return v_id;
end $$;

create or replace function public.rk_request_partner_scope(p_profile_id uuid,p_kind text,p_value text) returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_profile public.rk_partner_profiles;v_id uuid;v_value text:=btrim(coalesce(p_value,''));
begin
 select * into v_profile from public.rk_partner_profiles where id=p_profile_id and user_id=auth.uid();
 if not found or p_kind not in ('institution','campus','residence') or (v_profile.kind='application' and p_kind<>'institution') or (v_profile.kind='residence' and p_kind='institution') then raise exception 'Scope request not permitted' using errcode='42501';end if;
 if length(v_value) not between 2 and 160 then raise exception 'Enter a valid institution, campus or residence';end if;
 if p_kind='residence' and not exists(select 1 from public.residences where id=v_value::uuid and is_visible is distinct from false) then raise exception 'Residence not found';end if;
 if (select count(*) from public.rk_partner_scopes where profile_id=p_profile_id)>=40 and not exists(select 1 from public.rk_partner_scopes where profile_id=p_profile_id and scope_kind=p_kind and scope_value=v_value) then raise exception 'Maximum 40 scope requests';end if;
 insert into public.rk_partner_scopes(profile_id,scope_kind,scope_value) values(p_profile_id,p_kind,v_value) on conflict(profile_id,scope_kind,scope_value) do update set state=case when rk_partner_scopes.state='approved' then 'approved' else 'requested' end,updated_at=now() returning id into v_id;return v_id;
end $$;

create or replace function public.rk_review_partner(p_profile_id uuid,p_status text,p_bio_review text,p_bio_expiry timestamptz default null) returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare v_profile public.rk_partner_profiles;v_approved boolean;
begin
 select * into v_profile from public.rk_partner_profiles where id=p_profile_id for update;
 if not found or not public.rk_partner_staff(v_profile.kind) then raise exception 'Partner approval denied' using errcode='42501';end if;
 if p_status not in ('pending','published','paused','rejected') or p_bio_review not in ('unverified','pending','verified','rejected') then raise exception 'Invalid review state';end if;
 v_approved:=case when v_profile.kind='application' then exists(select 1 from public.creator_partners where user_id=v_profile.user_id and status='active' and partner_kind='application') else exists(select 1 from public.referral_agents where user_id=v_profile.user_id and status='approved') end;
 if p_status='published' and not v_approved then raise exception 'Approve the underlying partner account before publishing';end if;
 if p_bio_review='verified' and (v_profile.tiktok_url is null or p_status<>'published' or p_bio_expiry is null or p_bio_expiry<=now() or p_bio_expiry>now()+interval '90 days') then raise exception 'A live TikTok bio link must be inspected and assigned a future expiry of at most 90 days';end if;
 update public.rk_partner_profiles set status=p_status,bio_review=p_bio_review,bio_reviewed_at=now(),bio_verified_until=case when p_bio_review='verified' then p_bio_expiry else null end,reviewed_by=auth.uid(),updated_at=now() where id=p_profile_id;
 insert into public.rk_partner_decision_audit(actor,profile_id,action,detail) values(auth.uid(),p_profile_id,'profile_review',jsonb_build_object('status',p_status,'bio_review',p_bio_review,'expires',p_bio_expiry));
end $$;
create or replace function public.rk_review_partner_scope(p_scope_id uuid,p_state text) returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare v_scope public.rk_partner_scopes;v_kind text;
begin
 select * into v_scope from public.rk_partner_scopes where id=p_scope_id for update;
 select kind into v_kind from public.rk_partner_profiles where id=v_scope.profile_id;
 if not found or not public.rk_partner_staff(v_kind) then raise exception 'Assignment approval denied' using errcode='42501';end if;
 if p_state not in ('requested','approved','paused','rejected') then raise exception 'Invalid scope state';end if;
 update public.rk_partner_scopes set state=p_state,approved_by=case when p_state='approved' then auth.uid() else null end,approved_at=case when p_state='approved' then now() else null end,updated_at=now() where id=p_scope_id;
 insert into public.rk_partner_decision_audit(actor,profile_id,action,detail) values(auth.uid(),v_scope.profile_id,'scope_review',jsonb_build_object('scope_id',p_scope_id,'scope',v_scope.scope_value,'state',p_state));
end $$;
revoke all on function public.rk_save_partner_profile(text,text,text,text,text,text),public.rk_request_partner_scope(uuid,text,text),public.rk_review_partner(uuid,text,text,timestamptz),public.rk_review_partner_scope(uuid,text) from public,anon;
grant execute on function public.rk_save_partner_profile(text,text,text,text,text,text),public.rk_request_partner_scope(uuid,text,text) to authenticated;
grant execute on function public.rk_review_partner(uuid,text,text,timestamptz),public.rk_review_partner_scope(uuid,text) to authenticated;

-- New campaigns require ResKonnect's explicit residence approval for an onboarded partner.
create or replace function public.recruiter_select_residence(p_residence_id uuid) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_code public.referral_codes;v_assignment uuid;v_link public.recruiter_residence_links%rowtype;v_res public.residences%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.referral_agents where user_id=auth.uid() and status='approved') then raise exception 'Approved recruiter access required' using errcode='42501';end if;
 if not exists(select 1 from public.residence_recruitment_programs where residence_id=p_residence_id and enabled=true) then raise exception 'Residence is not open for recruitment';end if;
 select * into v_res from public.residences where id=p_residence_id and is_visible is distinct from false;if not found then raise exception 'Residence unavailable';end if;
 if exists(select 1 from public.rk_partner_profiles where user_id=auth.uid() and kind='residence') and not exists(select 1 from public.rk_partner_profiles p join public.rk_partner_scopes s on s.profile_id=p.id where p.user_id=auth.uid() and p.kind='residence' and p.status='published' and s.scope_kind='residence' and s.scope_value=p_residence_id::text and s.state='approved') then raise exception 'Ask your Residence Admin to approve this residence for your recruiter profile';end if;
 select public.get_or_create_referral_code() into v_code;
 insert into public.recruiter_residence_assignments(recruiter_user_id,residence_id,status,updated_at) values(auth.uid(),p_residence_id,'active',now()) on conflict(recruiter_user_id,residence_id) do update set status='active',updated_at=now() returning id into v_assignment;
 insert into public.recruiter_residence_links(assignment_id,recruiter_user_id,residence_id,referral_code,is_active,updated_at) values(v_assignment,auth.uid(),p_residence_id,v_code.code,true,now()) on conflict(recruiter_user_id,residence_id) do update set assignment_id=excluded.assignment_id,referral_code=excluded.referral_code,is_active=true,updated_at=now() returning * into v_link;
 return jsonb_build_object('linkKey',v_link.link_key,'code',v_link.referral_code,'residenceId',v_res.id,'residenceName',v_res.name,'slug',coalesce(v_res.slug,v_res.id::text));
end $$;
