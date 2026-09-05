create or replace function public.adminos_decide_approval(p_approval_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v public.adminos_approval_requests%rowtype;
  v_action text;
begin
  if not public.adminos_is_staff() then raise exception 'staff access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'decision must be approved or rejected'; end if;

  select * into v from public.adminos_approval_requests where id=p_approval_id for update;
  if not found then raise exception 'approval not found'; end if;
  if v.status <> 'pending' then raise exception 'approval is already %', v.status; end if;

  update public.adminos_approval_requests
  set status=p_decision, decided_by=auth.uid(), decided_at=now(), decision_note=p_note, updated_at=now()
  where id=p_approval_id;

  v_action := case when p_decision='approved' then 'approved' else 'rejected' end;
  insert into public.adminos_approval_actions(approval_id,actor_id,action,note,snapshot)
  values(p_approval_id,auth.uid(),v_action,p_note,jsonb_build_object('request_type',v.request_type,'requested_action',v.requested_action));

  if v.request_type='email_reply' then
    if p_decision='approved' then
      update public.adminos_email_outbox set status='draft',updated_at=now() where approval_id=p_approval_id and status='awaiting_approval';
    else
      update public.adminos_email_outbox set status='blocked',updated_at=now(),last_error='Human approval rejected' where approval_id=p_approval_id and status='awaiting_approval';
    end if;
  end if;

  insert into public.adminos_audit_events(actor_type,actor_id,action,entity_type,entity_id,after_state,metadata)
  values('staff',auth.uid(),'approval.'||p_decision,'approval',p_approval_id,jsonb_build_object('status',p_decision),jsonb_build_object('note',p_note));

  return jsonb_build_object('id',p_approval_id,'status',p_decision);
end;
$$;

revoke all on function public.adminos_decide_approval(uuid,text,text) from public;
grant execute on function public.adminos_decide_approval(uuid,text,text) to authenticated;
