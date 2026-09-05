create table if not exists public.adminos_followup_message_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  channel text not null check(channel in ('email','whatsapp')),
  purpose text not null default 'service' check(purpose in ('transactional','service','marketing')),
  subject_template text,
  body_template text not null,
  provider_template_sid text,
  risk_level text not null default 'green' check(risk_level in ('green','amber','red')),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_key,channel)
);

insert into public.adminos_followup_message_templates(template_key,channel,purpose,subject_template,body_template,risk_level,metadata)
values
('accommodation_application_reminder','whatsapp','service',null,'Hi {{first_name}}, your ResKonnect accommodation journey is still open. Complete your next application step in your ResKonnect account. Reply here if you need help.','green','{"release":3,"phase":7}'::jsonb),
('accommodation_application_help','email','service','Complete your ResKonnect accommodation application','Hi {{first_name}},\n\nYour ResKonnect accommodation journey is still open. Please sign in and complete your next application step. If you are unsure what is outstanding, reply to this email and the team will assist.\n\nResKonnect','green','{"release":3,"phase":7}'::jsonb),
('missing_documents_notice','whatsapp','transactional',null,'Hi {{first_name}}, documents are still outstanding on your ResKonnect application. Please sign in to your account and upload the requested documents. This message does not mean your application has been approved.','green','{"release":3,"phase":7}'::jsonb),
('missing_documents_email','email','transactional','Documents outstanding on your ResKonnect application','Hi {{first_name}},\n\nDocuments are still outstanding on your ResKonnect application. Please sign in to your account and upload the requested documents. This reminder is not an approval, placement guarantee or funding confirmation.\n\nResKonnect','green','{"release":3,"phase":7}'::jsonb),
('wil_next_steps','whatsapp','service',null,'Hi {{first_name}}, your ResKonnect WIL candidate record is active. Please complete any outstanding readiness actions in your account. This does not guarantee placement, employment or a stipend.','green','{"release":3,"phase":7}'::jsonb),
('wil_readiness_check','email','service','Your ResKonnect WIL readiness check','Hi {{first_name}},\n\nPlease review and complete any outstanding WIL readiness actions in ResKonnect. Your candidate record remains part of the process, but this message does not guarantee workplace placement, employment or a stipend.\n\nResKonnect','green','{"release":3,"phase":7}'::jsonb),
('partner_followup','email','service','ResKonnect follow-up','Hi {{first_name}},\n\nFollowing our recent ResKonnect engagement, this is a structured follow-up to keep the next action moving. Please reply if you need clarification or want the team to schedule the next step.\n\nResKonnect','green','{"release":3,"phase":7}'::jsonb)
on conflict(template_key,channel) do update set purpose=excluded.purpose,subject_template=excluded.subject_template,body_template=excluded.body_template,risk_level=excluded.risk_level,metadata=excluded.metadata,active=true,updated_at=now();

drop trigger if exists trg_adminos_followup_message_templates_touch on public.adminos_followup_message_templates;
create trigger trg_adminos_followup_message_templates_touch before update on public.adminos_followup_message_templates for each row execute function public.adminos_touch_updated_at();

alter table public.adminos_followup_message_templates enable row level security;
drop policy if exists "AdminOS staff access" on public.adminos_followup_message_templates;
create policy "AdminOS staff access" on public.adminos_followup_message_templates for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()));
revoke all on public.adminos_followup_message_templates from anon;
grant select,insert,update,delete on public.adminos_followup_message_templates to authenticated;

create index if not exists idx_adminos_followup_message_templates_active on public.adminos_followup_message_templates(channel,active,template_key);
