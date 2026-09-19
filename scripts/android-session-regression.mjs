// Deterministic browser regression: never creates accounts or writes live data.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "vite";

const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:8080";
const server = process.env.TEST_ORIGIN ? null : await createServer({ server: { host: '127.0.0.1', port: 8080 } });
await server?.listen();
const storageKey = "sb-mefjzkhobkltlbmhusdh-auth-token";
const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", user_metadata: { full_name: "Test Student" }, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const token = [Buffer.from('{}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'fixture'].join('.');
const session = { access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user };
const profile = { id: user.id, full_name: "Test Student", phone: "0821234567", student_number: "123456789", campus: "Pretoria West (Main Campus)", applicant_stage: "university_student" };
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, serviceWorkers: "block" });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
  let role = null;
  let accessCalls = 0;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    let body = {};
    if (url.pathname.includes('/auth/v1/token')) body = session;
    else if (url.pathname.includes('/auth/v1/user')) body = user;
    else if (url.pathname.includes('/rest/v1/rpc/get_my_access_context')) { accessCalls++; body = { staff_role: role, admin_departments: [], is_student: !role }; }
    else if (url.pathname.includes('/rest/v1/rpc/my_reskonnect_command_centre')) body = { profile };
    else if (url.pathname.includes('/rest/v1/profiles')) body = route.request().headers().accept?.includes('object') ? profile : [profile];
    else if (url.pathname.includes('/rest/v1/')) body = url.pathname.includes('/rpc/') ? {} : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  let page = await context.newPage();
  const errors = [];
  const observe = p => p.on('pageerror', e => errors.push(e.message));
  observe(page);
  await page.goto(origin);
  await page.waitForURL('**/auth');
  await page.getByLabel('Account portals').waitFor();
  console.log('PASS native signed-out entry and account portal choices');
  await page.getByLabel('Email address *').fill(user.email);
  await page.getByLabel('Password *', { exact: true }).fill('FixturePassword123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: 'My ResKonnect' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Open full dashboard' }).count(), 1);
  assert.equal(await page.getByText('Something went wrong', { exact: true }).count(), 0);
  console.log('PASS native post-login lightweight home without eager full dashboard');
  const callsBeforeResume = accessCalls;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(500);
  assert.equal(accessCalls, callsBeforeResume, 'resume must not remount access resolution for unchanged identity');
  await page.reload();
  await page.getByRole('heading', { name: 'My ResKonnect' }).waitFor();
  await page.close();
  page = await context.newPage(); observe(page);
  await page.goto(origin);
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: 'My ResKonnect' }).waitFor();
  console.log('PASS login, reload, close/reopen and unchanged-identity resume');
  await page.getByRole('link', { name: 'Open full dashboard' }).click();
  await page.waitForURL('**/dashboard?full=1');
  await page.getByText('Good to see you, Test.').waitFor();
  await page.goto(origin + '/dashboard');
  await page.getByRole('heading', { name: 'My ResKonnect' }).waitFor();
  console.log('PASS expanded dashboard remains accessible without forcing it on startup');
  for (const path of ['/profile', '/my-applications', '/dashboard/services', '/documents', '/favorites', '/messages', '/wil', '/ai', '/opportunities', '/findmyres', '/portals']) {
    await page.goto(origin + path);
    await page.getByRole('navigation', { name: 'App account navigation' }).waitFor();
    await page.waitForTimeout(650);
    assert.equal(await page.getByText('Something went wrong', { exact: true }).count(), 0, path);
    assert.equal(errors.length, 0, `${path}: ${errors.join('; ')}`);
    console.log('PASS route shell ' + path);
  }
  await page.getByRole('navigation', { name: 'App account navigation' }).getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/auth');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), null);
  await page.reload();
  await page.getByRole('button', { name: 'Sign In', exact: true }).waitFor();
  console.log('PASS explicit sign-out removes persisted session');
  for (const [staffRole, path] of [['operations_lead','/portals'], ['tvet_lead','/tvet-dashboard'], ['residence_admin','/residence'], ['commerce_lead','/commerce']]) {
    role = staffRole;
    await page.evaluate(({key, value}) => localStorage.setItem(key, JSON.stringify(value)), {key: storageKey, value: session});
    await page.goto(origin);
    await page.waitForURL('**' + path);
    await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, path, 'stable staff route');
    console.log('PASS role routing ' + staffRole);
  }
  assert.deepEqual(errors, []);
  await context.close();
  const web = await browser.newContext({ serviceWorkers: 'block' });
  const webPage = await web.newPage();
  await webPage.goto(origin);
  await webPage.waitForTimeout(1000);
  assert.equal(new URL(webPage.url()).pathname, '/');
  console.log('PASS website retains public landing');
  await web.close();
} finally { await browser.close(); await server?.close(); }
