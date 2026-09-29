// Deterministic cross-platform production-PWA regression. No live accounts or user data.
import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { preview } from "vite";

const origin = "http://127.0.0.1:8094";
const server = await preview({ preview: { host: "127.0.0.1", port: 8094 } });

const storageKey = "sb-mefjzkhobkltlbmhusdh-auth-token";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.invalid",
  user_metadata: { full_name: "Cross Platform Student" },
  app_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const token = [
  Buffer.from("{}").toString("base64url"),
  Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url"),
  "fixture",
].join(".");
const session = {
  access_token: token,
  refresh_token: "fixture-refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now()/1000)+3600,
  user,
};
const profile = {
  id: user.id,
  full_name: "Cross Platform Student",
  phone: "0820000000",
  student_number: "FIXTURE001",
  campus: "Pretoria West (Main Campus)",
  course: "Marketing",
  year_of_study: "3",
  applicant_stage: "university_student",
};
const residence = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Fixture Residence",
  address: "Pretoria",
  campus: "Pretoria West (Main Campus)",
  price: 3500,
  private_price: 3500,
  available_spots: 5,
  is_visible: true,
  latitude: -25.754,
  longitude: 28.188,
  room_type: "single",
  image_url: null,
};
const application = {
  id: "20000000-0000-4000-8000-000000000001",
  user_id: user.id,
  residence_id: residence.id,
  status: "submitted",
  created_at: "2026-09-20T10:00:00Z",
};
const tourSnapshot = {
  tour: { id: "30000000-0000-4000-8000-000000000001", title: "Fixture 360", workspace_type: "standalone" },
  workspace: { type: "standalone", label: "Fixture 360" },
  residence: null,
  scenes: [{
    id: "40000000-0000-4000-8000-000000000001",
    name: "Room",
    area_type: "room",
    floor_label: "1",
    is_start: true,
    panorama_url: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='8'%3E%3Crect width='16' height='8' fill='%23111'/%3E%3C/svg%3E",
    quality_score: 90,
  }],
  hotspots: [],
  connections: [],
};

