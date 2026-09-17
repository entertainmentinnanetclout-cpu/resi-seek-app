-- Keep the repository migration history aligned with the fixes already applied to production.
-- The pre-existing assistance event trigger emits these two events on intake/completion.
alter table public.creator_referral_events drop constraint creator_referral_events_event_type_check;
alter table public.creator_referral_events add constraint creator_referral_events_event_type_check check(event_type in
 ('click','signup','accommodation_search','reservation','application_started','application_assisted','placement','application_assistance_requested','application_assistance_completed'));

-- Supabase default table grants are broader than these new private workspaces need.
revoke all on public.residence_stay_feedback,public.single_room_waitlist,public.assistance_submissions,public.assistance_document_requests,public.assistance_call_requests,public.assistance_case_activity from anon;
revoke insert,update,delete,truncate,references,trigger on public.residence_feedback_campaigns from anon;
revoke truncate,references,trigger on public.residence_feedback_campaigns,public.residence_stay_feedback,public.single_room_waitlist,public.assistance_submissions,public.assistance_document_requests,public.assistance_call_requests,public.assistance_case_activity from authenticated;
revoke insert,update,delete on public.assistance_case_activity from authenticated;

drop policy "creator reads assigned assistance cases" on public.creator_assistance_cases;
create policy "creator reads assigned assistance cases" on public.creator_assistance_cases for select to authenticated
using (public.rk_can_access_assistance(id,true));

-- New care records must not prevent an authorized account deletion.
alter table public.residence_stay_feedback drop constraint residence_stay_feedback_user_id_fkey;
alter table public.residence_stay_feedback add constraint residence_stay_feedback_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.single_room_waitlist drop constraint single_room_waitlist_user_id_fkey;
alter table public.single_room_waitlist add constraint single_room_waitlist_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
