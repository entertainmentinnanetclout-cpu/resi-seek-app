import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(path,"utf8");
const migrations=read("supabase/migrations/20261124153000_site_promotion_formats.sql");
const intake=read("supabase/migrations/20261124162000_admin_intake_notification_events.sql");
const admin=read("src/components/admin/AdminSiteAnnouncementsManager.tsx");
const publicPopup=read("src/components/SiteAnnouncementPopup.tsx");
const media=read("src/pages/admin/AdminMediaHub.tsx");
const studio=read("src/pages/admin/AdminVisualStudio.tsx");
const push=read("src/lib/push.ts");
const pushPrompt=read("src/components/PushPrompt.tsx");
const subscription=read("supabase/functions/push-subscription/index.ts");
const sounds=read("src/lib/notificationSounds.ts");
const settings=read("src/components/NotificationSettings.tsx");
const notices=read("src/hooks/useRealtimeNotifications.ts");
const app=read("src/App.tsx");
const adminTechnology=read("src/pages/admin/AdminTechnologySystems.tsx");
const updates=read("src/pages/Updates.tsx");

test("RG11 announcements are extended rather than replaced with duplicate popup data",()=>{
 for(const key of ["display_surface","width_px","poster_only","show_frequency","residence_id"])
  assert.ok(migrations.includes(key),"Expected migration field "+key);
 assert.ok(migrations.includes("BETWEEN 280 AND 760"),"Card width should be bounded");
 assert.ok(migrations.includes("ON DELETE SET NULL"),"Deleting residence must not delete campaign");
 assert.ok(!migrations.includes("DROP TABLE"),"No destructive reset");
 for(const key of ["uploadPoster","selectResidence","createSingleRoom",
  "once_per_session","once_per_day","once_per_campaign",
  "display_surface","poster_only","width_px","is_active:false"])
  assert.ok(admin.includes(key),"Admin campaign editor should support "+key);
 assert.ok(admin.includes("/single-room-waiting-list"),"Square poster links to actual student form");
 assert.ok(admin.includes('from("admin-images")'),"Reuse existing owned upload bucket");
 assert.ok(media.includes('value: "campaigns"'),"Media hub should show one campaign tab");
 assert.ok(media.includes("<AdminSiteAnnouncementsManager/>"),"Reuse existing announcement editor");
 assert.ok(studio.includes("/admin/media?tab=campaigns"));
});

test("public campaigns are responsive, suppress repeated ads and never crop designed posters",()=>{
 for(const fragment of ["site_announcements","once_per_session","once_per_day",
  "once_per_campaign","visibilitychange","width_px","max-h-[min(66dvh,620px)]",
  "object-contain","pointer-events-none fixed inset-0","recordDismissal",
  'display_surface==="corner"',"show_frequency","safeAction","aria-label"])
  assert.ok(publicPopup.includes(fragment),"Popup missing "+fragment);
 assert.ok(publicPopup.includes('startsWith("//")'),"Never resolve protocol-relative external URLs as internal");
 assert.ok(publicPopup.includes("noopener noreferrer"),"External link must be safe");
 assert.ok(publicPopup.includes("setVisible(false)"),"Close action must work");
 assert.ok(!publicPopup.includes("sm:max-w-xl"),"Do not force same size for all artwork");
});

test("new intake events are delivered privately to authenticated admins without changing student cases",()=>{
 for(const table of ["public.applications","public.accommodation_reservations",
  "public.single_room_waitlist","public.adminos_enquiry_messages"])
  assert.ok(intake.includes(table),"Missing intake source "+table);
 assert.ok(intake.includes("reskonnect_internal.notify_admin_intake()"));
 assert.ok(intake.includes("SECURITY DEFINER SET search_path=''"));
 assert.ok(intake.includes("REVOKE ALL ON FUNCTION"));
 assert.ok(intake.includes("SELECT DISTINCT user_id FROM public.user_roles WHERE role='admin'"));
 assert.ok(intake.includes("ON CONFLICT(event_key) DO NOTHING"));
 assert.ok(intake.includes("EXCEPTION WHEN OTHERS"));
 assert.ok(intake.includes("jsonb_build_object('kind',v_type,'source',TG_TABLE_NAME"));
 for(const type of ["admin_application_new","admin_reservation_new","admin_single_room_new","admin_inquiry_new"])
  assert.ok(intake.includes(type),"Missing classification "+type);
 assert.ok(!intake.includes("NEW.full_name"),"Do not put applicant names in notification previews");
 assert.ok(!intake.includes("UPDATE public.applications"),"Notifications cannot change application statuses");
});

test("push setup distinguishes permission from a saved subscription and respects user gesture",()=>{
 assert.ok(push.includes("Notification.requestPermission()"),"Request only from enable action");
 assert.ok(push.includes('Notification.permission==="denied"'),"Do not re-prompt blocked browser");
 assert.ok(pushPrompt.includes('action:"status"'),"Check actual server registration, not just browser subscription");
 assert.ok(subscription.includes('action === "status"'),"Server must support registration probe");
 assert.ok(subscription.includes('.eq("user_id", user.id)'),"Status probe scoped to authenticated user");
 assert.ok(pushPrompt.includes("How to unblock"),"Expose denied permission instead of hiding prompts");
 assert.ok(settings.includes("Connecting")||settings.includes("Connect / repair"));
 assert.ok(settings.includes("subscription is not yet verified"),"Do not claim delivered from browser grant");
});

test("sounds opt in per message category and never claim background audio",()=>{
 for(const value of ["application","reservation","inquiry","general",
 "enabled:false","playNotificationTone","readNotificationSounds","saveNotificationSounds",
 'document.visibilityState!=="visible"'])
  assert.ok(sounds.includes(value),"Sound policy missing "+value);
 assert.ok(sounds.includes("window.AudioContext"),"Use user gesture controlled WebAudio");
 assert.ok(settings.includes("when the site is closed")||settings.includes("while the site is closed"));
 assert.ok(settings.includes("Settings"));
 assert.ok(notices.includes("playNoticeSound(userId,next.type"),"Live notices should respect sound settings");
 assert.ok(app.includes("<NotificationLiveBridge />"),"All signed-in routes need notification listener");
 assert.ok(adminTechnology.includes('value="notifications"'),"Admin can configure sound and push");
 assert.ok(updates.includes("<NotificationSettings />"),"Students can configure sound and push");
});
