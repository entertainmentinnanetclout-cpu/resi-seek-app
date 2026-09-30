// P10 deterministic Android compatibility matrix. Browser-level simulation only:
// physical OEM/GPU/Android Vitals acceptance remains a Play/internal-test step.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "vite";

const origin="http://127.0.0.1:8095";
const server=await createServer({server:{host:"127.0.0.1",port:8095}});
await server.listen();

const user={id:"91000000-0000-4000-8000-000000000001",aud:"authenticated",role:"authenticated",email:"device-matrix@example.invalid",user_metadata:{full_name:"Device Matrix Student"},app_metadata:{},created_at:"2026-01-01T00:00:00Z"};
const token=[Buffer.from("{}").toString("base64url"),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString("base64url"),"fixture"].join(".");
const session={access_token:token,refresh_token:"fixture-refresh",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const storageKey="sb-mefjzkhobkltlbmhusdh-auth-token";
const profile={id:user.id,full_name:"Device Matrix Student",phone:"0820000000",student_number:"DEVICE001",campus:"Pretoria West (Main Campus)",course:"Marketing",year_of_study:"3",applicant_stage:"university_student"};
const residence={id:"92000000-0000-4000-8000-000000000001",slug:"device-fixture-residence",name:"Device Fixture Residence",address:"Pretoria",campus:"Pretoria West (Main Campus)",price:3500,private_price:3500,available_spots:5,is_visible:true,latitude:-25.754,longitude:28.188,room_type:"single",images:[],image_url:null};
const tour={tour:{id:"93000000-0000-4000-8000-000000000001",title:"Native Device Fixture 360",workspace_type:"standalone"},workspace:{type:"standalone",label:"Native Device Fixture 360"},residence:null,scenes:[{id:"94000000-0000-4000-8000-000000000001",name:"Room",area_type:"room",is_start:true,panorama_url:"data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2216%22%3E%3Crect width=%2232%22 height=%2216%22 fill=%22%23111%22/%3E%3C/svg%3E",quality_score:90}],hotspots:[],connections:[]};

const profiles=[
  {name:"huawei-low-memory",viewport:{width:360,height:780},memory:3,cores:4,ua:"Mozilla/5.0 (Linux; Android 10; MAR-LX1A; HUAWEI) AppleWebKit/537.36 Chrome/114.0 Mobile Safari/537.36",safe:true},
  {name:"samsung-midrange",viewport:{width:412,height:915},memory:4,cores:8,ua:"Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36",safe:true},
  {name:"android-low-memory",viewport:{width:320,height:640},memory:2,cores:4,ua:"Mozilla/5.0 (Linux; Android 11; Generic) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",safe:true},
  {name:"android-tablet",viewport:{width:800,height:1280},memory:6,cores:8,ua:"Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 Chrome/136.0 Safari/537.36",safe:false},
  {name:"android-api24-floor",viewport:{width:393,height:786},memory:3,cores:4,ua:"Mozilla/5.0 (Linux; Android 7.0; Nexus 5X) AppleWebKit/537.36 Chrome/100.0 Mobile Safari/537.36",safe:true},
  {name:"android-current",viewport:{width:412,height:915},memory:8,cores:8,ua:"Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36",safe:false},
];

function json(route,body,status=200){return route.fulfill({status,contentType:"application/json",headers:{"access-control-allow-origin":origin,"access-control-allow-headers":"*"},body:JSON.stringify(body)});}
async function api(route){
  const url=new URL(route.request().url()), path=url.pathname;
  if(path.includes("/auth/v1/user"))return json(route,user);
  if(path.includes("/auth/v1/token"))return json(route,session);
  if(path.includes("/rest/v1/rpc/get_my_access_context"))return json(route,{staff_role:null,admin_departments:[],is_student:true});
  if(path.includes("/rest/v1/rpc/my_reskonnect_command_centre"))return json(route,{profile,living:{application_count:0,approved_count:0,recent:[]},timeline:[],notifications:[]});
  if(path.includes("/rest/v1/rpc/virtual_tour_public_snapshot"))return json(route,tour);
  if(path.includes("/rest/v1/rpc/record_virtual_tour_event"))return json(route,true);
  if(path.includes("/rest/v1/residences"))return json(route,[residence]);
  if(path.includes("/rest/v1/residence_room_types"))return json(route,[]);
  if(path.includes("/rest/v1/resmap_campuses"))return json(route,[{id:"c1",campus_key:"pretoria-west",name:"Pretoria West (Main Campus)",latitude:-25.754,longitude:28.188,is_active:true}]);
  if(path.includes("/rest/v1/resmap_map_config"))return json(route,{google_maps_enabled:false,raster_primary_url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",raster_fallback_url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png"});
  if(path.includes("/rest/v1/"))return json(route,path.includes("/rpc/")?{}:[]);
  return json(route,{});
}

const browser=await chromium.launch({headless:true});
const failures=[];
try{
  for(const p of profiles){
    const context=await browser.newContext({viewport:p.viewport,isMobile:true,hasTouch:true,userAgent:p.ua,locale:"en-ZA",serviceWorkers:"block",geolocation:{latitude:-25.754,longitude:28.188}});
    await context.routeWebSocket("**/*",socket=>socket.close());
    await context.addInitScript(({memory,cores,key,value,safe})=>{
      window.Capacitor={isNativePlatform:()=>true};
      try{Object.defineProperty(navigator,"deviceMemory",{configurable:true,get:()=>memory});}catch{}
      try{Object.defineProperty(navigator,"hardwareConcurrency",{configurable:true,get:()=>cores});}catch{}
      localStorage.setItem(key,JSON.stringify(value));
      if(safe)localStorage.setItem("rk_native_safe_graphics_v1","1");
      else localStorage.removeItem("rk_native_safe_graphics_v1");
    },{memory:p.memory,cores:p.cores,key:storageKey,value:session,safe:p.safe});
    await context.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin)return route.continue();
      if(url.hostname.endsWith(".supabase.co"))return api(route);
      if(url.hostname.includes("tile.openstreetmap.org"))return route.fulfill({status:204,body:""});
      if(["image","font","media"].includes(route.request().resourceType()))return route.fulfill({status:204,body:""});
      if(route.request().resourceType()==="script")return route.fulfill({status:200,contentType:"application/javascript",body:"export {};"});
      if(route.request().resourceType()==="stylesheet")return route.fulfill({status:200,contentType:"text/css",body:""});
      return route.fulfill({status:204,body:""});
    });

    let page=await context.newPage(); const errors=[]; page.on("pageerror",e=>errors.push(e.message));
    try{
      await page.goto(origin+"/dashboard",{waitUntil:"domcontentloaded"});
      await page.getByText("Good to see you, Device.").waitFor({timeout:15000});
      assert.equal(errors.length,0,`${p.name}: dashboard errors ${errors.join("; ")}`);

      await page.setViewportSize({width:p.viewport.height,height:p.viewport.width});
      await page.waitForTimeout(150);
      await page.setViewportSize(p.viewport);
      assert.equal(await page.getByText("Something went wrong",{exact:true}).count(),0,`${p.name}: rotation error boundary`);
      console.log("PASS",p.name,"portrait/landscape");

      await page.goto(origin+"/findmyres",{waitUntil:"domcontentloaded"});
      await page.getByText(residence.name,{exact:false}).first().waitFor({timeout:15000});
      await context.clearPermissions();
      const enable=page.getByRole("button",{name:/Enable location/});
      if(await enable.count()) {
        await enable.click();
        await page.getByText(/Allow location|could not obtain|Location is unavailable/i).waitFor({timeout:5000}).catch(()=>{});
        await context.grantPermissions(["geolocation"],{origin});
        await enable.click().catch(()=>{});
        await page.getByText(/Live location on/i).waitFor({timeout:5000}).catch(()=>{});
      }
      assert.equal(await page.getByText("Something went wrong",{exact:true}).count(),0,`${p.name}: location flow`);
      console.log("PASS",p.name,"location denied/granted containment");

      for(let i=0;i<3;i++){
        await page.goto(origin+"/tour/device-fixture",{waitUntil:"domcontentloaded"});
        await page.getByText("Native Device Fixture 360",{exact:false}).first().waitFor({timeout:10000});
        assert.equal(await page.getByText("Something went wrong",{exact:true}).count(),0,`${p.name}: 360 iteration ${i+1}`);
        await page.goto(origin+"/dashboard",{waitUntil:"domcontentloaded"});
        await page.getByText("Good to see you, Device.").waitFor({timeout:10000});
      }
      if(p.safe) await page.getByText("Good to see you, Device.").waitFor();
      console.log("PASS",p.name,"repeated 360/navigation");

      await context.setOffline(true);
      await page.getByText("You're offline.",{exact:false}).waitFor({timeout:5000});
      assert.ok(await page.evaluate(key=>Boolean(localStorage.getItem(key)),storageKey),`${p.name}: session lost offline`);
      await context.setOffline(false);
      await page.getByText("You're offline.",{exact:false}).waitFor({state:"detached",timeout:5000});
      await page.evaluate(()=>{window.dispatchEvent(new CustomEvent("rk-network-degraded"));window.dispatchEvent(new Event("visibilitychange"));});
      await page.getByText(/slow or unstable/i).waitFor({timeout:5000});
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent("rk-network-recovered")));
      await page.getByText(/slow or unstable/i).waitFor({state:"detached",timeout:5000});
      console.log("PASS",p.name,"offline/reconnect/network transition");

      await page.close();
      page=await context.newPage(); page.on("pageerror",e=>errors.push(e.message));
      await page.goto(origin+"/dashboard",{waitUntil:"domcontentloaded"});
      await page.getByText("Good to see you, Device.").waitFor({timeout:15000});
      assert.ok(await page.evaluate(key=>Boolean(localStorage.getItem(key)),storageKey),`${p.name}: session missing after reopen`);
      assert.equal(errors.length,0,`${p.name}: reopen errors ${errors.join("; ")}`);
      console.log("PASS",p.name,"close/reopen session");
    }catch(error){
      failures.push({profile:p.name,message:error instanceof Error?error.stack||error.message:String(error)});
      console.error("FAIL",p.name,failures.at(-1).message);
    }finally{await page.close().catch(()=>{});await context.close();}
  }
}finally{await browser.close();await server.close();}

if(failures.length){console.error(JSON.stringify(failures,null,2));throw new Error(`P10 Android compatibility failed for ${failures.length} profile(s)`);}
console.log(`P10 Android compatibility matrix passed (${profiles.length} profiles).`);
