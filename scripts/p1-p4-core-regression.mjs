// P1-P4 deterministic native core regression. Never uses a real account or writes live user data.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "vite";

const origin = "http://127.0.0.1:8093";
const server = await createServer({ server: { host: "127.0.0.1", port: 8093 } });
await server.listen();

const storageKey = "sb-mefjzkhobkltlbmhusdh-auth-token";
const user = {
  id: "51000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "core-fixture@example.invalid",
  user_metadata: { full_name: "Core Stability Student" },
  app_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const token = [
  Buffer.from("{}").toString("base64url"),
  Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url"),
  "fixture",
].join(".");
const session = { access_token:token, refresh_token:"fixture-refresh", token_type:"bearer", expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user };
const profile = { id:user.id, full_name:"Core Stability Student", phone:"0820000000", student_number:"CORE001", campus:"Pretoria West (Main Campus)", course:"Marketing", year_of_study:"3", applicant_stage:"university_student" };
const residence = {
  id:"52000000-0000-4000-8000-000000000001",
  slug:"core-stability-residence",
  name:"Core Stability Residence",
  address:"1 Fixture Street, Pretoria",
  city:"Pretoria",
  province:"Gauteng",
  campus:"Pretoria West (Main Campus)",
  description:"Deterministic accommodation fixture",
  price:3500,
  private_price:3500,
  available_spots:5,
  capacity:20,
  is_visible:true,
  latitude:-25.754,
  longitude:28.188,
  room_type:"single",
  room_types:["single"],
  amenities:["Wi-Fi"],
  images:[],
  image_url:null,
};
const application = { id:"53000000-0000-4000-8000-000000000001", user_id:user.id, residence_id:residence.id, status:"submitted", institution_type:"university", created_at:"2026-09-20T10:00:00Z" };
const opportunity = {
  id:"54000000-0000-4000-8000-000000000001",
  source_type:"public_opportunity",
  slug:"core-fixture-opportunity",
  to_path:"/opportunities",
  title:"Core Fixture Opportunity",
  opportunity_type:"internship",
  organisation:"ResKonnect QA",
  location:"Pretoria",
  province:"Gauteng",
  description:"Deterministic opportunity fixture",
  requirements:"Fixture",
  application_url:null,
  closing_date:"2026-12-31",
  employment_type:"internship",
  last_verified_at:"2026-09-29T00:00:00Z",
  verification_state:"verified",
  match_score:92,
  match_reason:"Core route fixture",
  user_action:null,
  metadata:{},
};
const tourSnapshot = {
  tour:{id:"55000000-0000-4000-8000-000000000001",title:"Core Fixture 360",workspace_type:"standalone"},
  workspace:{type:"standalone",label:"Core Fixture 360"},
  residence:null,
  scenes:[{id:"56000000-0000-4000-8000-000000000001",name:"Room",area_type:"room",is_start:true,panorama_url:"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='8'%3E%3Crect width='16' height='8' fill='%23111'/%3E%3C/svg%3E",quality_score:90}],
  hotspots:[],
  connections:[],
};

const failure = {
  accessOnce:false,
  dashboardOnce:false,
  residencesOnce:false,
  applicationDetailsOnce:false,
  opportunitiesOnce:false,
};

function json(route, body, status=200) {
  return route.fulfill({ status, contentType:"application/json", body:JSON.stringify(body) });
}

async function api(route) {
  const req=route.request();
  const url=new URL(req.url());
  const path=url.pathname;
  const accept=req.headers().accept || "";

  if (path.includes("/auth/v1/token")) return json(route,session);
  if (path.includes("/auth/v1/user")) return json(route,user);
  if (path.includes("/rest/v1/rpc/get_my_access_context")) {
    if (failure.accessOnce) { failure.accessOnce=false; return json(route,{message:"fixture access outage"},503); }
    return json(route,{staff_role:null,admin_departments:[],is_student:true,is_recruiter:false,is_pending_recruiter:false,is_tumelo_partner:false});
  }
  if (path.includes("/rest/v1/rpc/my_reskonnect_command_centre")) {
    if (failure.dashboardOnce) { failure.dashboardOnce=false; return json(route,{message:"fixture dashboard outage"},503); }
    return json(route,{profile,living:{application_count:1,approved_count:0,recent:[{...application,residence_name:residence.name}]},timeline:[],notifications:[]});
  }
  if (path.includes("/rest/v1/rpc/my_reskonnect_service_centre")) return json(route,{open_count:0,requests:[]});
  if (path.includes("/rest/v1/rpc/reskonnect_opportunity_feed")) {
    if (failure.opportunitiesOnce) { failure.opportunitiesOnce=false; return json(route,{message:"fixture opportunity outage"},503); }
    return json(route,{items:[opportunity],profile_context:{course:profile.course,campus:profile.campus}});
  }
  if (path.includes("/rest/v1/rpc/virtual_tour_public_snapshot")) return json(route,tourSnapshot);
  if (path.includes("/rest/v1/rpc/record_virtual_tour_event")) return json(route,true);
  if (path.includes("/rest/v1/residence_room_types")) return json(route,[]);
  if (path.includes("/rest/v1/residence_room_pricing_public_v")) return json(route,[]);
  if (path.includes("/rest/v1/reviews")) return json(route,[]);
  if (path.includes("/rest/v1/resmap_campuses")) return json(route,[{id:"c1",campus_key:"pretoria-west",name:"Pretoria West (Main Campus)",short_name:"Pretoria West",aliases:[],latitude:-25.754,longitude:28.188,is_active:true}]);
  if (path.includes("/rest/v1/resmap_map_config")) return json(route,{google_maps_enabled:false,raster_primary_url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",raster_fallback_url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png"});
  if (path.includes("/rest/v1/applications")) return json(route,[application]);
  if (path.includes("/rest/v1/documents")) return json(route,[]);
  if (path.includes("/rest/v1/profiles")) return json(route,accept.includes("object") ? profile : [profile]);
  if (path.includes("/rest/v1/residences")) {
    if (failure.residencesOnce) { failure.residencesOnce=false; return json(route,{message:"fixture residence outage"},503); }
    if (failure.applicationDetailsOnce) { failure.applicationDetailsOnce=false; return json(route,{message:"fixture application residence outage"},503); }
    return json(route,accept.includes("object") ? residence : [residence]);
  }
  if (path.includes("/rest/v1/mobile_runtime_events")) return json(route,[]);
  if (path.includes("/rest/v1/")) return json(route,path.includes("/rpc/") ? {} : []);
  if (path.includes("/functions/v1/")) return json(route,{ok:false,error:"fixture function unavailable"});
  return json(route,{});
}

const browser=await chromium.launch({headless:true});
try {
  const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,serviceWorkers:"block",locale:"en-ZA"});
  await context.routeWebSocket("**/*",socket=>socket.close());
  await context.addInitScript(()=>{ window.Capacitor={isNativePlatform:()=>true}; });
  await context.route("**/*",async route=>{
    const url=new URL(route.request().url());
    if(url.origin===origin)return route.continue();
    if(url.hostname.endsWith(".supabase.co"))return api(route);
    if(url.hostname.includes("tile.openstreetmap.org"))return route.fulfill({status:204,body:""});
    if(["image","font","media"].includes(route.request().resourceType()))return route.fulfill({status:204,body:""});
    return route.abort();
  });

  let page=await context.newPage();
  let pageErrors=[];
  const observe=(p)=>p.on("pageerror",e=>pageErrors.push(e.message));
  observe(page);

  await page.goto(origin+"/auth");
  await page.getByLabel("Email address *").fill(user.email);
  await page.getByLabel("Password *",{exact:true}).fill("FixturePassword123");

  // First authenticated access lookup fails: Auth must remain fail-closed and
  // expose recovery before any account-specific redirect occurs.
  failure.accessOnce=true;
  await page.getByRole("button",{name:"Sign In",exact:true}).click();
  await page.getByText("We couldn't verify your ResKonnect account access.",{exact:true}).waitFor({timeout:15000});
  assert.ok(page.url().endsWith("/auth"),"auth page redirected before access verification");
  await page.getByRole("button",{name:"Retry account check"}).click();
  await page.waitForURL("**/dashboard");
  await page.getByText("Good to see you, Core.").waitFor({timeout:15000});
  assert.deepEqual(pageErrors,[]);
  console.log("PASS login access outage recovery and dashboard");

  await page.reload();
  await page.getByText("Good to see you, Core.").waitFor({timeout:15000});
  await page.close();
  page=await context.newPage(); observe(page);
  await page.goto(origin+"/dashboard");
  await page.getByText("Good to see you, Core.").waitFor({timeout:15000});
  assert.ok(await page.evaluate(key=>Boolean(localStorage.getItem(key)),storageKey));
  console.log("PASS persisted session reload and close/reopen");

  // A transient access-context failure must fail closed with an immediate retry,
  // not expose the wrong account surface or leave a permanent loader.
  failure.accessOnce=true;
  await page.goto(origin+"/dashboard",{waitUntil:"domcontentloaded"});
  await page.getByText("We couldn't verify your ResKonnect account access.",{exact:true}).waitFor({timeout:15000});
  assert.equal(await page.getByText("Good to see you, Core.",{exact:true}).count(),0,"dashboard rendered before access was verified");
  await page.getByRole("button",{name:"Retry account check"}).click();
  await page.getByText("Good to see you, Core.").waitFor({timeout:15000});
  console.log("PASS access-context outage fail-closed and retry");

  const routes=[
    ["/dashboard","Good to see you, Core."],
    ["/findmyres",residence.name],
    [`/res/${residence.id}`,residence.name],
    ["/my-applications","My Applications"],
    ["/applications","Applications"],
    ["/opportunities",opportunity.title],
    ["/wil","WIL"],
    ["/bursaries","Bursar"],
    ["/profile","Profile"],
    ["/documents","Document"],
    ["/messages","Message"],
    ["/favorites","Favorite"],
    ["/dashboard/services","Service"],
    ["/ai","ResKonnect"],
    ["/portals","ResKonnect portals"],
  ];

  for (const [routePath,textNeedle] of routes) {
    pageErrors=[];
    await page.goto(origin+routePath,{waitUntil:"domcontentloaded"});
    await page.waitForTimeout(500);
    assert.equal(await page.getByText("Something went wrong",{exact:true}).count(),0,`${routePath}: error boundary`);
    assert.equal(pageErrors.length,0,`${routePath}: ${pageErrors.join("; ")}`);
    const body=(await page.locator("body").innerText()).toLowerCase();
    assert.ok(body.includes(String(textNeedle).toLowerCase()),`${routePath}: expected visible text containing "${textNeedle}"`);
    console.log("PASS core route",routePath);
  }

  // Dashboard partial backend failure is contained and manual refresh recovers the user context.
  failure.dashboardOnce=true;
  await page.goto(origin+"/dashboard");
  await page.getByText("Good to see you, Student.").waitFor({timeout:15000});
  await page.getByRole("button",{name:"Refresh journey"}).click();
  await page.getByText("Good to see you, Core.").waitFor({timeout:15000});
  console.log("PASS dashboard partial outage recovery");

  // Find My Res exposes its own query failure and retry rather than staying on skeletons.
  await page.evaluate(()=>localStorage.removeItem("rk_public_residences_cache_v1"));
  failure.residencesOnce=true;
  await page.goto(origin+"/findmyres");
  await page.getByText("Accommodation connection needs attention").waitFor({timeout:15000});
  await page.getByRole("button",{name:"Retry live data"}).click();
  await page.getByText(residence.name,{exact:false}).first().waitFor({timeout:15000});
  console.log("PASS Find My Res failure/retry");

  // Applications exposes residence-enrichment failure and recovers without losing the base application.
  failure.applicationDetailsOnce=true;
  await page.goto(origin+"/my-applications");
  await page.getByText("Applications need a connection refresh").waitFor({timeout:15000});
  await page.getByRole("button",{name:"Try again"}).click();
  await page.getByText(residence.name,{exact:false}).first().waitFor({timeout:15000});
  console.log("PASS Applications failure/retry");

  // Opportunities must not remain in an endless spinner after RPC failure.
  failure.opportunitiesOnce=true;
  await page.goto(origin+"/opportunities");
  await page.getByText("Opportunity feed needs a refresh").waitFor({timeout:15000});
  await page.getByRole("button",{name:"Try again"}).click();
  await page.getByText(opportunity.title,{exact:false}).first().waitFor({timeout:15000});
  console.log("PASS Opportunities failure/retry");

  // Native map opens the safe 2D path; 3D remains optional.
  pageErrors=[];
  await page.goto(origin+"/findmyres?view=map");
  await page.getByText("ResMap",{exact:true}).first().waitFor({timeout:15000});
  assert.equal(await page.getByText("Something went wrong",{exact:true}).count(),0);
  assert.deepEqual(pageErrors,[],"native ResMap emitted a page error");
  console.log("PASS native ResMap safe surface");

  // Safe-graphics mode proves a renderer-recovery path can still show 360 content without WebGL.
  await page.evaluate(()=>localStorage.setItem("rk_native_safe_graphics_v1","1"));
  pageErrors=[];
  await page.goto(origin+"/tour/core-fixture");
  await page.getByText("Immersive 360 is paused on this device",{exact:false}).waitFor({timeout:15000});
  assert.deepEqual(pageErrors,[],"native safe 360 emitted a page error");
  console.log("PASS native 360 safe-graphics fallback");

  // Offline/reconnect preserves the authenticated local session. Wait for the
  // dev-server lazy Dashboard module before cutting network; production native
  // chunks are packaged locally and are not fetched from the network.
  pageErrors=[];
  await page.goto(origin+"/dashboard");
  await page.getByText("Good to see you, Core.").waitFor({timeout:15000});
  assert.deepEqual(pageErrors,[],"dashboard did not finish loading before offline simulation");
  await context.setOffline(true);
  await page.getByText("You're offline.",{exact:false}).waitFor({timeout:5000});
  assert.ok(await page.evaluate(key=>Boolean(localStorage.getItem(key)),storageKey));
  await context.setOffline(false);
  await page.waitForTimeout(500);
  assert.equal(await page.getByText("You're offline.",{exact:false}).count(),0);
  console.log("PASS offline/reconnect session preservation");

  assert.deepEqual(pageErrors,[],"offline/reconnect produced an unexpected runtime error");
  await context.close();
  console.log("P1-P4 native core regression passed.");
} finally {
  await browser.close();
  await server.close();
}