const profiles = [
  { name:"iphone-home-screen", engine:webkit, viewport:{width:390,height:844}, mobile:true, ua:"Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1", standalone:true },
  { name:"ipad-portrait", engine:webkit, viewport:{width:820,height:1180}, mobile:true, ua:"Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1", standalone:true },
  { name:"ipad-landscape", engine:webkit, viewport:{width:1180,height:820}, mobile:true, ua:"Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1", standalone:true },
  { name:"mac-safari-webapp", engine:webkit, viewport:{width:1512,height:982}, mobile:false, ua:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15", standalone:false },
  { name:"mac-chrome-pwa", engine:chromium, viewport:{width:1512,height:982}, mobile:false, ua:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36", standalone:false },
  { name:"windows-edge-pwa", engine:chromium, viewport:{width:1366,height:768}, mobile:false, ua:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0", standalone:false },
  { name:"windows-chrome-pwa", engine:chromium, viewport:{width:1920,height:1080}, mobile:false, ua:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36", standalone:false },
];

async function fulfillApi(route) {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const originHeader = route.request().headers().origin || origin;
  const corsHeaders = {
    "access-control-allow-origin": originHeader,
    "access-control-allow-headers": "apikey,authorization,x-client-info,content-type,prefer,accept-profile,content-profile,range",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-expose-headers": "content-range,range-unit",
    "access-control-allow-credentials": "true",
    "vary": "Origin",
  };
  if (route.request().method() === "OPTIONS") {
    return route.fulfill({status:204,headers:corsHeaders,body:""});
  }
  let body = {};
  if (path.includes("/auth/v1/token")) body = session;
  else if (path.includes("/auth/v1/user")) body = user;
  else if (path.includes("/rest/v1/rpc/get_my_access_context")) body = { staff_role:null, admin_departments:[], is_student:true, is_recruiter:false, is_pending_recruiter:false };
  else if (path.includes("/rest/v1/rpc/my_reskonnect_command_centre")) body = { profile, living:{application_count:1,approved_count:0,recent:[{...application,residence_name:residence.name}]}, timeline:[], notifications:[] };
  else if (path.includes("/rest/v1/rpc/my_reskonnect_service_centre")) body = { open_count:0, requests:[] };
  else if (path.includes("/rest/v1/rpc/reskonnect_opportunity_feed")) body = { items:[{id:"opp-1",title:"Fixture Opportunity",organisation:"ResKonnect",to_path:"/opportunities",match_reason:"Fixture"}] };
  else if (path.includes("/rest/v1/rpc/virtual_tour_public_snapshot")) body = tourSnapshot;
  else if (path.includes("/rest/v1/rpc/record_virtual_tour_event")) body = true;
  else if (path.includes("/rest/v1/residences")) body = [residence];
  else if (path.includes("/rest/v1/residence_room_types")) body = [];
  else if (path.includes("/rest/v1/applications")) body = [application];
  else if (path.includes("/rest/v1/documents")) body = [];
  else if (path.includes("/rest/v1/profiles")) body = route.request().headers().accept?.includes("object") ? profile : [profile];
  else if (path.includes("/rest/v1/resmap_campuses")) body = [{id:"c1",campus_key:"pretoria-west",name:"Pretoria West (Main Campus)",latitude:-25.754,longitude:28.188,is_active:true}];
  else if (path.includes("/rest/v1/resmap_map_config")) body = { google_maps_enabled:false, raster_primary_url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png", raster_fallback_url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png" };
  else if (path.includes("/rest/v1/")) body = path.includes("/rpc/") ? {} : [];
  return route.fulfill({
    status:200,
    contentType:"application/json",
    headers:corsHeaders,
    body:JSON.stringify(body)
  });
}

async function assertNoOverflow(page, label) {
  const dims = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(dims.html <= dims.viewport + 3, `${label}: html overflow ${JSON.stringify(dims)}`);
  assert.ok(dims.body <= dims.viewport + 3, `${label}: body overflow ${JSON.stringify(dims)}`);
}

try {
  for (const p of profiles) {
    const browser = await p.engine.launch({ headless:true });
    try {
      const context = await browser.newContext({
        viewport:p.viewport,
        isMobile:p.mobile,
        userAgent:p.ua,
        locale:"en-ZA",
        serviceWorkers:"block",
      });
      await context.addInitScript(({standalone}) => {
        try { Object.defineProperty(navigator, "standalone", { configurable:true, get:()=>standalone }); } catch {}
      }, { standalone:p.standalone });
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        if (url.hostname.endsWith(".supabase.co")) return fulfillApi(route);
        if (url.hostname.includes("tile.openstreetmap.org") || url.hostname.includes("openstreetmap.fr")) return route.fulfill({status:204,headers:{"access-control-allow-origin":"*"},body:""});
        if (["image","font","media"].includes(route.request().resourceType())) return route.fulfill({status:204,headers:{"access-control-allow-origin":"*"},body:""});
        if (route.request().resourceType()==="script") return route.fulfill({status:200,contentType:"application/javascript",headers:{"access-control-allow-origin":"*"},body:"export {};"});
        if (route.request().resourceType()==="stylesheet") return route.fulfill({status:200,contentType:"text/css",headers:{"access-control-allow-origin":"*"},body:""});
        return route.fulfill({status:204,headers:{"access-control-allow-origin":"*"},body:""});
      });

      let page = await context.newPage();
      const errors=[];
      page.on("pageerror", e=>errors.push(e.message));

      // Real form login on each target profile.
      await page.goto(origin+"/auth", {waitUntil:"domcontentloaded"});
      await page.getByLabel("Email address *").fill(user.email);
      await page.getByLabel("Password *", {exact:true}).fill("FixturePassword123");
      await page.getByRole("button",{name:"Sign In",exact:true}).click();
      await page.waitForURL("**/dashboard");
      await page.getByText("Good to see you, Cross.").waitFor({timeout:15000});
      assert.equal(errors.length,0,`${p.name} login: ${errors.join("; ")}`);
      console.log("PASS",p.name,"login");

      // Session survives reload and close/reopen.
      await page.reload({waitUntil:"domcontentloaded"});
      await page.getByText("Good to see you, Cross.").waitFor({timeout:15000});
      await page.close();
      page=await context.newPage();
      page.on("pageerror",e=>errors.push(e.message));
      await page.goto(origin+"/dashboard",{waitUntil:"domcontentloaded"});
      await page.getByText("Good to see you, Cross.").waitFor({timeout:15000});
      console.log("PASS",p.name,"session persistence");

      for (const routePath of ["/dashboard","/findmyres","/my-applications","/opportunities","/profile"]) {
        errors.length=0;
        await page.goto(origin+routePath,{waitUntil:"domcontentloaded"});
        await page.waitForTimeout(600);
        assert.equal(await page.getByText("Something went wrong",{exact:true}).count(),0,`${p.name} ${routePath}: error boundary`);
        assert.equal(errors.length,0,`${p.name} ${routePath}: ${errors.join("; ")}`);
        await assertNoOverflow(page,`${p.name} ${routePath}`);
        console.log("PASS",p.name,routePath);
      }

      // Open the full map overlay. Google 3D is disabled by fixture config so the
      // deterministic raster/fallback path must remain functional.
      errors.length=0;
      await page.goto(origin+"/findmyres?view=map",{waitUntil:"domcontentloaded"});
      await page.getByText("ResMap",{exact:true}).first().waitFor({timeout:15000});
      assert.equal(await page.getByText("Something went wrong",{exact:true}).count(),0,`${p.name} map: error boundary`);
      assert.equal(errors.length,0,`${p.name} map: ${errors.join("; ")}`);
      console.log("PASS",p.name,"ResMap");

      // Exercise the actual 360 viewer/WebGL path on browser engines.
      errors.length=0;
      await page.goto(origin+"/tour/fixture-token",{waitUntil:"domcontentloaded"});
      await page.getByText("Fixture 360",{exact:false}).first().waitFor({timeout:15000});
      await page.waitForTimeout(700);
      assert.equal(await page.getByText("Virtual view unavailable",{exact:true}).count(),0,`${p.name}: 360 snapshot unavailable`);
      assert.equal(await page.getByText("Something went wrong",{exact:true}).count(),0,`${p.name}: 360 error boundary`);
      assert.equal(errors.length,0,`${p.name} 360: ${errors.join("; ")}`);
      console.log("PASS",p.name,"360 viewer");

      // Offline in the already-loaded installed app retains the session and surfaces status.
      await page.goto(origin+"/dashboard",{waitUntil:"domcontentloaded"});
      await context.setOffline(true);
      await page.waitForTimeout(250);
      await page.getByText("You're offline.",{exact:false}).waitFor({timeout:5000});
      assert.ok(await page.evaluate(key=>Boolean(localStorage.getItem(key)),storageKey),`${p.name}: session disappeared offline`);
      await context.setOffline(false);
      await page.waitForTimeout(500);
      assert.equal(await page.getByText("You're offline.",{exact:false}).count(),0,`${p.name}: offline banner remained after reconnect`);
      console.log("PASS",p.name,"offline/reconnect");

      await context.close();

      // Playwright only exposes/automates service workers on Chromium-based
      // browsers. WebKit profiles still cover Safari layout, auth, session
      // persistence, map/360 and online/offline transitions above. The actual
      // iOS/macOS service-worker lifecycle remains a physical Safari acceptance
      // check instead of a false automated assertion.
      if (p.engine === chromium) {
        const pwaContext = await browser.newContext({
          viewport:p.viewport,
          isMobile:p.mobile,
          userAgent:p.ua,
          locale:"en-ZA",
          serviceWorkers:"allow",
        });
        await pwaContext.addInitScript(({standalone}) => {
          try { Object.defineProperty(navigator, "standalone", { configurable:true, get:()=>standalone }); } catch {}
        }, { standalone:p.standalone });
        await pwaContext.route("**/*", async route => {
          const url=new URL(route.request().url());
          if(url.origin===origin) return route.continue();
          if (route.request().resourceType()==="script") return route.fulfill({status:200,contentType:"application/javascript",headers:{"access-control-allow-origin":"*"},body:"export {};"});
          if (route.request().resourceType()==="stylesheet") return route.fulfill({status:200,contentType:"text/css",headers:{"access-control-allow-origin":"*"},body:""});
          return route.fulfill({status:204,headers:{"access-control-allow-origin":"*"},body:""});
        });
        const pwaPage=await pwaContext.newPage();
        await pwaPage.goto(origin+"/install",{waitUntil:"domcontentloaded"});
        await pwaPage.getByRole("heading",{name:"Install ResKonnect"}).waitFor();
        const sw = await pwaPage.evaluate(async () => {
          if (!("serviceWorker" in navigator)) return {supported:false, registrations:0};
          await navigator.serviceWorker.ready;
          const regs=await navigator.serviceWorker.getRegistrations();
          return {supported:true, registrations:regs.length};
        });
        assert.equal(sw.supported,true,`${p.name}: service worker unsupported in Chromium test engine`);
        assert.ok(sw.registrations>=1,`${p.name}: production PWA service worker did not register`);
        // One online reload gives the activated worker control of the page.
        await pwaPage.reload({waitUntil:"domcontentloaded"});
        await pwaPage.getByRole("heading",{name:"Install ResKonnect"}).waitFor();
        await pwaContext.setOffline(true);
        await pwaPage.reload({waitUntil:"domcontentloaded",timeout:15000});
        await pwaPage.getByRole("heading",{name:"Install ResKonnect"}).waitFor({timeout:10000});
        await pwaContext.setOffline(false);
        console.log("PASS",p.name,"production PWA cold offline reload");
        await pwaContext.close();
      } else {
        console.log("SKIP",p.name,"service-worker cold reload: Playwright supports service-worker automation on Chromium only");
      }
    } finally {
      await browser.close();
    }
  }
  console.log(`Cross-platform authenticated matrix passed (${profiles.length} install/device profiles).`);
} finally {
  await new Promise(resolve => server.httpServer?.close(resolve));
}
