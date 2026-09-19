-- Aggregate, owner-only analytics for verified, still-approved partner profiles.
create or replace function public.rk_partner_verified_analytics(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare p public.rk_partner_profiles;v_partner uuid;v_clicks bigint:=0;v_cases bigint:=0;v_submitted bigint:=0;v_placements bigint:=0;
begin
 select * into p from public.rk_partner_profiles where id=p_profile_id and user_id=auth.uid();
 if not found or p.status<>'published' or p.bio_review<>'verified' or p.bio_verified_until is null or p.bio_verified_until<=now() then raise exception 'Current verified bio-link status is required for enhanced analytics' using errcode='42501';end if;
 if p.kind='application' then
  select id into v_partner from public.creator_partners where user_id=auth.uid() and status='active' and partner_kind='application';
  if v_partner is null then raise exception 'Application partner is not active' using errcode='42501';end if;
  select count(*) into v_cases from public.creator_assistance_cases where creator_id=v_partner;
  select count(*) into v_submitted from public.assistance_submissions s join public.creator_assistance_cases c on c.id=s.case_id where c.creator_id=v_partner and s.submitted_at is not null;
  select count(*) into v_clicks from public.creator_referral_events where creator_id=v_partner and event_type in ('visit','click','profile_view','landing_visit');
 else
  if not exists(select 1 from public.referral_agents where user_id=auth.uid() and status='approved') then raise exception 'Residence recruiter is not active' using errcode='42501';end if;
  select count(*) into v_clicks from public.referral_sessions where referral_agent_user_id=auth.uid();
  select count(*) into v_cases from public.application_referrals where referral_agent_user_id=auth.uid();
  select count(*) into v_submitted from public.application_referrals where referral_agent_user_id=auth.uid() and status in ('submitted','verified','approved','paid');
  select count(*) into v_placements from public.application_referrals where referral_agent_user_id=auth.uid() and status in ('approved','paid');
 end if;
 return jsonb_build_object('link_visits',v_clicks,'student_cases',v_cases,'applications_sent',v_submitted,'verified_placements',v_placements,'period','all_time','private_student_data_included',false);
end $$;
revoke all on function public.rk_partner_verified_analytics(uuid) from public,anon;
grant execute on function public.rk_partner_verified_analytics(uuid) to authenticated;
