// Follow-ups share one database reservation across all dispatchers. Replies to a
// student's inbound message and actual status/receipt events are not follow-ups.
export const isFollowupEvent = (type: string) =>
  /^(proactive_|conversion_followup_)/.test(type) ||
  ["document_attention", "csat_request", "student_care_followup"].includes(type);

export const isFollowupOutbox = (item: any, windowOpen: boolean) =>
  /follow.?up|proactive|campaign|reminder/i.test(`${item.source_type || ""} ${item.metadata?.sequence_key || ""}`) ||
  item.message_kind === "marketing" || item.metadata?.followup === true ||
  (item.source_type === "manual" && !windowOpen);

export class FollowupBlocked extends Error {
  constructor(reason: string) { super(reason); this.name = "FollowupBlocked"; }
}

export async function claimFollowup(service: any, input: {
  phone: string; userId?: string | null; contactId?: string | null;
  key: string; care?: boolean;
}) {
  const { data, error } = await service.rpc("rk_claim_student_followup", {
    p_phone: input.phone, p_user_id: input.userId || null,
    p_contact_id: input.contactId || null, p_key: input.key,
    p_purpose: input.care ? "student_care" : "recruitment",
  });
  if (error || data?.allowed !== true) throw new FollowupBlocked(error ? "followup_guard_unavailable" : data?.reason || "followup_not_authorized");
}

export async function claimEventFollowup(service: any, ctx: any, event: any) {
  if (!isFollowupEvent(String(event.event_type || ""))) return;
  await claimFollowup(service, { phone: ctx.phone, userId: event.user_id,
    contactId: ctx.contactId, key: `event:${event.id}`,
    care: ["csat_request", "student_care_followup"].includes(event.event_type) });
}
