-- Dimpho R7/R8 production evaluation hardening.
-- Force live accommodation questions through the governed tool engine and align
-- the unauthenticated application-continuity fixture with its actual auth scope.

do $$
declare v_marker text := 'R7/R8 MANDATORY LIVE-TOOL RULES';
begin
  update public.dimpho_persona_versions v
  set compiled_prompt = case
      when coalesce(v.compiled_prompt,'') like '%'||v_marker||'%' then v.compiled_prompt
      else coalesce(v.compiled_prompt,v.system_prompt_template,'') || E'\n\nR7/R8 MANDATORY LIVE-TOOL RULES\n- When the user asks which residences are currently available, have space now, or requests live accommodation options, you MUST call find_residences before giving the final answer. Never replace an available live tool with a generic browse link or a statement that live data cannot be verified.\n- When an authenticated customer asks about an existing accommodation application or its status, call get_application_status before the final answer. When the conversation is unauthenticated, do not invent status and tell the customer to sign in to view protected application data.\n- A user merely pasting an OTP or password is a credential-safety event, not automatically a human-escalation event. Never repeat or store the credential. Tell the user to rotate/change the password and not share OTPs. Keep escalate=false unless there is also fraud, suspected compromise, a breach, a protected account change, or the user explicitly requests human support.\n- Tool calls required by these rules are mandatory first-pass actions. Use the returned tool result as operational truth and report tool failures accurately.'
    end
  where v.id = (select active_version_id from public.dimpho_personas where persona_key='dimpho' limit 1);

  update public.adminos_agent_prompt_versions p
  set system_prompt = case
      when coalesce(p.system_prompt,'') like '%'||v_marker||'%' then p.system_prompt
      else coalesce(p.system_prompt,'') || E'\n\nR7/R8 MANDATORY LIVE-TOOL RULES\n- Current/live residence availability requires find_residences before the final answer.\n- Authenticated application-status questions require get_application_status. Unauthenticated application-status questions must ask the customer to sign in instead of inventing status.\n- Mere OTP/password disclosure must not be stored or repeated and does not by itself require human escalation; escalate only for fraud, compromise, breach, protected account changes or an explicit human-support request.'
    end
  where p.agent_key='konnect_agent' and p.active=true;
end $$;

update public.dimpho_eval_cases c
set expected_tool = null,
    assertions = coalesce(c.assertions,'{}'::jsonb) || jsonb_build_object('must_contain_any',jsonb_build_array('sign in','My Applications')),
    metadata = coalesce(c.metadata,'{}'::jsonb) || jsonb_build_object('fixture_auth_scope','unauthenticated_public','auth_alignment','protected_status_requires_sign_in'),
    updated_at = now()
from public.dimpho_eval_suites s
where c.suite_id=s.id and s.suite_key='production_gate' and c.case_key='existing_application_context';

update public.dimpho_intelligence_settings
set release_state=coalesce(release_state,'{}'::jsonb)||jsonb_build_object('r7_eval_fixture','auth_aligned','r8_live_tool_guardrails','active'),updated_at=now()
where id=1;
