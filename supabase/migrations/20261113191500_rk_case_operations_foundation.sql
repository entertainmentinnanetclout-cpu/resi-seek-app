-- ResKonnect case operations v1 — private case workflow, delegated review and hard finalization gates.
-- This does not change student intake eligibility, send external messages or disclose raw student files.
create table if not exists public.rk_case_workflows(
 kind text not null check (kind in ('application','reservation','wil')),
 case_id uuid not null,
 residence_id uuid,
 student_id uuid,
 stage text not null default 'received' check(stage in ('received','under_review','documents_required','landlord_review','ready_for_handover','handover_approved','closed')),
 eligibility_decision text check(eligibility_decision in ('eligible','ineligible','needs_documents')),
 review_source text check(review_source in ('reskonnect','landlord')),
 review_completed_at timestamptz,
 handover_approved_by uuid references auth.users(id),
 handover_approved_at timestamptz,
 delegated_at timestamptz,
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(kind,case_id)
);
create index if not exists rk_case_workflows_residence_idx on public.rk_case_workflows(residence_id,stage,updated_at desc);
create index if not exists rk_case_workflows_student_idx on public.rk_case_workflows(student_id);
create table if not exists public.rk_case_tasks(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('application','reservation','wil')),
 case_id uuid not null,
 residence_id uuid,
 assigned_scope text not null check(assigned_scope in ('reskonnect','landlord')),
 task_type text not null check(task_type in ('eligibility_review','document_followup','case_followup','handover_signoff')),
 status text not null default 'open' check(status in ('open','completed','cancelled')),
 summary text not null check(length(summary) between 4 and 240),
 assigned_by uuid references auth.users(id),
 completed_by uuid references auth.users(id),
 completed_at timestamptz,
 due_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(kind,case_id) references public.rk_case_workflows(kind,case_id) on delete cascade
);
create unique index if not exists rk_case_tasks_active_unique on public.rk_case_tasks(kind,case_id,assigned_scope,task_type) where status='open';
create index if not exists rk_case_tasks_queue_idx on public.rk_case_tasks(assigned_scope,residence_id,status,created_at desc);
create table if not exists public.rk_case_operation_audit(
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null,
 actor_user_id uuid not null references auth.users(id),
 kind text not null check(kind in ('application','reservation','wil')),
 case_id uuid not null,
 action text not null,
 old_stage text,
 new_stage text,
 old_status text,
 new_status text,
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(actor_user_id,operation_id,kind,case_id)
);
create index if not exists rk_case_operations_case_idx on public.rk_case_operation_audit(kind,case_id,created_at desc);
create table if not exists public.rk_case_collaboration(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('application','reservation','wil')),
 case_id uuid not null,
 residence_id uuid,
 sender_id uuid not null references auth.users(id),
 visibility text not null check(visibility in ('reskonnect_only','shared_with_residence')),
 message text not null check(length(btrim(message)) between 4 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists rk_case_collaboration_idx on public.rk_case_collaboration(kind,case_id,created_at);
alter table public.rk_case_workflows enable row level security;
alter table public.rk_case_tasks enable row level security;
alter table public.rk_case_operation_audit enable row level security;
alter table public.rk_case_collaboration enable row level security;
revoke all on public.rk_case_workflows,public.rk_case_tasks,public.rk_case_operation_audit,public.rk_case_collaboration from public,anon,authenticated;
grant all on public.rk_case_workflows,public.rk_case_tasks,public.rk_case_operation_audit,public.rk_case_collaboration to service_role;
comment on table public.rk_case_workflows is 'ResKonnect-owned case triage separate from legally meaningful application/reservation status; no student identity file is stored here.';
comment on table public.rk_case_tasks is 'Delegated eligibility work; assignment never authorises a landlord to grant final placement or funding approval.';
comment on table public.rk_case_collaboration is 'Private scoped operations messages; never outbound email or WhatsApp. Access via approved RPCs only.';

create or replace function reskonnect_internal.rk_godmode_authorized()
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
   and public.has_role((select auth.uid()),'admin'::public.app_role)
   and coalesce((select auth.jwt()->>'aal'),'')='aal2';
$$;
revoke all on function reskonnect_internal.rk_godmode_authorized() from public,anon,authenticated;
grant execute on function reskonnect_internal.rk_godmode_authorized() to authenticated;

-- Checking documented evidence must never be equivalent to clicking "acknowledge".
-- Only explicitly verified documents with a recorded verification timestamp count as eligible.
create or replace function reskonnect_internal.rk_case_document_readiness(p_kind text,p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_student uuid;v_funding text;v_id boolean:=false;v_academic boolean:=false;
 v_funding_ok boolean:=false;v_need_funding boolean;v_clear_funding boolean;
 v_total integer:=0;v_pending integer:=0;
begin
 if p_kind='reservation' then
  select user_id,funding_type into v_student,v_funding from public.accommodation_reservations where id=p_case_id;
 elsif p_kind='application' then
  select user_id,funding_type into v_student,v_funding from public.applications where id=p_case_id;
 else return jsonb_build_object('ready',false,'reason','WIL documents have a separate approval workflow');end if;
 if v_student is null then return jsonb_build_object('ready',false,'reason','No linked verified student');end if;
 v_need_funding:=coalesce(v_funding,'') ~* '(nsfas|bursar|funded|scholarship)';
 v_clear_funding:=lower(coalesce(btrim(v_funding),'')) not in ('','unknown','undecided','unspecified');
 with evidence as (
  select lower(regexp_replace(d.document_type,'[^a-zA-Z0-9]+','_','g')) as type,
    lower(coalesce(d.status,'')) as state,d.verified_at from public.documents d where d.user_id=v_student
  union all
  select lower(regexp_replace(d.doc_type,'[^a-zA-Z0-9]+','_','g')),
   lower(coalesce(d.status,'')),d.verified_at from public.application_documents d
   where p_kind='application' and d.application_id=p_case_id
 ), eligible as (
  select type,state,verified_at,
   (state in ('verified','approved','accepted') and verified_at is not null) as verified
  from evidence
 )
 select count(*)::int,
  count(*) filter(where not verified)::int,
  coalesce(bool_or(verified and type=any(array['id','id_document','identity_document','passport','passport_document','id_copy'])),false),
  coalesce(bool_or(verified and type=any(array['proof_of_registration','registration','latest_results','academic_results','student_registration','proof_of_study'])),false),
  coalesce(bool_or(verified and type=any(array['funding','funding_document','proof_of_funding','nsfas_approval','bursary_letter','funding_proof'])),false)
 into v_total,v_pending,v_id,v_academic,v_funding_ok
 from eligible;
 return jsonb_build_object('ready',v_id and v_academic and v_clear_funding and (not v_need_funding or v_funding_ok),
   'identity_verified',v_id,'academic_verified',v_academic,
   'funding_verified',not v_need_funding or v_funding_ok,'funding_type_known',v_clear_funding,
   'uploaded',v_total,'pending_or_rejected',v_pending,
   'missing',array_remove(array[
    case when not v_id then 'Identity evidence needs verification' end,
    case when not v_academic then 'Registration or results need verification' end,
    case when not v_clear_funding then 'Funding type needs clarification' end,
    case when v_need_funding and not v_funding_ok then 'Funding proof needs verification' end
   ],null));
end $$;
revoke all on function reskonnect_internal.rk_case_document_readiness(text,uuid) from public,anon,authenticated;

-- Irreversible decisions are gated at the table, not merely by the frontend.
-- This catches direct PostgREST updates, legacy landlord RPCs, and service-role paths.
create or replace function reskonnect_internal.rk_require_final_handover()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_kind text;v_workflow public.rk_case_workflows%rowtype;v_docs jsonb;
begin
 v_kind:=case when tg_table_name='applications' then 'application' else 'reservation' end;
 if v_kind='application' and (new.status is distinct from 'approved' or (tg_op='UPDATE' and old.status='approved')) then return new;end if;
 if v_kind='reservation' and (new.status is distinct from 'confirmed' or (tg_op='UPDATE' and old.status='confirmed')) then return new;end if;
 select * into v_workflow from public.rk_case_workflows where kind=v_kind and case_id=new.id;
 if v_workflow.handover_approved_at is null or v_workflow.stage<>'handover_approved'
    or v_workflow.eligibility_decision<>'eligible' then
  raise exception 'Final placement requires ResKonnect-approved eligibility handover' using errcode='23514';
 end if;
 v_docs:=reskonnect_internal.rk_case_document_readiness(v_kind,new.id);
 if coalesce((v_docs->>'ready')::boolean,false) is not true then
  raise exception 'Final placement blocked until identity, academic and funding evidence is verified' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists rk_final_reservation_handover_gate on public.accommodation_reservations;
create trigger rk_final_reservation_handover_gate before insert or update of status on public.accommodation_reservations
 for each row execute function reskonnect_internal.rk_require_final_handover();
drop trigger if exists rk_final_application_handover_gate on public.applications;
create trigger rk_final_application_handover_gate before insert or update of status on public.applications
 for each row execute function reskonnect_internal.rk_require_final_handover();
