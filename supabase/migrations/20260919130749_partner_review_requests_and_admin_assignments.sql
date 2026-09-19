-- Non-privileged partners can request, not grant, a social-bio verification.
grant execute on function public.rk_partner_staff(text) to anon;
create or replace function public.rk_request_bio_review(p_profile_id uuid) returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare p public.rk_partner_profiles;
begin
 select * into p from public.rk_partner_profiles where id=p_profile_id and user_id=auth.uid() for update;
 if not found then raise exception 'Profile unavailable' using errcode='42501';end if;
 if p.tiktok_url is null or length(p.tiktok_url)=0 then raise exception 'Add your public TikTok profile URL first';end if;
 if p.bio_review='verified' and p.bio_verified_until>now() then raise exception 'Your link is already verified';end if;
 update public.rk_partner_profiles set bio_review='pending',bio_verified_until=null,updated_at=now() where id=p_profile_id;
 insert into public.rk_partner_decision_audit(actor,profile_id,action) values(auth.uid(),p_profile_id,'bio_review_requested');
end $$;
revoke all on function public.rk_request_bio_review(uuid) from public,anon;
grant execute on function public.rk_request_bio_review(uuid) to authenticated;

-- Admin can allocate a campus, institution or residence without forcing a partner to re-request it.
create or replace function public.rk_admin_assign_partner_scope(p_profile_id uuid,p_kind text,p_value text,p_state text default 'approved') returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare p public.rk_partner_profiles;v_id uuid;v_value text:=btrim(coalesce(p_value,''));
begin
 select * into p from public.rk_partner_profiles where id=p_profile_id;
 if not found or not public.rk_partner_staff(p.kind) then raise exception 'Assignment requires authorised staff and verified 2FA' using errcode='42501';end if;
 if p_state not in ('approved','paused','rejected') or p_kind not in ('institution','campus','residence') or (p.kind='application' and p_kind<>'institution') or (p.kind='residence' and p_kind='institution') then raise exception 'Invalid assignment';end if;
 if length(v_value) not between 2 and 160 then raise exception 'Select an institution, campus or residence';end if;
 if p_kind='residence' and not exists(select 1 from public.residences where id=v_value::uuid and is_visible is distinct from false) then raise exception 'Residence unavailable';end if;
 insert into public.rk_partner_scopes(profile_id,scope_kind,scope_value,state,approved_by,approved_at) values(p_profile_id,p_kind,v_value,p_state,case when p_state='approved' then auth.uid() end,case when p_state='approved' then now() end)
 on conflict(profile_id,scope_kind,scope_value) do update set state=excluded.state,approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=now() returning id into v_id;
 insert into public.rk_partner_decision_audit(actor,profile_id,action,detail) values(auth.uid(),p_profile_id,'admin_scope_assignment',jsonb_build_object('scope_id',v_id,'kind',p_kind,'value',v_value,'state',p_state));
 return v_id;
end $$;
revoke all on function public.rk_admin_assign_partner_scope(uuid,text,text,text) from public,anon;
grant execute on function public.rk_admin_assign_partner_scope(uuid,text,text,text) to authenticated;
