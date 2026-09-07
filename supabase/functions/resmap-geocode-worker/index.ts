import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env=(n:string)=>Deno.env.get(n)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const NOMINATIM_BASE=env("RESMAP_GEOCODER_BASE_URL")||"https://nominatim.openstreetmap.org";
const GOOGLE_MAPS_API_KEY=env("GOOGLE_MAPS_API_KEY");
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const sleep=(ms:number)=>new Promise((resolve)=>setTimeout(resolve,ms));

async function authorized(req:Request,service:any){
  const token=req.headers.get("x-resmap-cron-token")||"";
  if(!token)return false;
  const row=await service.from("adminos_scheduler_secrets").select("secret_value").eq("secret_key","resmap_geocode_worker").maybeSingle();
  const expected=String(row.data?.secret_value||"");
  if(!expected||token.length!==expected.length)return false;
  let diff=0;for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^expected.charCodeAt(i);return diff===0;
}

function validZA(lat:number,lng:number){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-35.2&&lat<=-21.5&&lng>=15.5&&lng<=33.5;}

async function googleGeocode(query:string){
  if(!GOOGLE_MAPS_API_KEY)return null;
  const url=new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address",query);
  url.searchParams.set("region","za");
  url.searchParams.set("key",GOOGLE_MAPS_API_KEY);
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Google geocoder HTTP ${response.status}`);
  const body=await response.json();
  if(body?.status==="ZERO_RESULTS")return null;
  if(body?.status!=="OK")throw new Error(`Google geocoder ${body?.status||"error"}`);
  const row=body?.results?.[0];
  if(!row)return null;
  const lat=Number(row.geometry?.location?.lat),lng=Number(row.geometry?.location?.lng);
  if(!validZA(lat,lng))throw new Error("Google geocoder returned coordinates outside South Africa");
  const type=String(row.geometry?.location_type||"APPROXIMATE");
  const confidence=type==="ROOFTOP"?0.99:type==="RANGE_INTERPOLATED"?0.9:type==="GEOMETRIC_CENTER"?0.78:0.62;
  const accuracy=type==="ROOFTOP"?12:type==="RANGE_INTERPOLATED"?60:type==="GEOMETRIC_CENTER"?180:650;
  return {lat,lng,display_name:String(row.formatted_address||query),confidence,accuracy,source:"google_maps",location_type:type};
}

async function nominatimGeocode(query:string){
  const url=new URL("/search",NOMINATIM_BASE);
  url.searchParams.set("format","jsonv2");
  url.searchParams.set("limit","1");
  url.searchParams.set("countrycodes","za");
  url.searchParams.set("addressdetails","1");
  url.searchParams.set("q",query);
  const response=await fetch(url,{headers:{"User-Agent":"ResKonnect-ResMap/2.0 (+https://www.reskonnect.org)","Referer":"https://www.reskonnect.org/"}});
  if(!response.ok)throw new Error(`Geocoder HTTP ${response.status}`);
  const rows=await response.json();
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row)return null;
  const lat=Number(row.lat),lng=Number(row.lon);
  if(!validZA(lat,lng))throw new Error("Geocoder returned coordinates outside South Africa");
  const confidence=Math.max(0.35,Math.min(0.92,Number(row.importance||0.5)+0.18));
  return {lat,lng,display_name:String(row.display_name||query),confidence,accuracy:confidence>0.8?80:confidence>0.65?250:750,source:"nominatim_osm",location_type:row.type||null};
}

async function geocode(query:string){
  if(GOOGLE_MAPS_API_KEY){
    const google=await googleGeocode(query);
    if(google)return google;
  }
  return await nominatimGeocode(query);
}

async function entityContext(service:any,item:any){
  if(item.entity_type==="residence"){
    return (await service.from("residences").select("id,name,address,canonical_address,canonical_city,canonical_province,campus,city,province").eq("id",item.entity_id).maybeSingle()).data;
  }
  return (await service.from("resmap_campuses").select("id,name,address,search_query,short_name").eq("id",item.entity_id).maybeSingle()).data;
}

function queryForAttempt(item:any,row:any){
  const attempt=Number(item.attempts||0);
  if(item.entity_type==="campus")return String(row?.search_query||[row?.name,row?.address,"South Africa"].filter(Boolean).join(", "));
  const address=String(row?.canonical_address||row?.address||"").trim();
  const city=String(row?.canonical_city||row?.city||"").trim();
  const province=String(row?.canonical_province||row?.province||"").trim();
  const name=String(row?.name||"").trim();
  const campus=String(row?.campus||"").trim();
  if(attempt<=0)return [address,city,province,"South Africa"].filter(Boolean).join(", ");
  if(attempt===1)return [address,city,"South Africa"].filter(Boolean).join(", ");
  if(attempt===2)return [name,address,city,"South Africa"].filter(Boolean).join(", ");
  return [name,campus,city,province,"South Africa"].filter(Boolean).join(", ");
}

const CITY_CENTERS:Record<string,[number,number]>={
  pretoria:[-25.7479,28.2293],soshanguve:[-25.5227,28.1001],"ga-rankuwa":[-25.6169,27.9947],mbombela:[-25.4658,30.9853],polokwane:[-23.9045,29.4689],emalahleni:[-25.8713,29.2332],
};
function seededOffset(seed:string){let h=2166136261;for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}const a=((h>>>0)%10000)/10000;const b=(((h>>>8)>>>0)%10000)/10000;return [(a-0.5)*0.028,(b-0.5)*0.028] as [number,number];}
function approximateLocation(row:any,item:any){
  const key=String(row?.canonical_city||row?.city||"").toLowerCase().replace(/[^a-z-]/g,"");
  const center=CITY_CENTERS[key]||CITY_CENTERS.pretoria;
  const [dy,dx]=seededOffset(String(item.entity_id||"residence"));
  return {lat:center[0]+dy,lng:center[1]+dx,display_name:`Approximate ${row?.canonical_city||row?.city||"area"} position`,confidence:0.12,accuracy:2500,source:"campus_area_approximation",location_type:"APPROXIMATE"};
}

async function saveMapped(service:any,item:any,result:any,query:string){
  const now=new Date().toISOString();
  if(item.entity_type==="residence"){
    const status=result.source==="google_maps"?"google_maps_verified":result.source==="campus_area_approximation"?"approximate":"geocoded";
    const update=await service.from("residences").update({
      latitude:result.lat,longitude:result.lng,geocode_status:"mapped",geocode_source:result.source,geocode_confidence:result.confidence,
      geocode_query:query,geocoded_at:now,geocoder_display_name:result.display_name,location_verification_status:status,
      location_accuracy_m:result.accuracy,location_quality_score:result.source==="campus_area_approximation"?55:result.source==="google_maps"?100:85,
    }).eq("id",item.entity_id);
    if(update.error)throw update.error;
  }else{
    const update=await service.from("resmap_campuses").update({latitude:result.lat,longitude:result.lng,geocode_status:"mapped",geocode_source:result.source,geocode_confidence:result.confidence,geocoded_at:now}).eq("id",item.entity_id);
    if(update.error)throw update.error;
  }
  await service.from("resmap_geocode_queue").update({status:"mapped",query,processed_at:now,last_error:null,updated_at:now}).eq("id",item.id);
}

async function processOne(service:any,item:any){
  const context=await entityContext(service,item);
  if(!context){
    await service.from("resmap_geocode_queue").update({status:"skipped",last_error:"Entity no longer exists",processed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",item.id);
    return {id:item.id,status:"skipped"};
  }
  const query=queryForAttempt(item,context)||item.query;
  const attempts=Number(item.attempts||0)+1;
  await service.from("resmap_geocode_queue").update({status:"processing",query,attempts,updated_at:new Date().toISOString()}).eq("id",item.id);
  try{
    const result=await geocode(query);
    if(result){await saveMapped(service,item,result,query);return {id:item.id,status:"mapped",source:result.source,lat:result.lat,lng:result.lng};}
    if(attempts>=4&&item.entity_type==="residence"){
      const approximate=approximateLocation(context,item);
      await saveMapped(service,item,approximate,query);
      return {id:item.id,status:"approximate",lat:approximate.lat,lng:approximate.lng};
    }
    await service.from("resmap_geocode_queue").update({status:"pending",available_at:new Date(Date.now()+65_000).toISOString(),last_error:"No exact result; trying a safer query variant",updated_at:new Date().toISOString()}).eq("id",item.id);
    return {id:item.id,status:"retry",query};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    if(attempts>=4&&item.entity_type==="residence"){
      const approximate=approximateLocation(context,item);
      await saveMapped(service,item,approximate,query);
      return {id:item.id,status:"approximate",error:message,lat:approximate.lat,lng:approximate.lng};
    }
    const terminal=attempts>=5;
    await service.from("resmap_geocode_queue").update({status:terminal?"failed":"pending",available_at:new Date(Date.now()+(terminal?86_400_000:65_000)).toISOString(),last_error:message,updated_at:new Date().toISOString()}).eq("id",item.id);
    if(item.entity_type==="residence")await service.from("residences").update({geocode_status:terminal?"failed":"pending",geocode_query:query}).eq("id",item.entity_id);
    else await service.from("resmap_campuses").update({geocode_status:terminal?"failed":"pending"}).eq("id",item.entity_id);
    return {id:item.id,status:terminal?"failed":"retry",error:message};
  }
}

serve(async(req)=>{
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey)return json({error:"Supabase runtime is not configured"},500);
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  if(!(await authorized(req,service)))return json({error:"Unauthorized"},401);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"tick");
  if(!["tick","batch","audit"].includes(action))return json({error:"Unsupported action"},400);
  if(action==="audit"){
    const readiness=await service.from("adminos_resmap_geo_readiness").select("*").maybeSingle();
    const queue=await service.from("resmap_geocode_queue").select("status");
    const locations=await service.from("residences").select("location_verification_status");
    const counts=(queue.data||[]).reduce((acc:any,row:any)=>{acc[row.status]=(acc[row.status]||0)+1;return acc;},{});
    const locationCounts=(locations.data||[]).reduce((acc:any,row:any)=>{const k=row.location_verification_status||"pending";acc[k]=(acc[k]||0)+1;return acc;},{});
    return json({ok:true,provider:GOOGLE_MAPS_API_KEY?"google_maps+osm_fallback":"osm",readiness:readiness.data||null,queue:counts,locations:locationCounts});
  }
  const requested=action==="tick"?1:Number(body.max||20);
  const max=Math.max(1,Math.min(30,requested));
  const due=await service.from("resmap_geocode_queue").select("*").eq("status","pending").lte("available_at",new Date().toISOString()).order("entity_type",{ascending:true}).order("id",{ascending:true}).limit(max);
  if(due.error)return json({error:due.error.message},500);
  const results:any[]=[];
  for(let i=0;i<(due.data||[]).length;i++){
    if(i>0&&!GOOGLE_MAPS_API_KEY)await sleep(1100);
    results.push(await processOne(service,due.data![i]));
  }
  return json({ok:true,processed:results.length,provider:GOOGLE_MAPS_API_KEY?"google_maps+osm_fallback":"osm",results});
});
