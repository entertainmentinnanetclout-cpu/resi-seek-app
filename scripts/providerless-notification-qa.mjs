import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');
const pkg = JSON.parse(read('package.json'));
const config = JSON.parse(read('capacitor.config.json'));
const release = JSON.parse(read('native/android-release.json'));
const runner = read('public/runners/reskonnect-notifications.js');
const bridge = read('src/lib/backgroundNotifications.ts');
const settings = read('src/components/native/NativeAlertSettings.tsx');
const nativePush = read('src/lib/nativePush.ts');
const hook = read('src/hooks/useRealtimeNotifications.ts');
const migration = read('supabase/migrations/20261025204500_android_providerless_background_notifications.sql');
const edge = read('supabase/functions/native-notification-poll/index.ts');
const gradle = read('android/app/build.gradle');

assert.equal(release.versionName, '1.1.8');
assert.equal(release.versionCode, 11);
assert.equal(release.providerlessBackgroundNotifications, true);
assert.equal(release.providerlessBackgroundIntervalMinutes, 15);
assert.equal(pkg.dependencies?.['@capacitor/background-runner'], '3.0.0');

const background = config.plugins?.BackgroundRunner;
assert.equal(background?.label, 'org.reskonnect.background.notifications');
assert.equal(background?.src, 'runners/reskonnect-notifications.js');
assert.equal(background?.event, 'pollResKonnectNotifications');
assert.equal(background?.repeat, true);
assert.equal(background?.interval, 15);
assert.equal(background?.autoStart, true);

for (const term of ['CapacitorKV', 'CapacitorNotifications.schedule', 'native-notification-poll', 'ResKonnect update', 'generic']) {
  if (term === 'generic') continue;
  assert.ok(runner.includes(term), `runner missing ${term}`);
}
assert.ok(!runner.includes('SUPABASE_SERVICE_ROLE_KEY'), 'runner must never contain service-role credentials');
assert.ok(!runner.includes('notification.message'), 'runner must not expose private notification bodies');
assert.ok(runner.includes('You have a new account update') && runner.includes('new account updates'));

for (const term of ['rk_issue_background_notification_token', 'rk_revoke_background_notification_token', 'BackgroundRunner', 'configureResKonnectNotifications']) assert.ok(bridge.includes(term), term);
assert.ok(settings.includes('enableBackgroundNotificationFallback') && settings.includes('startNativePush'));
assert.ok(nativePush.includes('disableBackgroundNotificationFallback'));
assert.ok(hook.includes('listenForBackgroundNotificationAction'));

for (const term of ['enable row level security', 'digest(v_token', 'auth.uid()', 'rk_poll_background_notifications', 'grant execute on function public.rk_poll_background_notifications(text) to service_role']) assert.ok(migration.includes(term), term);
assert.ok(migration.includes('revoke all on table public.native_background_notification_devices from anon, authenticated'));
assert.ok(edge.includes('SUPABASE_SERVICE_ROLE_KEY') && edge.includes('rk_poll_background_notifications'));
assert.ok(edge.includes('TOKEN_RE') && !edge.includes('notification.message'));
assert.ok(gradle.includes('@capacitor/background-runner/android/src/main/libs'));

console.log('PASS provider-independent Android background notification audit');
