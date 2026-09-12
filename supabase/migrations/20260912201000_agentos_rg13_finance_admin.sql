-- AgentOS RG13 — Finance & Administration Automation
-- Reconciles financial operations and costs while keeping bank transfers,
-- payout execution, refunds and banking configuration founder/executive-controlled.

create table if not exists public.adminos_finance_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  attributed_value_30d numeric not null default 0,
  platform_fee_30d numeric not null default 0,
  paid_payment_value_30d numeric not null default 0,
  pending_payments integer not null default 0,
  pending_payment_value numeric not null default 0,
  pending_eft integer not null default 0,
  high_risk_eft integer not null default 0,
  pending_seller_payouts integer not null default 0,
  pending_seller_payout_value numeric not null default 0,
  seller_liability numeric not null default 0,
  referral_liability numeric not null default 0,
  ai_cost_usd_24h numeric not null default 0,
  ai_cost_usd_7d numeric not null default 0,
  ai_cost_usd_30d numeric not null default 0,
  ai_tokens_30d bigint not null default 0,
  open_anomalies integer not null default 0,
  high_anomalies integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

alter table public.adminos_finance_snapshots enable row level security;
drop policy if exists finance_snapshots_department_read on public.adminos_finance_snapshots;
create policy finance_snapshots_department_read on public.adminos_finance_snapshots
for select to authenticated using (
  public.has_admin_department_access('finance_admin')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
revoke insert,update,delete on public.adminos_finance_snapshots from authenticated,anon;
grant select on public.adminos_finance_snapshots to authenticated;

create table if not exists public.adminos_finance_anomalies (
  id uuid primary key default gen_random_uuid(),
  anomaly_key text not null unique,
  anomaly_type text not null,
  severity text not null default 'medium' check(severity in ('low','medium','high','critical')),
  status text not null default 'open' check(status in ('open','monitoring','resolved','dismissed')),
  amount_zar numeric,
  amount_usd numeric,
  entity_type text,
  entity_id uuid,
  requires_executive_approval boolean not null default false,
  evidence jsonb not null default '{}'::jsonb,
  recommended_action text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_finance_anomalies_open on public.adminos_finance_anomalies(status,severity,last_seen_at desc);

alter table public.adminos_finance_anomalies enable row level security;
drop policy if exists finance_anomalies_department_read on public.adminos_finance_anomalies;
create policy finance_anomalies_department_read on public.adminos_finance_anomalies
for select to authenticated using (
  public.has_admin_department_access('finance_admin')
  or public.has_admin_department_access('executive')
  or public.has_admin_department_access('intelligence_analytics')
);
revoke insert,update,delete on public.adminos_finance_anomalies from authenticated,anon;
grant select on public.adminos_finance_anomalies to authenticated;

alter table public.seller_payouts add column if not exists approval_id uuid references public.adminos_approval_requests(id) on delete set null;

create or replace function public.adminos_rg13_upsert_anomaly(
  p_key text,p_type text,p_severity text,p_amount_zar numeric,p_amount_usd numeric,p_entity_type text,p_entity_id uuid,
  p_requires_approval boolean,p_evidence jsonb,p_action text
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.adminos_finance_anomalies(
    anomaly_key,anomaly_type,severity,status,amount_zar,amount_usd,entity_type,entity_id,requires_executive_approval,
    evidence,recommended_action,first_seen_at,last_seen_at,resolved_at
  ) values(
    p_key,p_type,p_severity,'open',p_amount_zar,p_amount_usd,p_entity_type,p_entity_id,p_requires_approval,
    coalesce(p_evidence,'{}'::jsonb),p_action,now(),now(),null
  )
  on conflict(anomaly_key) do update set
    anomaly_type=excluded.anomaly_type,severity=excluded.severity,status='open',amount_zar=excluded.amount_zar,amount_usd=excluded.amount_usd,
    entity_type=excluded.entity_type,entity_id=excluded.entity_id,requires_executive_approval=excluded.requires_executive_approval,
    evidence=excluded.evidence,recommended_action=excluded.recommended_action,last_seen_at=now(),resolved_at=null;
end;
$$;

create or replace function public.adminos_rg13_payout_approval_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare approval uuid;
begin
  if coalesce(new.status,'pending')='pending'
     and (new.approval_id is null or (tg_op='UPDATE' and (new.amount,new.store_id,new.seller_id) is distinct from (old.amount,old.store_id,old.seller_id))) then
    insert into public.adminos_approval_requests(
      request_type,title,summary,entity_type,entity_id,requested_action,risk_level,status,requested_by_type,expires_at
    ) values(
      'seller_payout',
      'Seller payout requires Executive approval',
      concat('Approve payout record for R',to_char(new.amount,'FM999999990.00'),'. Approval does not execute a bank transfer.'),
      'seller_payout',new.id,
      jsonb_build_object('action','approve_payout_record','payout_id',new.id,'store_id',new.store_id,'seller_id',new.seller_id,'amount_zar',new.amount),
      'amber','pending','system',now()+interval '7 days'
    ) returning id into approval;
    new.approval_id:=approval;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_rg13_seller_payout_approval on public.seller_payouts;
create trigger trg_rg13_seller_payout_approval before insert or update on public.seller_payouts
for each row execute function public.adminos_rg13_payout_approval_trigger();

create or replace function public.adminos_rg13_payout_status_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare approval_status text;
begin
  if tg_op='UPDATE' and new.status is distinct from old.status
     and lower(coalesce(new.status,'')) in ('approved','processing','paid','completed') then
    select status into approval_status from public.adminos_approval_requests where id=new.approval_id;
    if approval_status is distinct from 'approved' then
      raise exception 'Executive approval is required before payout status can advance' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_rg13_seller_payout_status_guard on public.seller_payouts;
create trigger trg_rg13_seller_payout_status_guard before update on public.seller_payouts
for each row execute function public.adminos_rg13_payout_status_guard();

create or replace function public.adminos_rg13_decide_payout_approval(p_approval_id uuid,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare req public.adminos_approval_requests%rowtype;payout_id uuid;
begin
  if auth.uid() is null or not public.has_admin_department_access('executive') then
    raise exception 'Executive approval required' using errcode='42501';
  end if;
  select * into req from public.adminos_approval_requests where id=p_approval_id for update;
  if req.id is null or req.request_type<>'seller_payout' then raise exception 'Seller payout approval not found'; end if;
  if req.status<>'pending' then raise exception 'Approval already decided'; end if;
  payout_id:=req.entity_id;
  update public.adminos_approval_requests set status=case when p_approve then 'approved' else 'rejected' end,
    decided_by=auth.uid(),decided_at=now(),decision_note=p_note,updated_at=now() where id=req.id;
  insert into public.adminos_approval_actions(approval_id,actor_id,action,note,snapshot)
  values(req.id,auth.uid(),case when p_approve then 'approved' else 'rejected' end,p_note,req.requested_action);
  if p_approve then
    update public.seller_payouts set status='approved' where id=payout_id and status='pending';
  else
    update public.seller_payouts set status='rejected' where id=payout_id and status='pending';
  end if;
  return jsonb_build_object('approval_id',req.id,'payout_id',payout_id,'status',case when p_approve then 'approved' else 'rejected' end,'bank_transfer_executed',false);
end;
$$;
revoke all on function public.adminos_rg13_decide_payout_approval(uuid,boolean,text) from public,anon;
grant execute on function public.adminos_rg13_decide_payout_approval(uuid,boolean,text) to authenticated;

create or replace function public.adminos_rg13_refresh_anomalies()
returns integer language plpgsql security definer set search_path=public as $$
declare active_keys text[]:='{}'::text[];k text;n integer:=0;
declare v_count integer;v_value numeric;v_cost24 numeric;v_prev7 numeric;v_daily numeric;v_mismatch integer;
begin
  select count(*)::integer,coalesce(sum(coalesce(amount,0)),0)
  into v_count,v_value from public.payments
  where coalesce(payment_status,status,'pending') in ('pending','processing') and created_at<now()-interval '24 hours';
  if v_count>0 then
    k:='rg13:stale-payments';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg13_upsert_anomaly(k,'stale_payments',case when v_count>=10 then 'high' else 'medium' end,v_value,null,'payments',null,false,
      jsonb_build_object('count',v_count,'value_zar',v_value),'Review stale payment records and reconcile with the payment provider before changing order/payment state.');
  end if;

  select count(*)::integer,coalesce(sum(expected_amount),0)
  into v_count,v_value from public.eft_payments
  where coalesce(status,'pending') not in ('approved','verified','paid','rejected','cancelled') and coalesce(risk_score,0)>=70;
  if v_count>0 then
    k:='rg13:high-risk-eft';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg13_upsert_anomaly(k,'high_risk_eft','critical',v_value,null,'eft_payments',null,true,
      jsonb_build_object('count',v_count,'value_zar',v_value),'Hold automated progression and perform human payment-proof/risk review.');
  end if;

  select count(*)::integer,coalesce(sum(expected_amount),0)
  into v_count,v_value from public.eft_payments
  where coalesce(status,'pending')='pending' and expires_at<now();
  if v_count>0 then
    k:='rg13:expired-eft';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg13_upsert_anomaly(k,'expired_eft','high',v_value,null,'eft_payments',null,false,
      jsonb_build_object('count',v_count,'value_zar',v_value),'Review and close or reissue expired EFT instructions; do not mark paid without verified evidence.');
  end if;

  select count(*)::integer,coalesce(sum(amount),0)
  into v_count,v_value from public.seller_payouts
  where coalesce(status,'pending')='pending' and coalesce(created_at,now())<now()-interval '48 hours';
  if v_count>0 then
    k:='rg13:payouts-awaiting-decision';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg13_upsert_anomaly(k,'seller_payouts_pending',case when v_value>=5000 then 'high' else 'medium' end,v_value,null,'seller_payouts',null,true,
      jsonb_build_object('count',v_count,'value_zar',v_value),'Executive must approve or reject payout records. Approval never executes a bank transfer.');
  end if;

  select coalesce(sum(estimated_cost_usd),0) into v_cost24 from public.adminos_agent_usage where created_at>=now()-interval '24 hours';
  select coalesce(sum(estimated_cost_usd),0) into v_prev7 from public.adminos_agent_usage where created_at>=now()-interval '8 days' and created_at<now()-interval '24 hours';
  v_daily:=v_prev7/7.0;
  if v_cost24>=1 and v_cost24>greatest(1,v_daily*3) then
    k:='rg13:ai-cost-spike';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg13_upsert_anomaly(k,'ai_cost_spike','high',null,v_cost24,'adminos_agent_usage',null,false,
      jsonb_build_object('cost_usd_24h',v_cost24,'prior_7d_daily_avg_usd',v_daily),'Inspect agent/model usage for retry loops or unnecessary high-cost calls; do not disable critical service blindly.');
  end if;

  select count(*)::integer into v_mismatch
  from public.seller_earnings se join public.platform_revenue pr on pr.order_id=se.order_id
  where abs(coalesce(se.platform_fee,0)-coalesce(pr.platform_fee,0))>0.01;
  if v_mismatch>0 then
    k:='rg13:fee-reconciliation-mismatch';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg13_upsert_anomaly(k,'fee_reconciliation_mismatch','high',null,null,'seller_earnings',null,false,
      jsonb_build_object('mismatch_count',v_mismatch),'Reconcile seller earning and platform-revenue fee records before payout processing.');
  end if;

  update public.adminos_finance_anomalies
  set status='resolved',resolved_at=now(),last_seen_at=now()
  where status in ('open','monitoring') and anomaly_key like 'rg13:%' and not(anomaly_key=any(active_keys));

  select count(*)::integer into n from public.adminos_finance_anomalies where status='open' and anomaly_key like 'rg13:%';
  return n;
end;
$$;

create or replace function public.adminos_rg13_reconcile_tasks()
returns integer language plpgsql security definer set search_path=public as $$
declare rec record;k text;current_count integer:=0;
begin
  update public.staff_tasks set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('automation_resolved_at',now())
  where department_key='finance_admin' and status in ('open','in_progress','waiting')
    and metadata->>'automation_family'='rg13'
    and (metadata->>'automation_key' is null or not exists(
      select 1 from public.adminos_finance_anomalies a where a.status='open'
      and concat('rg13:task:',a.anomaly_key)=staff_tasks.metadata->>'automation_key'));

  for rec in select * from public.adminos_finance_anomalies where status='open' order by
    case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,last_seen_at desc
  loop
    k:=concat('rg13:task:',rec.anomaly_key);
    if not exists(select 1 from public.staff_tasks where metadata->>'automation_key'=k and status in ('open','in_progress','waiting')) then
      insert into public.staff_tasks(title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key)
      values(concat('Finance: ',replace(rec.anomaly_type,'_',' ')),
        concat(rec.severity,' financial control signal',case when rec.amount_zar is not null then concat(' · R',round(rec.amount_zar,2)) else '' end),
        'adminos_finance_anomalies',rec.id,
        case when rec.severity='critical' then 'urgent' when rec.severity='high' then 'high' else 'normal' end,
        'open',now()+case when rec.severity='critical' then interval '4 hours' when rec.severity='high' then interval '24 hours' else interval '48 hours' end,
        rec.recommended_action,array['rg13','finance',rec.anomaly_type],
        jsonb_build_object('automation_family','rg13','automation_key',k,'requires_executive_approval',rec.requires_executive_approval,'evidence',rec.evidence),
        'finance_admin');
    else
      update public.staff_tasks set description=concat(rec.severity,' financial control signal'),next_action=rec.recommended_action,
        metadata=metadata||jsonb_build_object('evidence',rec.evidence,'last_refresh_at',now()),updated_at=now()
      where metadata->>'automation_key'=k and status in ('open','in_progress','waiting');
    end if;
  end loop;
  select count(*)::integer into current_count from public.staff_tasks where department_key='finance_admin'
    and status in ('open','in_progress','waiting') and metadata->>'automation_family'='rg13';
  return current_count;
end;
$$;

create or replace function public.adminos_rg13_finance_cycle()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  anomalies integer:=0;tasks integer:=0;v_attributed numeric:=0;v_platform numeric:=0;v_paid numeric:=0;
  v_pending integer:=0;v_pending_value numeric:=0;v_eft integer:=0;v_risk integer:=0;v_payouts integer:=0;v_payout_value numeric:=0;
  v_seller numeric:=0;v_referral numeric:=0;v_ai24 numeric:=0;v_ai7 numeric:=0;v_ai30 numeric:=0;v_tokens bigint:=0;v_high integer:=0;
begin
  anomalies:=public.adminos_rg13_refresh_anomalies();
  tasks:=public.adminos_rg13_reconcile_tasks();

  select coalesce(sum(value_zar),0) into v_attributed from public.adminos_campaign_attributions where attributed_at>=now()-interval '30 days';
  select coalesce(sum(platform_fee),0) into v_platform from public.platform_revenue where created_at>=now()-interval '30 days';
  select coalesce(sum(amount),0) into v_paid from public.payments where coalesce(payment_status,status) in ('paid','completed','success') and coalesce(paid_at,created_at)>=now()-interval '30 days';
  select count(*)::integer,coalesce(sum(coalesce(amount,0)),0) into v_pending,v_pending_value from public.payments where coalesce(payment_status,status,'pending') in ('pending','processing');
  select count(*)::integer into v_eft from public.eft_payments where coalesce(status,'pending')='pending';
  select count(*)::integer into v_risk from public.eft_payments where coalesce(status,'pending') not in ('approved','verified','paid','rejected','cancelled') and coalesce(risk_score,0)>=70;
  select count(*)::integer,coalesce(sum(amount),0) into v_payouts,v_payout_value from public.seller_payouts where coalesce(status,'pending')='pending';
  select coalesce(sum(net_amount),0) into v_seller from public.seller_earnings where coalesce(status,'available')='available';
  select coalesce(sum(amount),0) into v_referral from public.referral_earnings where coalesce(status,'available')='available';
  select coalesce(sum(estimated_cost_usd),0),coalesce(sum(coalesce(input_tokens,0)+coalesce(output_tokens,0)),0)::bigint into v_ai30,v_tokens from public.adminos_agent_usage where created_at>=now()-interval '30 days';
  select coalesce(sum(estimated_cost_usd),0) into v_ai7 from public.adminos_agent_usage where created_at>=now()-interval '7 days';
  select coalesce(sum(estimated_cost_usd),0) into v_ai24 from public.adminos_agent_usage where created_at>=now()-interval '24 hours';
  select count(*)::integer into v_high from public.adminos_finance_anomalies where status='open' and severity in ('high','critical');

  insert into public.adminos_finance_snapshots(
    snapshot_date,attributed_value_30d,platform_fee_30d,paid_payment_value_30d,pending_payments,pending_payment_value,
    pending_eft,high_risk_eft,pending_seller_payouts,pending_seller_payout_value,seller_liability,referral_liability,
    ai_cost_usd_24h,ai_cost_usd_7d,ai_cost_usd_30d,ai_tokens_30d,open_anomalies,high_anomalies,metadata,generated_at
  ) values(current_date,v_attributed,v_platform,v_paid,v_pending,v_pending_value,v_eft,v_risk,v_payouts,v_payout_value,v_seller,v_referral,
    v_ai24,v_ai7,v_ai30,v_tokens,anomalies,v_high,jsonb_build_object('department_tasks',tasks,'bank_transfer_automation',false),now())
  on conflict(snapshot_date) do update set
    attributed_value_30d=excluded.attributed_value_30d,platform_fee_30d=excluded.platform_fee_30d,paid_payment_value_30d=excluded.paid_payment_value_30d,
    pending_payments=excluded.pending_payments,pending_payment_value=excluded.pending_payment_value,pending_eft=excluded.pending_eft,high_risk_eft=excluded.high_risk_eft,
    pending_seller_payouts=excluded.pending_seller_payouts,pending_seller_payout_value=excluded.pending_seller_payout_value,
    seller_liability=excluded.seller_liability,referral_liability=excluded.referral_liability,ai_cost_usd_24h=excluded.ai_cost_usd_24h,
    ai_cost_usd_7d=excluded.ai_cost_usd_7d,ai_cost_usd_30d=excluded.ai_cost_usd_30d,ai_tokens_30d=excluded.ai_tokens_30d,
    open_anomalies=excluded.open_anomalies,high_anomalies=excluded.high_anomalies,metadata=excluded.metadata,generated_at=now();

  return jsonb_build_object('open_anomalies',anomalies,'high_anomalies',v_high,'department_tasks',tasks,'ai_cost_usd_30d',v_ai30,
    'pending_payments',v_pending,'pending_seller_payouts',v_payouts,'pending_payout_value_zar',v_payout_value,'run_at',now());
end;
$$;

revoke all on function public.adminos_rg13_finance_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg13_finance_cycle() to service_role;

create or replace function public.adminos_run_rg13_now()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null or not (
    public.has_admin_department_access('finance_admin') or public.has_admin_department_access('executive')
  ) then raise exception 'Finance or Executive access required' using errcode='42501'; end if;
  return public.adminos_rg13_finance_cycle();
end;
$$;
revoke all on function public.adminos_run_rg13_now() from public,anon;
grant execute on function public.adminos_run_rg13_now() to authenticated;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('finance_admin_agent','Finance & Administration Agent',true,'green',0.99,
  jsonb_build_object('release_gate',13,'cost_monitoring',true,'payment_reconciliation',true,'payout_approval_creation',true,
    'bank_transfers',false,'payout_execution',false,'refund_execution',false,'banking_changes',false,
    'financial_commitments','executive_only','seller_payout_record_approval','executive_only'))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=true,authority_level='green',
  confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

do $$ declare j record; begin
  for j in select jobid from cron.job where jobname='adminos-rg13-finance-admin' loop perform cron.unschedule(j.jobid); end loop;
  perform cron.schedule('adminos-rg13-finance-admin','*/30 * * * *',$job$select public.adminos_rg13_finance_cycle();$job$);
end $$;

select public.adminos_rg13_finance_cycle();
