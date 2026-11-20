-- One canonical, auditable residence-level communications summary for the academic Fill Command.
-- Counts unique cases independently of outbound message volume; never infer delivery or open
-- from Gmail acceptance, nor imply that WhatsApp's manual send mark is a delivery receipt.
-- Invoked ONLY through the JWT-verified admin Edge route using the service role.
CREATE OR REPLACE FUNCTION public.rk_admin_residence_outreach_summary(p_kind text,p_year integer)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
WITH case_rows AS (
 SELECT id,residence_id,status FROM public.accommodation_reservations
 WHERE p_kind='reservation' AND academic_year=p_year AND residence_id IS NOT NULL
 UNION ALL
 SELECT id,residence_id,status FROM public.applications
 WHERE p_kind='application' AND academic_year=p_year AND residence_id IS NOT NULL
), email_per_case AS (
 SELECT m.target_id,
  count(*) FILTER (WHERE m.delivery_status='sent' AND m.provider_message_id IS NOT NULL) AS accepted_messages,
  count(*) FILTER (WHERE m.delivery_status IN ('sending','unknown')) AS uncertain_messages,
  count(*) FILTER (WHERE m.delivery_status='failed') AS failed_messages,
  max(m.sent_at) FILTER (WHERE m.delivery_status='sent' AND m.provider_message_id IS NOT NULL) AS last_gmail_at
 FROM public.reskonnect_outbound_emails m
 JOIN case_rows c ON c.id=m.target_id
 WHERE m.target_kind=p_kind
 GROUP BY m.target_id
), whatsapp_per_case AS (
 SELECT w.target_id,
  bool_or(w.status='operator_marked_sent') AS operator_marked_sent,
  bool_or(w.status='opened') AS opened,
  max(w.marked_sent_at) FILTER (WHERE w.status='operator_marked_sent') AS last_whatsapp_at
 FROM public.reskonnect_whatsapp_handoffs w
 JOIN case_rows c ON c.id=w.target_id
 WHERE w.target_kind=p_kind
 GROUP BY w.target_id
), reply_per_case AS (
 SELECT m.target_id,
  count(DISTINCT r.id) AS actual_replies
 FROM public.reskonnect_email_replies r
 JOIN public.reskonnect_outbound_emails m ON m.id=r.outbound_email_id
 JOIN case_rows c ON c.id=m.target_id
 WHERE m.target_kind=p_kind
 GROUP BY m.target_id
), review_per_case AS (
 SELECT target_id,count(*) FILTER(WHERE status IN ('pending','needs_review','open')) AS open_review_count
 FROM public.reskonnect_email_response_cases
 WHERE target_kind=p_kind AND target_id IN (SELECT id FROM case_rows)
 GROUP BY target_id
), evidence AS (
 SELECT c.residence_id,c.status,
  coalesce(e.accepted_messages,0) AS accepted_messages,
  coalesce(e.uncertain_messages,0) AS uncertain_messages,
  coalesce(e.failed_messages,0) AS failed_messages,
  coalesce(w.operator_marked_sent,false) AS wa_marked,
  coalesce(w.opened,false) AS wa_opened,
  coalesce(r.actual_replies,0) AS actual_replies,
  coalesce(rev.open_review_count,0) AS open_review_count,
  e.last_gmail_at,w.last_whatsapp_at
 FROM case_rows c
 LEFT JOIN email_per_case e ON e.target_id=c.id
 LEFT JOIN whatsapp_per_case w ON w.target_id=c.id
 LEFT JOIN reply_per_case r ON r.target_id=c.id
 LEFT JOIN review_per_case rev ON rev.target_id=c.id
), rollup AS (
 SELECT residence_id,
  count(*)::integer AS total_cases,
  count(*) FILTER(WHERE accepted_messages>0)::integer AS emailed_cases,
  count(*) FILTER(WHERE accepted_messages=0)::integer AS unemailed_cases,
  coalesce(sum(accepted_messages),0)::integer AS accepted_messages,
  count(*) FILTER(WHERE accepted_messages=0 AND uncertain_messages>0)::integer AS unconfirmed_only_cases,
  count(*) FILTER(WHERE accepted_messages=0 AND failed_messages>0 AND uncertain_messages=0)::integer AS failed_only_cases,
  count(*) FILTER(WHERE wa_marked)::integer AS whatsapp_marked_cases,
  count(*) FILTER(WHERE wa_opened AND NOT wa_marked)::integer AS whatsapp_opened_only_cases,
  count(*) FILTER(WHERE accepted_messages>0 AND NOT wa_marked)::integer AS emailed_whatsapp_pending,
  count(*) FILTER(WHERE actual_replies>0)::integer AS replied_cases,
  count(*) FILTER(WHERE open_review_count>0)::integer AS replies_needing_review,
  count(*) FILTER(WHERE status='reserved')::integer AS reserved_cases,
  count(*) FILTER(WHERE status='contacted')::integer AS contacted_cases,
  count(*) FILTER(WHERE status='provisional_hold')::integer AS provisional_cases,
  count(*) FILTER(WHERE status='confirmed')::integer AS confirmed_cases,
  count(*) FILTER(WHERE status='cancelled')::integer AS cancelled_cases,
  count(*) FILTER(WHERE status='submitted')::integer AS submitted_cases,
  count(*) FILTER(WHERE status='under_review')::integer AS under_review_cases,
  count(*) FILTER(WHERE status='approved')::integer AS approved_cases,
  count(*) FILTER(WHERE status='rejected')::integer AS rejected_cases,
  max(last_gmail_at) AS last_gmail_at,
  max(last_whatsapp_at) AS last_whatsapp_at
 FROM evidence GROUP BY residence_id
)
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'residence_id',residence_id,'total_cases',total_cases,
 'emailed_cases',emailed_cases,'unemailed_cases',unemailed_cases,
 'accepted_messages',accepted_messages,'unconfirmed_only_cases',unconfirmed_only_cases,
 'failed_only_cases',failed_only_cases,
 'whatsapp_marked_cases',whatsapp_marked_cases,
 'whatsapp_opened_only_cases',whatsapp_opened_only_cases,
 'emailed_whatsapp_pending',emailed_whatsapp_pending,
 'replied_cases',replied_cases,'replies_needing_review',replies_needing_review,
 'status_counts',jsonb_build_object(
  'reserved',reserved_cases,'contacted',contacted_cases,
  'provisional_hold',provisional_cases,'confirmed',confirmed_cases,
  'cancelled',cancelled_cases,'submitted',submitted_cases,
  'under_review',under_review_cases,'approved',approved_cases,'rejected',rejected_cases),
 'last_gmail_at',last_gmail_at,'last_whatsapp_at',last_whatsapp_at
) ORDER BY total_cases DESC,residence_id),'[]'::jsonb) FROM rollup;
$fn$;

REVOKE ALL ON FUNCTION public.rk_admin_residence_outreach_summary(text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rk_admin_residence_outreach_summary(text,integer)
 TO service_role;
COMMENT ON FUNCTION public.rk_admin_residence_outreach_summary(text,integer)
 IS 'Service-only administrative residence case communication rollup; Gmail accepted != delivered, WhatsApp marked != delivered; academic-year scoped.';
