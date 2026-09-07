import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env=(n:string)=>Deno.env.get(n)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const NOMINATIM_BASE=env("RESMAP_GEOCODER_BASE_URL")||"https://nominatim.openstreetmap.org";
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

async function geocode(query:string){
  const url=new URL("/search",NOMINATIM_BASE);
  url.searchParams.set("format","jsonv2");
  url.searchParams.set("limit","1");
  url.searchParams.set("countrycodes","za");
  url.searchParams.set("addressdetails","1");
  url.searchParams.set("q",query);
  const response=await fetch(url,{headers:{"User-Agent":"ResKonnect-ResMap/1.0 (+https://www.reskonnect.org)","Referer":"https://www.reskonnect.org/"}});
  if(!response.ok)throw new Error(`Geocoder HTTP ${response.status}`);
  const rows=await response.json();
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row)return null;
  const lat=Number(row.lat),lng=Number(row.lon);
  if(!validZA(lat,lng))throw new Error("Geocoder returned coordinates outside South Africa");
  return {lat,lng,display_name:String(row.display_name||""),importance:Number(row.importance||0),osm_type:row.osm_type||null,osm_id:row.osm_id||null};
}

async function fallbackQuery(service:any,item:any){
  if(item.entity_type==="residence"){
    const row=(await service.from("residences").select("name,address,campus,city,province").eq("id",item.entity_id).maybeSingle()).data;
    if(!row)return null;
    const q=[row.name,row.address,row.campus,row.city,row.province,"South Africa"].filter(Boolean).join(", ");
    return q&&q!==item.query?q:null;
  }
  const row=(await service.from("resmap_campuses").select("name,address,search_query").eq("id",item.entity_id).maybeSingle()).data;
  if(!row)return null;
  const q=row.search_query||[row.name,row.address,"South Africa"].filter(Boolean).join(", ");
  return q&&q!==item.query?q:null;
}

async function processOne(service:any,item:any){
  const now=new Date().toISOString();
  await service.from("resmap_geocode_queue").update({status:"processing",attempts:Number(item.attempts||0)+1,updated_at:now}).eq("id",item.id);
  try{
    const result=await geocode(item.query);
    if(!result){
      const nextQuery=await fallbackQuery(service,item);
      if(nextQuery&&Number(item.attempts||0)<2){
        await service.from("resmap_geocode_queue").update({query:nextQuery,status:"pending",available_at:new Date(Date.now()+65_000).toISOString(),last_error:"No exact result; retrying with expanded query",updated_at:new Date().toISOString()}).eq("id",item.id);
        return {id:item.id,status:"retry",query:nextQuery};
      }
      throw new Error("No geocoding result");
    }
    const confidence=Math.max(0.25,Math.min(0.99,result.importance||0.5));
    if(item.entity_type==="residence"){
      const update=await service.from("residences").update({latitude:result.lat,longitude:result.lng,geocode_status:"mapped",geocode_source:"nominatim_osm",geocode_confidence:confidence,geocode_query:item.query,geocoded_at:new Date().toISOString()}).eq("id",item.entity_id);
      if(update.error)throw update.error;
    }else{
      const update=await service.from("resmap_campuses").update({latitude:result.lat,longitude:result.lng,geocode_status:"mapped",geocode_source:"nominatim_osm",geocode_confidence:confidence,geocoded_at:new Date().toISOString()}).eq("id",item.entity_id);
      if(update.error)throw update.error;
    }
    await service.from("resmap_geocode_queue").update({status:"mapped",processed_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",item.id);
    return {id:item.id,status:"mapped",entity_type:item.entity_type,lat:result.lat,lng:result.lng};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    const attempts=Number(item.attempts||0)+1;
    const terminal=attempts>=4;
    await service.from("resmap_geocode_queue").update({status:terminal?"failed":"pending",available_at:new Date(Date.now()+(terminal?86_400_000:Math.max(60_000,attempts*120_000))).toISOString(),last_error:message,updated_at:new Date().toISOString()}).eq("id",item.id);
    if(item.entity_type==="residence")await service.from("residences").update({geocode_status:terminal?"failed":"pending",geocode_query:item.query}).eq("id",item.entity_id);
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
    const counts=(queue.data||[]).reduce((acc:any,row:any)=>{acc[row.status]=(acc[row.status]||0)+1;return acc;},{});
    return json({ok:true,readiness:readiness.data||null,queue:counts});
  }
  const requested=action==="tick"?1:Number(body.max||20);
  const max=Math.max(1,Math.min(40,requested));
  const due=await service.from("resmap_geocode_queue").select("*").in("status",["pending"]).lte("available_at",new Date().toISOString()).order("entity_type",{ascending:true}).order("id",{ascending:true}).limit(max);
  if(due.error)return json({error:due.error.message},500);
  const results:any[]=[];
  for(let i=0;i<(due.data||[]).length;i++){
    if(i>0)await sleep(1100);
    results.push(await processOne(service,due.data![i]));
  }
  return json({ok:true,processed:results.length,results});
});
