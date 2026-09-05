-- Release Gate 2 performance closure for Phase 3-5 objects.

create index if not exists idx_adminos_agent_prompt_versions_created_by on public.adminos_agent_prompt_versions(created_by);
create index if not exists idx_adminos_agent_usage_run_id on public.adminos_agent_usage(run_id);
create index if not exists idx_adminos_enquiry_threads_contact_id on public.adminos_enquiry_threads(contact_id);
create index if not exists idx_adminos_enquiry_threads_application_id on public.adminos_enquiry_threads(application_id);
create index if not exists idx_adminos_enquiry_threads_assigned_to on public.adminos_enquiry_threads(assigned_to);
create index if not exists idx_adminos_enquiry_messages_sender_user_id on public.adminos_enquiry_messages(sender_user_id);
create index if not exists idx_adminos_enquiry_messages_agent_run_id on public.adminos_enquiry_messages(agent_run_id);
create index if not exists idx_adminos_email_outbox_contact_id on public.adminos_email_outbox(contact_id);
create index if not exists idx_adminos_email_outbox_thread_id on public.adminos_email_outbox(thread_id);
create index if not exists idx_adminos_email_outbox_approval_id on public.adminos_email_outbox(approval_id);
create index if not exists idx_adminos_email_outbox_agent_run_id on public.adminos_email_outbox(agent_run_id);

do $$ declare t text; begin
  foreach t in array array['adminos_agent_prompt_versions','adminos_agent_usage','adminos_enquiry_threads','adminos_enquiry_messages','adminos_email_threads','adminos_email_messages','adminos_email_outbox'] loop
    execute format('drop policy if exists "AdminOS staff access" on public.%I', t);
    execute format('create policy "AdminOS staff access" on public.%I for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()))', t);
  end loop;
end $$;

drop policy if exists "Enquiry owner read" on public.adminos_enquiry_threads;
create policy "Enquiry owner read" on public.adminos_enquiry_threads
for select to authenticated using(profile_user_id=(select auth.uid()));

drop policy if exists "Enquiry owner messages read" on public.adminos_enquiry_messages;
create policy "Enquiry owner messages read" on public.adminos_enquiry_messages
for select to authenticated using(exists(
  select 1 from public.adminos_enquiry_threads t
  where t.id=thread_id and t.profile_user_id=(select auth.uid())
));
