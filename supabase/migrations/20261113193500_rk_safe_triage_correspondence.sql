-- Fixed-content, low-risk case receipts do not pretend that documents or eligibility have been reviewed.
alter table public.reskonnect_outbound_emails drop constraint if exists reskonnect_outbound_emails_template_key_check;
alter table public.reskonnect_outbound_emails add constraint reskonnect_outbound_emails_template_key_check check(
 template_key in ('status_update','feedback','documents_needed','next_steps','enquiry_response',
 'viewing_invite','smart','acknowledgement','documents_received','approved','rejected',
 'conditionally_approved','follow_up','reservation_confirmed','move_in_arrangements',
 'triage_received','triage_under_review')
);
comment on constraint reskonnect_outbound_emails_template_key_check on public.reskonnect_outbound_emails is
'Receipt/under-review text is a fixed, non-decision service template; document review remains compulsory for formal decisions.';
