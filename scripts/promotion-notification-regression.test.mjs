import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("promotion studio keeps one governed CMS, placement formats, and image uploads", () => {
  const manager = read("src/components/admin/AdminSiteAnnouncementsManager.tsx");
  const hub = read("src/pages/admin/AdminMediaHub.tsx");
  const migration = read("supabase/migrations/20261124153000_site_promotion_formats.sql");
  assert.match(manager, /from\("site_announcements"\)/);
  assert.match(manager, /storage\.from\("admin-images"\)/);
  assert.match(manager, /single-room-waiting-list/);
  assert.match(manager, /residence_id/);
  assert.match(manager, /width_px/);
  assert.match(manager, /show_frequency/);
  assert.match(hub, /AdminSiteAnnouncementsManager/);
  assert.match(hub, /AdminSlidesContent/);
  assert.match(hub, /AdminMarketplaceBannersContent/);
  assert.match(migration, /BETWEEN 280 AND 760/);
  assert.match(migration, /REFERENCES public\.residences/);
});

test("public poster remains responsive, dismissible, scheduled, and routed safely", () => {
  const popup = read("src/components/SiteAnnouncementPopup.tsx");
  for (const token of ["object-contain", "calc(100vw - 24px)", "recordDismissal", "starts_at", "ends_at", "display_surface", "poster_only"]) {
    assert.ok(popup.includes(token), `promotion is missing ${token}`);
  }
  assert.match(popup, /startsWith\("\/\/"\)/);
  assert.match(popup, /z-\[120\]/);
});

test("admin intake creates private in-app notices without blocking student submissions", () => {
  const migration = read("supabase/migrations/20261124162000_admin_intake_notification_events.sql");
  for (const table of ["applications", "accommodation_reservations", "single_room_waitlist", "adminos_enquiry_messages"]) {
    assert.ok(migration.includes(`ON public.${table}`), `missing trigger for ${table}`);
  }
  assert.match(migration, /INSERT INTO public\.notifications/);
  assert.match(migration, /ON CONFLICT\(event_key\) DO NOTHING/);
  assert.match(migration, /EXCEPTION WHEN OTHERS/);
  assert.match(migration, /REVOKE ALL ON FUNCTION/);
});

test("web push verifies saved subscription; permission request is tied to user gesture", () => {
  const push = read("src/lib/push.ts");
  const endpoint = read("supabase/functions/push-subscription/index.ts");
  const settings = read("src/components/NotificationSettings.tsx");
  const prompt = read("src/components/PushPrompt.tsx");
  assert.match(push, /Notification\.requestPermission\(\)/);
  assert.ok(push.indexOf("Notification.requestPermission()") < push.indexOf("supabase.auth.getSession()"));
  assert.match(endpoint, /action === "status"/);
  assert.match(endpoint, /\.eq\("user_id",user\.id\)/);
  assert.match(settings, /registered===true/);
  assert.match(prompt, /registered!==true/);
  assert.match(prompt, /pushPermission\(\)===?"denied"|pushPermission\(\)==="denied"/);
});

test("notification sounds remain opt-in foreground only, with individual categories", () => {
  const sounds = read("src/lib/notificationSounds.ts");
  const realtime = read("src/hooks/useRealtimeNotifications.ts");
  const settings = read("src/components/NotificationSettings.tsx");
  assert.match(sounds, /enabled:false/);
  assert.match(sounds, /document\.visibilityState!=="visible"/);
  for (const category of ["application", "reservation", "inquiry", "general"]) {
    assert.ok(sounds.includes(category), `missing ${category} sound category`);
  }
  assert.match(realtime, /playNoticeSound\(/);
  assert.match(settings, /playNotificationTone/);
});
