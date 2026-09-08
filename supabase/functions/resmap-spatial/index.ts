import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env=(n:string)=>Deno.env.get(n)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const openaiKey=env("OPENAI_API_KEY");
const routineModel=env("OPENAI_ROUTINE_MODEL")||"gpt-5.6-luna";
const ROUTING_BASE=env("RESMAP_ROUTING_BASE_URL")||"https://routing.openstreetmap.de";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});

function validPoint(lat:number,lng:number){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-35.5&&lat<=-21&&lng>=15&&lng<=34;}
function haversine(a:{lat:number,lng:number},b:{lat:number,lng:number}){const R=6371000,toRad=(n:number)=>n*Math.PI/180,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng),la1=toRad(a.lat),la2=toRad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
function estimateSeconds(distance:number,profile:string){const speed=profile==="walk"?1.35:profile==="bike"?4.1:profile==="transport"?7:8.5;return Math.round(distance/speed+(profile==="transport"?300:0));}
async function hash(input:string){const data=new TextEncoder().encode(input);const digest=await crypto.subtle.digest("SHA-256",data);return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2,"0")).join("");}
async function routeKey(profile:string,a:any,b:any){return await hash(`${profile}:${a.lat.toFixed(5)},${a.lng.toFixed(5)}:${b.lat.toFixed(5)},${b.lng.toFixed(5)}`);}

function instructionFor(step:any,index:number,total:number){
  const maneuver=step?.maneuver||{};
  const type=String(maneuver.type||"").toLowerCase();
  const modifier=String(maneuver.modifier||"").toLowerCase();
  const street=String(step?.name||"").trim();
  const onto=street?` onto ${street}`:"";
  if(type==="depart")return street?`Head along ${street}`:"Start on the route";
  if(type==="arrive"||index===total-1)return "Arrive at your destination";
  if(type==="roundabout"||type==="rotary")return `Enter the roundabout${onto}`;
  if(type==="merge")return `Merge${onto}`;
  if(type==="fork")return modifier.includes("left")?`Keep left${onto}`:`Keep right${onto}`;
  if(modifier.includes("uturn"))return `Make a U-turn${onto}`;
  if(modifier.includes("left"))return modifier.includes("slight")?`Bear left${onto}`:`Turn left${onto}`;
  if(modifier.includes("right"))return modifier.includes("slight")?`Bear right${onto}`:`Turn right${onto}`;
  return street?`Continue on ${street}`:"Continue straight";
}

function normalizeSteps(route:any,origin:{lat:number,lng:number},destination:{lat:number,lng:number}){
  const raw=(route?.legs||[]).flatMap((leg:any)=>Array.isArray(leg?.steps)?leg.steps:[]);
  if(!raw.length){
    return [
      {distance_m:0,duration_s:0,name:"",type:"depart",modifier:null,instruction:"Start on the route",bearing_before:null,bearing_after:null,location:{lat:origin.lat,lng:origin.lng}},
      {distance_m:0,duration_s:0,name:"",type:"arrive",modifier:null,instruction:"Arrive at your destination",bearing_before:null,bearing_after:null,location:{lat:destination.lat,lng:destination.lng}},
    ];
  }
  return raw.map((step:any,index:number)=>{
    const maneuver=step?.maneuver||{};
    const location=Array.isArray(maneuver.location)?maneuver.location:[null,null];
    return {
      distance_m:Math.max(0,Math.round(Number(step?.distance)||0)),
      duration_s:Math.max(0,Math.round(Number(step?.duration)||0)),
      name:String(step?.name||""),
      type:String(maneuver.type||"continue"),
      modifier:maneuver.modifier?String(maneuver.modifier):null,
      instruction:instructionFor(step,index,raw.length),
      bearing_before:Number.isFinite(Number(maneuver.bearing_before))?Number(maneuver.bearing_before):null,
      bearing_after:Number.isFinite(Number(maneuver.bearing_after))?Number(maneuver.bearing_after):null,
      location:{lat:Number(location[1]),lng:Number(location[0])},
    };
  }).filter((step:any)=>validPoint(step.location.lat,step.location.lng));
}

