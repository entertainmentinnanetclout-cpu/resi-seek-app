import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(p,"utf8");

test("shared in-year 3-residence guard serializes applications and reservations",()=>{
 const sql=read("supabase/migrations/20261124194500_student_housing_guard_and_vapid_sender.sql");
 for(const name of ["rk_limit_student_applications","rk_limit_student_reservations","pg_advisory_xact_lock","current_count >= 3","count(*)","tg_table_name","academic_year","cancelled","withdrawn","rejected","guard_student_accommodation_choices"]){
  assert.ok(sql.includes(name),name);
 }
 assert.match(sql,/old\.user_id is not distinct from new\.user_id/);
 assert.match(sql,/user_id=new\.user_id/);
 assert.match(sql,/on public\.applications/);
 assert.match(sql,/on public\.accommodation_reservations/);
 const preflight=read("src/lib/studentHousingLimit.ts");
 assert.match(preflight,/slots\.size>=3/);
 assert.match(preflight,/kind==="application"/);
 for(const page of ["src/pages/FindMyRes.tsx","src/pages/ResidenceDetail.tsx"]){
  assert.match(read(page),/checkStudentHousingChoice/);
 }
});

test("admin single-room intake replaces follow-up tab, preserving existing operations",()=>{
 const hub=read("src/pages/admin/AdminOperationsHub.tsx");
 const desk=read("src/components/admin/AdminSingleRoomRequestsContent.tsx");
 assert.match(hub,/TabsTrigger value="single-rooms"/);
 assert.match(hub,/AdminSingleRoomRequestsContent/);
 assert.doesNotMatch(hub,/TabsTrigger value="follow-up"/);
 assert.match(desk,/single_room_waitlist/);
 assert.match(desk,/staff_response/);
 assert.match(desk,/matched/);
 assert.match(desk,/placed/);
});

test("student dashboard uses account-scoped live applications, reservations and single-room requests",()=>{
 const student=read("src/components/StudentHousingJourney.tsx");
 const dashboard=read("src/components/FullDashboard.tsx");
 assert.match(dashboard,/<StudentHousingJourney\s*\/>/);
 for(const name of ["from(\"applications\")","from(\"accommodation_reservations\")","from(\"single_room_waitlist\")","eq(\"user_id\",user.id)","Selected residences","Single rooms","Reservations"]){
  assert.ok(student.includes(name),name);
 }
});

test("admin promotion preview renders actual live popup without publishing or navigation",()=>{
 const popup=read("src/components/SiteAnnouncementPopup.tsx");
 const manager=read("src/components/admin/AdminSiteAnnouncementsManager.tsx");
 assert.match(popup,/SitePromotionPresentation/);
 assert.match(popup,/preview/);
 assert.match(popup,/onDismiss/);
 assert.match(manager,/preview\(draft,true\)/);
 assert.match(manager,/preview\(item\)/);
 assert.match(manager,/data-testid="promotion-live-preview"/);
});

test("push sender uses Vault matching signing pair; automatic dispatcher authenticates HMAC",()=>{
 const sql=read("supabase/migrations/20261124211500_signed_notification_push_event_dispatch.sql");
 const sender=read("supabase/functions/send-push/index.ts");
 const dispatch=read("supabase/functions/notification-event/index.ts");
 assert.match(sender,/rk_web_push_server_keys/);
 assert.match(dispatch,/rk_notification_dispatch_hmac_secret/);
 assert.match(dispatch,/crypto\.subtle\.verify/);
 assert.match(dispatch,/\.eq\("id",id\)/);
 assert.match(dispatch,/user_ids:\[notice\.user_id\]/);
 assert.match(sql,/extensions\.hmac/);
 assert.match(sql,/after insert on public\.notifications/);
 assert.match(sql,/rk_notification_push_dispatches/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/grant execute on function public\.rk_notification_dispatch_hmac_secret\(\) to service_role/);
 const push=read("src/lib/push.ts");
 assert.match(push,/checkPushKeyAvailability/);
 assert.match(push,/VAPID_PUBLIC_KEY/);
 assert.match(read("src/components/NotificationSettings.tsx"),/Test alert \+ audio/);
});
