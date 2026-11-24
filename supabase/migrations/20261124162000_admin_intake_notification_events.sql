-- Deliver a private notification to each registered ResKonnect admin when a
-- student submits a new application, reservation, single-room request or enquiry.
-- Notification payloads are generic; student names and content stay behind RLS.
-- This is an in-app event ledger, not evidence that web push was delivered.
CREATE OR REPLACE FUNCTION reskonnect_internal.notify_admin_intake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_admin uuid;
 v_title text;
 v_type text;
 v_message text;
 v_event text;
 v_route text;
BEGIN
 IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='applications' THEN
  v_type:='admin_application_new';
  v_title:='New accommodation application';
  v_message:='A student submitted an accommodation application. Open the Applications queue to review it.';
  v_event:='intake:application:'||NEW.id::text;
  v_route:='/admin/accommodation?tab=applications-reservations&view=applications';
 ELSIF TG_TABLE_NAME='accommodation_reservations' THEN
  v_type:='admin_reservation_new';
  v_title:='New accommodation reservation';
  v_message:='A student submitted a residence reservation. Open the 2027 Fill Command to review it.';
  v_event:='intake:reservation:'||NEW.id::text;
  v_route:='/admin/accommodation?tab=applications-reservations&view=reservations';
 ELSIF TG_TABLE_NAME='single_room_waitlist' THEN
  v_type:='admin_single_room_new';
  v_title:='New single-room request';
  v_message:='A student requested a private single room. Review the accommodation-independent waiting list.';
  v_event:='intake:single_room:'||NEW.id::text;
  v_route:='/admin/student-care?tab=rooms';
 ELSIF TG_TABLE_NAME='adminos_enquiry_messages' THEN
  IF coalesce(NEW.direction,'') NOT IN ('inbound','incoming') AND
     coalesce(NEW.sender_type,'') NOT IN ('student','visitor','customer') THEN
   RETURN NEW;
  END IF;
  v_type:='admin_inquiry_new';
  v_title:='New student enquiry';
  v_message:='A student sent an enquiry. Open the Communications workspace to review it.';
  v_event:='intake:enquiry:'||NEW.id::text;
  v_route:='/admin/communications';
 ELSE
  RETURN NEW;
 END IF;
 FOR v_admin IN
  SELECT DISTINCT user_id FROM public.user_roles WHERE role='admin'
 LOOP
  BEGIN
   INSERT INTO public.notifications
    (user_id,type,title,message,is_read,created_at,event_key,metadata)
   VALUES(v_admin,v_type,v_title,v_message,false,now(),
     v_event||':admin:'||v_admin::text,
     jsonb_build_object('kind',v_type,'source',TG_TABLE_NAME,
       'route',v_route,'created_at',now()))
   ON CONFLICT(event_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
   -- A notification failure MUST NOT reject a student's application.
   RAISE WARNING 'ResKonnect admin intake notification unavailable for %',TG_TABLE_NAME;
  END;
 END LOOP;
 RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION reskonnect_internal.notify_admin_intake() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS rk_admin_application_intake_notice ON public.applications;
CREATE TRIGGER rk_admin_application_intake_notice
 AFTER INSERT ON public.applications FOR EACH ROW
 EXECUTE FUNCTION reskonnect_internal.notify_admin_intake();

DROP TRIGGER IF EXISTS rk_admin_reservation_intake_notice ON public.accommodation_reservations;
CREATE TRIGGER rk_admin_reservation_intake_notice
 AFTER INSERT ON public.accommodation_reservations FOR EACH ROW
 EXECUTE FUNCTION reskonnect_internal.notify_admin_intake();

DROP TRIGGER IF EXISTS rk_admin_single_room_intake_notice ON public.single_room_waitlist;
CREATE TRIGGER rk_admin_single_room_intake_notice
 AFTER INSERT ON public.single_room_waitlist FOR EACH ROW
 EXECUTE FUNCTION reskonnect_internal.notify_admin_intake();

DROP TRIGGER IF EXISTS rk_admin_enquiry_message_notice ON public.adminos_enquiry_messages;
CREATE TRIGGER rk_admin_enquiry_message_notice
 AFTER INSERT ON public.adminos_enquiry_messages FOR EACH ROW
 EXECUTE FUNCTION reskonnect_internal.notify_admin_intake();
