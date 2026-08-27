-- Explicit least-privilege grants for the ResKonnect growth layer.
-- Supabase roles may retain direct EXECUTE grants even after revoking from PUBLIC.

revoke execute on function public.profile_has_required_contact(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_student_contact_before_action() from public, anon, authenticated;
revoke execute on function public.touch_residence_room_type() from public, anon, authenticated;
revoke execute on function public.touch_residence_lead() from public, anon, authenticated;
revoke execute on function public.sync_application_to_residence_lead() from public, anon, authenticated;
revoke execute on function public.sync_reservation_to_residence_lead() from public, anon, authenticated;
revoke execute on function public.touch_creator_partner() from public, anon, authenticated;
revoke execute on function public.touch_accommodation_demand() from public, anon, authenticated;
revoke execute on function public.capture_core_growth_event() from public, anon, authenticated;
revoke execute on function public.track_creator_conversion_from_action() from public, anon, authenticated;
revoke execute on function public.track_creator_placement_from_lead() from public, anon, authenticated;

revoke execute on function public.can_manage_growth() from public, anon, authenticated;
grant execute on function public.can_manage_growth() to authenticated;

revoke execute on function public.match_accommodation_demand(uuid) from public, anon, authenticated;
grant execute on function public.match_accommodation_demand(uuid) to authenticated;

revoke execute on function public.get_residence_demand_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_residence_demand_summary(uuid) to authenticated;

revoke execute on function public.admin_growth_command_centre(integer) from public, anon, authenticated;
grant execute on function public.admin_growth_command_centre(integer) to authenticated;

revoke execute on function public.attribute_creator(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.attribute_creator(uuid,text,text,text) to authenticated;

revoke execute on function public.get_creator_public(text) from public, anon, authenticated;
grant execute on function public.get_creator_public(text) to anon, authenticated;