async function route(service:any,body:any){
  const origin={lat:Number(body.origin?.lat),lng:Number(body.origin?.lng)};
  const destination={lat:Number(body.destination?.lat),lng:Number(body.destination?.lng)};
  const profile=["walk","bike","drive","transport"].includes(String(body.profile))?String(body.profile):"walk";
  if(!validPoint(origin.lat,origin.lng)||!validPoint(destination.lat,destination.lng))throw new Error("Route coordinates must be valid South African points");
  const key=await routeKey(profile,origin,destination);
  const cached=(await service.from("resmap_route_cache").select("*").eq("route_key",key).gt("expires_at",new Date().toISOString()).maybeSingle()).data;
  if(cached&&Array.isArray(cached.steps)&&cached.steps.length){return {cached:true,profile,distance_m:cached.distance_m,duration_s:cached.duration_s,geometry:cached.geometry,steps:cached.steps,provider:cached.provider};}

  const endpoint=profile==="walk"?"routed-foot":profile==="bike"?"routed-bike":"routed-car";
  const url=`${ROUTING_BASE}/${endpoint}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`;
  let distance=Math.round(haversine(origin,destination));
  let duration=estimateSeconds(distance,profile);
  let geometry:any={type:"LineString",coordinates:[[origin.lng,origin.lat],[destination.lng,destination.lat]]};
  let steps:any[]=normalizeSteps(null,origin,destination);
  let provider="geodesic-fallback";
  try{
    const response=await fetch(url,{headers:{"User-Agent":"ResKonnect-ResMap/2.0 (+https://www.reskonnect.org)","Referer":"https://www.reskonnect.org/"}});
    const data=await response.json().catch(()=>({}));
    const first=data?.routes?.[0];
    if(response.ok&&first?.geometry?.coordinates){
      distance=Math.round(Number(first.distance)||distance);
      duration=Math.round(Number(first.duration)||duration);
      if(profile==="transport")duration+=300;
      geometry=first.geometry;
      steps=normalizeSteps(first,origin,destination);
      provider=`openstreetmap.de/${endpoint}`;
    }
  }catch{/* deterministic route fallback remains */}

  await service.from("resmap_route_cache").upsert({route_key:key,profile,origin_lat:origin.lat,origin_lng:origin.lng,destination_lat:destination.lat,destination_lng:destination.lng,distance_m:distance,duration_s:duration,geometry,steps,provider,expires_at:new Date(Date.now()+7*86400000).toISOString(),updated_at:new Date().toISOString()});
  return {cached:false,profile,distance_m:distance,duration_s:duration,geometry,steps,provider};
}

function extractOutputText(data:any){if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&typeof c.text==="string")return c.text;return "";}
async function allowAi(service:any,req:Request){const forwarded=req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"anonymous";const visitorHash=(await hash(forwarded.split(",")[0].trim())).slice(0,32);const today=new Date().toISOString().slice(0,10);const row=(await service.from("resmap_ai_usage").select("request_count").eq("visitor_hash",visitorHash).eq("usage_day",today).maybeSingle()).data;const count=Number(row?.request_count||0);if(count>=20)return false;await service.from("resmap_ai_usage").upsert({visitor_hash:visitorHash,usage_day:today,request_count:count+1,last_used_at:new Date().toISOString()},{onConflict:"visitor_hash,usage_day"});return true;}

async function aiIntent(service:any,req:Request,query:string){
  if(!openaiKey)throw new Error("AI search is not configured");
  if(!(await allowAi(service,req)))throw new Error("AI map search limit reached for today; use the filters or try again tomorrow");
  const schema={type:"object",additionalProperties:false,properties:{campus:{type:["string","null"]},searchQuery:{type:["string","null"]},nsfasOnly:{type:["boolean","null"]},priceMax:{type:["number","null"]},roomType:{type:["string","null"]},wifiOnly:{type:["boolean","null"]},parkingOnly:{type:["boolean","null"]},availability:{type:["string","null"],enum:["all","available","few_spots",null]},travelMode:{type:["string","null"],enum:["walk","bike","drive","transport",null]},travelTimeMax:{type:["number","null"]},summary:{type:"string"}},required:["campus","searchQuery","nsfasOnly","priceMax","roomType","wifiOnly","parkingOnly","availability","travelMode","travelTimeMax","summary"]};
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openaiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:routineModel,store:false,reasoning:{effort:"none"},max_output_tokens:300,instructions:"Extract student-accommodation map filters only. Do not invent residence facts. Campus should be a concise campus/area phrase from the user's text. Use null when absent. South African context. Return one brief summary of the interpreted search.",input:query,text:{format:{type:"json_schema",name:"resmap_filters",strict:true,schema}}})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||`OpenAI HTTP ${response.status}`);
  const text=extractOutputText(data);if(!text)throw new Error("AI search returned no filter result");
  return JSON.parse(text);
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey)return json({error:"Supabase runtime is not configured"},500);
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  const body=await req.json().catch(()=>({}));
  try{
    const action=String(body.action||"");
    if(action==="route")return json({ok:true,...await route(service,body)});
    if(action==="ai_intent"){const query=String(body.query||"").trim().slice(0,500);if(query.length<3)return json({error:"Search query is too short"},400);return json({ok:true,filters:await aiIntent(service,req,query)});}
    if(action==="transport_routes"){const rows=await service.from("resmap_transport_routes").select("*").eq("is_active",true).eq("is_verified",true);return json({ok:true,routes:rows.data||[]});}
    return json({error:"Unsupported action"},400);
  }catch(error){return json({error:error instanceof Error?error.message:String(error)},400);}
});